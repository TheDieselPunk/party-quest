// ---------------------------------------------------------------------------
// Party Quest sync API (Cloudflare Worker + D1).
//
// There are no accounts or logins. Each person has a secret code that lives on
// their phone; every request carries it in the X-Party-Code header and the
// server files their records under sha256(code). Creating a NEW code needs the
// shared invite code (a Worker secret), so strangers can't fill the database.
//
//   GET  /health                 → { ok }
//   POST /register               { code, invite, name } → { ok, existed }
//   GET  /me        (code)       → { ok, name }          — validates a code
//   GET  /pull      (code)       → { profiles, characters, sessions }
//   POST /push      (code)       { upserts: [{kind,id,data,updatedAt}], deletes: [{kind,id}] }
//   GET  /guild     (code)       → [{ memberId, name, character }] — the Party view
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database
  INVITE_CODE?: string
  ALLOWED_ORIGINS?: string
}

type Kind = 'profiles' | 'characters' | 'sessions'
const KINDS = new Set<string>(['profiles', 'characters', 'sessions'])
const MAX_BODY_BYTES = 5_000_000
const MAX_ITEMS = 200
const MIN_CODE_LENGTH = 16

/** Same normalization as the app: case/spacing/punctuation-insensitive. */
export function normalizeCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function ownerOf(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`party-quest:${normalizeCode(code)}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return {
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Party-Code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
}

async function readJson<T>(req: Request): Promise<T> {
  const len = Number(req.headers.get('Content-Length') ?? 0)
  if (len > MAX_BODY_BYTES) throw new HttpError(413, 'payload too large')
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload too large')
  try { return JSON.parse(text) as T } catch { throw new HttpError(400, 'bad json') }
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// --- handlers ---------------------------------------------------------------

async function register(req: Request, env: Env): Promise<unknown> {
  const body = await readJson<{ code?: string; invite?: string; name?: string }>(req)
  const expected = (env.INVITE_CODE ?? '').trim().toUpperCase()
  if (!expected || (body.invite ?? '').trim().toUpperCase() !== expected) {
    throw new HttpError(403, 'That invite code isn’t right.')
  }
  const code = normalizeCode(body.code ?? '')
  if (code.length < MIN_CODE_LENGTH) throw new HttpError(400, 'code too short')
  const owner = await ownerOf(code)
  const name = (body.name ?? '').slice(0, 60)
  const res = await env.DB.prepare('INSERT OR IGNORE INTO owners (owner, name, created_at) VALUES (?, ?, ?)')
    .bind(owner, name, Date.now()).run()
  return { ok: true, existed: (res.meta.changes ?? 0) === 0 }
}

async function pull(env: Env, owner: string): Promise<unknown> {
  const { results } = await env.DB.prepare('SELECT kind, id, data, updated_at FROM records WHERE owner = ?')
    .bind(owner).all<{ kind: Kind; id: string; data: string; updated_at: number }>()
  const out: Record<Kind, { id: string; updatedAt: number; data: unknown }[]> = { profiles: [], characters: [], sessions: [] }
  for (const r of results) {
    if (!KINDS.has(r.kind)) continue
    out[r.kind].push({ id: r.id, updatedAt: r.updated_at, data: JSON.parse(r.data) })
  }
  return out
}

interface Upsert { kind: string; id: string; data: unknown; updatedAt: number }
interface Delete { kind: string; id: string }

function validId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 100
}

async function push(req: Request, env: Env, owner: string): Promise<unknown> {
  const body = await readJson<{ upserts?: Upsert[]; deletes?: Delete[] }>(req)
  const upserts = Array.isArray(body.upserts) ? body.upserts : []
  const deletes = Array.isArray(body.deletes) ? body.deletes : []
  if (upserts.length + deletes.length > MAX_ITEMS) throw new HttpError(413, 'too many items')

  const stmts: D1PreparedStatement[] = []
  for (const u of upserts) {
    if (!KINDS.has(u.kind) || !validId(u.id) || typeof u.data !== 'object' || u.data == null) throw new HttpError(400, 'bad upsert')
    const updatedAt = Number.isFinite(u.updatedAt) ? Math.round(u.updatedAt) : Date.now()
    // Last write wins — and a record can only ever be changed by the code that created it.
    stmts.push(env.DB.prepare(
      `INSERT INTO records (kind, id, owner, data, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       WHERE records.owner = excluded.owner AND excluded.updated_at >= records.updated_at`,
    ).bind(u.kind, u.id, owner, JSON.stringify(u.data), updatedAt))
  }
  for (const d of deletes) {
    if (!KINDS.has(d.kind) || !validId(d.id)) throw new HttpError(400, 'bad delete')
    stmts.push(env.DB.prepare('DELETE FROM records WHERE kind = ? AND id = ? AND owner = ?').bind(d.kind, d.id, owner))
  }
  if (stmts.length) await env.DB.batch(stmts)
  return { ok: true, applied: stmts.length }
}

interface CharacterData { profileId?: string; xp?: Record<string, number> }
interface ProfileData { id?: string; characterName?: string }

const totalXp = (c: CharacterData | undefined) => Object.values(c?.xp ?? {}).reduce((s, v) => s + (Number(v) || 0), 0)

/** Everyone with a code is one party: each member's highest-XP character + its name. */
async function guild(env: Env): Promise<unknown> {
  const [{ results: owners }, { results: rows }] = await Promise.all([
    env.DB.prepare('SELECT owner, name FROM owners').all<{ owner: string; name: string }>(),
    env.DB.prepare("SELECT owner, kind, id, data FROM records WHERE kind IN ('profiles', 'characters')")
      .all<{ owner: string; kind: Kind; id: string; data: string }>(),
  ])
  const nameByProfile = new Map<string, string>()
  const best = new Map<string, CharacterData>()
  for (const r of rows) {
    const data = JSON.parse(r.data) as CharacterData & ProfileData
    if (r.kind === 'profiles') nameByProfile.set(r.id, data.characterName ?? '')
    else if (!best.has(r.owner) || totalXp(data) > totalXp(best.get(r.owner))) best.set(r.owner, data)
  }
  return owners
    .map((o) => {
      const character = best.get(o.owner)
      const name = (character?.profileId && nameByProfile.get(character.profileId)) || o.name || 'Adventurer'
      return { memberId: o.owner.slice(0, 12), name, character: character ?? null }
    })
    .sort((a, b) => totalXp(b.character ?? undefined) - totalXp(a.character ?? undefined))
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const route = `${req.method} ${new URL(req.url).pathname}`
    try {
      if (route === 'GET /health') return json({ ok: true }, 200, headers)
      if (route === 'POST /register') return json(await register(req, env), 200, headers)

      const code = req.headers.get('X-Party-Code') ?? ''
      if (normalizeCode(code).length < MIN_CODE_LENGTH) throw new HttpError(401, 'missing code')
      const owner = await ownerOf(code)
      const me = await env.DB.prepare('SELECT name FROM owners WHERE owner = ?').bind(owner).first<{ name: string }>()
      if (!me) throw new HttpError(401, 'That secret code wasn’t found.')

      switch (route) {
        case 'GET /me': return json({ ok: true, name: me.name }, 200, headers)
        case 'GET /pull': return json(await pull(env, owner), 200, headers)
        case 'POST /push': return json(await push(req, env, owner), 200, headers)
        case 'GET /guild': return json(await guild(env), 200, headers)
        default: throw new HttpError(404, 'not found')
      }
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, headers)
      console.error(e)
      return json({ error: 'server error' }, 500, headers)
    }
  },
} satisfies ExportedHandler<Env>

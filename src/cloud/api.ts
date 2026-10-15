import type { Character, CompletedSession, Profile } from '../domain/types'

// ---------------------------------------------------------------------------
// Client for the Party Quest sync API (a Cloudflare Worker — see worker/).
// Every call carries the person's secret code; there are no accounts or
// sessions to expire. When VITE_SYNC_URL isn't set the app is local-only.
// ---------------------------------------------------------------------------

const BASE = (import.meta.env.VITE_SYNC_URL as string | undefined)?.replace(/\/+$/, '')

export const cloudEnabled = Boolean(BASE)

export type Kind = 'profiles' | 'characters' | 'sessions'
export type CloudRecord = Profile | Character | CompletedSession

export interface PulledRow { id: string; updatedAt: number; data: CloudRecord }
export type PullResult = Record<Kind, PulledRow[]>

export interface GuildMember { memberId: string; name: string; character: Character | null }

/** A request the server answered with an error (vs. the network being down). */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function call<T>(path: string, init: RequestInit & { code?: string } = {}): Promise<T> {
  if (!BASE) throw new Error('Cloud backup isn’t set up in this build.')
  const { code, ...rest } = init
  const headers: Record<string, string> = { ...(rest.body ? { 'Content-Type': 'application/json' } : {}) }
  if (code) headers['X-Party-Code'] = code
  // A hung request must never stall the app — give up after 15 s.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(`${BASE}${path}`, { ...rest, headers, signal: ctrl.signal })
    const body = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
    return body as T
  } finally {
    clearTimeout(timer)
  }
}

/** Create a new code (needs the shared invite code). */
export function apiRegister(code: string, invite: string, name: string): Promise<{ ok: true; existed: boolean }> {
  return call('/register', { method: 'POST', body: JSON.stringify({ code, invite, name }) })
}

/** Check a code exists (when linking a new phone). */
export function apiMe(code: string): Promise<{ ok: true; name: string }> {
  return call('/me', { code })
}

export function apiPull(code: string): Promise<PullResult> {
  return call('/pull', { code })
}

export function apiPush(
  code: string,
  upserts: { kind: Kind; id: string; data: CloudRecord; updatedAt: number }[],
  deletes: { kind: Kind; id: string }[],
): Promise<{ ok: true; applied: number }> {
  return call('/push', { method: 'POST', code, body: JSON.stringify({ upserts, deletes }) })
}

export function apiGuild(code: string): Promise<GuildMember[]> {
  return call('/guild', { code })
}

/** A friendly message for any API failure. */
export function cloudErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof DOMException && e.name === 'AbortError') return 'The cloud took too long to answer — try again.'
  return 'Couldn’t reach the cloud — check your connection and try again.'
}

import { useState } from 'react'
import { useSession } from '../store/session'
import { useSyncStatus } from '../cloud/sync'
import { apiMe, apiRegister, cloudEnabled, cloudErrorMessage } from '../cloud/api'
import { generateCode, looksLikeCode, normalizeCode } from '../cloud/code'
import { Field } from './common'

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

/** The big, copyable display of a secret code. */
function CodeCard({ code, note }: { code: string; note?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-card">
      <div className="code-text">{code}</div>
      {note && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{note}</div>}
      <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }}
        onClick={async () => setCopied(await copy(code))}>{copied ? 'Copied ✓' : '📋 Copy code'}</button>
    </div>
  )
}

/**
 * Link this phone to cloud backup + the Party with a secret code — no account,
 * no password. `restore` is the slimmer first-run version (enter an existing
 * code to pull your progress onto a new phone).
 */
export function CloudLink({ name, variant = 'settings' }: { name: string; variant?: 'settings' | 'restore' }) {
  const cloudCode = useSession((s) => s.cloudCode)
  const setCloudCode = useSession((s) => s.setCloudCode)
  const sync = useSyncStatus()

  const [mode, setMode] = useState<'choose' | 'enter' | 'create'>(variant === 'restore' ? 'enter' : 'choose')
  const [codeInput, setCodeInput] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)

  if (!cloudEnabled) return null

  async function link() {
    if (!looksLikeCode(codeInput)) { setErr('That doesn’t look like a full code — it’s three words and four digits.'); return }
    setBusy(true); setErr(null)
    try {
      const code = normalizeCode(codeInput)
      await apiMe(code)
      setCloudCode(code) // App starts syncing (pull, then push this phone's data)
    } catch (e) {
      setErr(cloudErrorMessage(e))
    } finally { setBusy(false) }
  }

  async function create() {
    if (!invite.trim()) { setErr('Enter the invite code.'); return }
    setBusy(true); setErr(null)
    try {
      const code = generateCode()
      await apiRegister(code, invite, name)
      setJustCreated(code)
      setCloudCode(code)
    } catch (e) {
      setErr(cloudErrorMessage(e))
    } finally { setBusy(false) }
  }

  function unlink() {
    if (!confirm('Unlink this phone? Your progress stays on this phone, but it stops backing up until you enter your code again.')) return
    setCloudCode(null)
    setJustCreated(null)
    setMode('choose')
  }

  // --- linked -----------------------------------------------------------------
  if (cloudCode) {
    const status = !sync.initialSyncDone
      ? 'Checking the cloud…'
      : sync.pending > 0
        ? (sync.unreachable || !sync.online ? `${sync.pending} waiting — will sync when the cloud is reachable` : `${sync.pending} syncing…`)
        : sync.unreachable ? 'Cloud unreachable — your data is safe here; it’ll retry' : 'Backed up ✓'
    const healthy = sync.initialSyncDone && sync.pending === 0 && !sync.unreachable
    return (
      <div className="card" id="cloud" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="eyebrow" style={{ margin: 0 }}>☁️ Backup & Party</div>
          <span className="tag" style={{ color: healthy ? 'var(--moss)' : 'var(--gold)' }}>{healthy ? 'on' : 'pending'}</span>
        </div>
        <div className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{status}</div>
        {justCreated ? (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>🗝️ Your secret code</div>
            <CodeCard code={justCreated} note="Save this somewhere safe (a note or your password manager). It’s the only way to restore your progress on a new phone — there’s no password reset." />
            <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setJustCreated(null)}>I saved it</button>
          </>
        ) : reveal ? (
          <>
            <CodeCard code={cloudCode} note="Enter this on another phone to restore your progress there." />
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setReveal(false)}>Hide code</button>
          </>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setReveal(true)}>🗝️ Show my code</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-dim)' }} onClick={unlink}>Unlink phone</button>
          </div>
        )}
      </div>
    )
  }

  // --- not linked ---------------------------------------------------------------
  return (
    <div className="card" id="cloud" style={{ marginBottom: 12 }}>
      <div className="eyebrow">☁️ {variant === 'restore' ? 'Already have a secret code?' : 'Backup & Party'}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        {variant === 'restore'
          ? 'Enter it to bring your character and history onto this phone.'
          : 'No account or password — just a secret code saved on this phone. It backs up your progress and puts you in the Party with your partner.'}
      </div>

      {mode === 'choose' && (
        <div className="center-col" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-block" onClick={() => { setErr(null); setMode('create') }}>✨ Create my secret code</button>
          <button className="btn btn-ghost btn-block" onClick={() => { setErr(null); setMode('enter') }}>I already have a code</button>
        </div>
      )}

      {mode === 'enter' && (
        <>
          <Field label="Your secret code">
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="e.g. ember-griffin-lantern-4271"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onKeyDown={(e) => { if (e.key === 'Enter') void link() }} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={link}>{busy ? 'Checking…' : 'Link this phone'}</button>
          {variant === 'settings' && (
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 6 }} onClick={() => { setErr(null); setMode('choose') }}>← Back</button>
          )}
        </>
      )}

      {mode === 'create' && (
        <>
          <Field label="Invite code">
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="the party’s invite code"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              onKeyDown={(e) => { if (e.key === 'Enter') void create() }} />
          </Field>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            One time only. You’ll get a code like <b>ember-griffin-lantern-4271</b> to keep.
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={create}>{busy ? 'Forging your code…' : 'Create my code'}</button>
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 6 }} onClick={() => { setErr(null); setMode('choose') }}>← Back</button>
        </>
      )}

      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</div>}
    </div>
  )
}

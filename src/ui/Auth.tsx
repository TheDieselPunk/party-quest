import { useState } from 'react'
import { signIn, signUp } from '../cloud/auth'
import { Field } from './common'

/**
 * Sign-in / sign-up gate. On success, App reacts to the auth state change.
 * "Continue offline" preserves the local-only experience.
 */
export function Auth({ onOffline }: { onOffline: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!email.trim() || password.length < 6) { setErr('Enter an email and a password (6+ characters).'); return }
    setBusy(true); setErr(null)
    try {
      if (mode === 'signup') await signUp(email, password)
      else await signIn(email, password)
      // session change is picked up by useAuth() in App
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div className="screen fade-in" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 40 }}>⚔️</div>
        <h1 style={{ margin: '6px 0 2px' }}>Party Quest</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          {mode === 'signup' ? 'Create an account so your progress is saved & backed up.' : 'Sign in to sync your progress across devices.'}
        </p>
      </div>

      <div className="card center-col">
        <Field label="Email">
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="at least 6 characters"
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
        </Field>
        {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy} onClick={submit}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </div>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }}
        onClick={() => { setErr(null); setMode(mode === 'signup' ? 'signin' : 'signup') }}>
        {mode === 'signup' ? 'I already have an account — sign in' : 'New here? Create an account'}
      </button>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: 13 }} onClick={onOffline}>
        Continue offline (no backup)
      </button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from './supabase'

export async function signUp(email: string, password: string, inviteCode: string): Promise<void> {
  if (!supabase) throw new Error('Cloud is not configured.')
  // invite_code is validated server-side by a Before-User-Created auth hook,
  // so the actual code never lives in the client bundle.
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { invite_code: inviteCode.trim() } },
  })
  if (error) throw error
  // With email-confirmation off, signUp also returns a session; if not, sign in.
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (e2) throw e2
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Cloud is not configured.')
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export interface AuthState {
  session: Session | null
  ready: boolean
  cloudEnabled: boolean
}

/** Reactive auth session. `ready` flips true once the initial check completes. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!cloudEnabled)

  useEffect(() => {
    if (!supabase) { setReady(true); return }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  return { session, ready, cloudEnabled }
}

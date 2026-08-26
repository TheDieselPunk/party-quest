import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_ATTRIBUTES, ATTRIBUTE_LABEL } from '../domain/types'
import { useProfiles, useAllCharacters } from '../store/hooks'
import { useSession } from '../store/session'
import { useAuth } from '../cloud/auth'
import {
  myParty, createParty, joinParty, leaveParty, fetchPartyMembers, type PartyMember,
} from '../cloud/party'
import { characterLevel, levelFromXp } from '../rpg/character'
import { Screen } from './common'

export function Party() {
  const navigate = useNavigate()
  const { session, cloudEnabled } = useAuth()
  const signedIn = cloudEnabled && !!session

  const profiles = useProfiles() ?? []
  const characters = useAllCharacters() ?? []
  const currentId = useSession((s) => s.currentProfileId)
  const setOffline = useSession((s) => s.setOffline)
  const myName = profiles.find((p) => p.id === currentId)?.characterName ?? 'Adventurer'

  // ---- cloud party state ----
  const [party, setParty] = useState<{ partyId: string; code: string } | null>(null)
  const [members, setMembers] = useState<PartyMember[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function refresh() {
    const p = await myParty()
    setParty(p)
    setMembers(p ? await fetchPartyMembers(p.partyId) : [])
  }
  useEffect(() => { if (signedIn) void refresh() }, [signedIn])

  async function doCreate() {
    setBusy(true); setErr(null)
    try { await createParty(myName); await refresh() } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
    setBusy(false)
  }
  async function doJoin() {
    if (!code.trim()) return
    setBusy(true); setErr(null)
    try { await joinParty(code, myName); setCode(''); await refresh() } catch (e) { setErr(e instanceof Error ? e.message : 'Invalid code') }
    setBusy(false)
  }
  async function doLeave() {
    if (!party || !confirm('Leave this party?')) return
    setBusy(true); await leaveParty(party.partyId); await refresh(); setBusy(false)
  }

  // ---- offline / local fallback ----
  if (!signedIn) {
    const local = profiles.map((p) => ({ p, c: characters.find((c) => c.profileId === p.id) }))
    return (
      <Screen eyebrow="The Guild" title="Adventuring party">
        <div className="card-parchment" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#3a2d18' }}>
            Sign in for a live party
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Signing in backs up your progress and lets you and your partner see each other's characters live from your own phones.
          </div>
          {cloudEnabled && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => setOffline(false)}>Sign in / create account</button>
          )}
        </div>
        <div className="center-col">
          {local.map(({ p, c }) => (
            <div key={p.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{p.characterName}</div>
                <div className="big-num" style={{ fontSize: 24 }}>Lv {c ? characterLevel(c) : 0}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/onboarding')}>➕ Add an adventurer</button>
      </Screen>
    )
  }

  // ---- signed-in party view ----
  return (
    <Screen eyebrow="The Guild" title="Adventuring party">
      {!party ? (
        <div className="card center-col">
          <div className="eyebrow">Form your party</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Create a party and share the code, or enter a partner's code to join theirs.</p>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={doCreate}>Create a party</button>
          <div className="row" style={{ gap: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" style={{ textTransform: 'uppercase' }} />
            <button className="btn" disabled={busy} onClick={doJoin}>Join</button>
          </div>
          {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        </div>
      ) : (
        <>
          <div className="card-parchment" style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Party code</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, letterSpacing: 3, color: '#3a2d18' }}>{party.code}</div>
              </div>
              <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(party.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Share this code with your partner so they can join.</div>
          </div>

          <div className="center-col">
            {members.map((m) => (
              <div key={m.userId} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{m.displayName}</div>
                  <div className="big-num" style={{ fontSize: 24 }}>Lv {m.character ? characterLevel(m.character) : 0}</div>
                </div>
                {m.character && (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {ALL_ATTRIBUTES.map((a) => (
                      <span key={a} className="tag">{ATTRIBUTE_LABEL[a].slice(0, 3)} {levelFromXp(m.character!.xp[a])}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => void refresh()}>↻ Refresh</button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 6, color: 'var(--danger)' }} disabled={busy} onClick={doLeave}>Leave party</button>
        </>
      )}
    </Screen>
  )
}

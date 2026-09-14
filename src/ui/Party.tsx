import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_ATTRIBUTES, ATTRIBUTE_LABEL } from '../domain/types'
import { useProfiles, useAllCharacters } from '../store/hooks'
import { useSession } from '../store/session'
import { useAuth } from '../cloud/auth'
import { fetchGuild, type PartyMember } from '../cloud/party'
import { characterLevel, levelFromXp } from '../rpg/character'
import { Screen } from './common'

export function Party() {
  const navigate = useNavigate()
  const { session, cloudEnabled } = useAuth()
  const signedIn = cloudEnabled && !!session

  const profiles = useProfiles() ?? []
  const characters = useAllCharacters() ?? []
  const setOffline = useSession((s) => s.setOffline)

  const [members, setMembers] = useState<PartyMember[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try { setMembers(await fetchGuild()) } finally { setLoading(false) }
  }
  useEffect(() => { if (signedIn) void refresh() }, [signedIn])

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

  // ---- signed-in: the whole guild, automatically ----
  return (
    <Screen eyebrow="The Guild" title="Adventuring party"
      action={<button className="btn btn-sm btn-ghost" disabled={loading} onClick={() => void refresh()}>↻</button>}>
      <div className="card-parchment" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, color: '#4b3c1e' }}>
          Everyone with the app is in your party automatically — you and your partner see each other's characters here, live. No codes to share.
        </div>
      </div>

      {members.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 12 }}>
          {loading ? 'Gathering the party…' : 'No party members yet — your character shows here once your first workout syncs.'}
        </div>
      ) : (
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
      )}
    </Screen>
  )
}

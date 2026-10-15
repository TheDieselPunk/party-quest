import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_ATTRIBUTES, ATTRIBUTE_LABEL } from '../domain/types'
import { useProfiles, useAllCharacters } from '../store/hooks'
import { useSession } from '../store/session'
import { apiGuild, cloudEnabled, cloudErrorMessage, type GuildMember } from '../cloud/api'
import { characterLevel, levelFromXp } from '../rpg/character'
import { Screen } from './common'

export function Party() {
  const navigate = useNavigate()
  const cloudCode = useSession((s) => s.cloudCode)
  const linked = cloudEnabled && !!cloudCode

  const profiles = useProfiles() ?? []
  const characters = useAllCharacters() ?? []

  const [members, setMembers] = useState<GuildMember[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function refresh() {
    if (!cloudCode) return
    setLoading(true); setErr(null)
    try { setMembers(await apiGuild(cloudCode)) } catch (e) { setErr(cloudErrorMessage(e)) } finally { setLoading(false) }
  }
  useEffect(() => {
    if (!linked || !cloudCode) return
    let alive = true
    setLoading(true)
    apiGuild(cloudCode)
      .then((m) => { if (alive) { setMembers(m); setErr(null) } })
      .catch((e) => { if (alive) setErr(cloudErrorMessage(e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [linked, cloudCode])

  // ---- not linked: local characters only ----
  if (!linked) {
    const local = profiles.map((p) => ({ p, c: characters.find((c) => c.profileId === p.id) }))
    return (
      <Screen eyebrow="The Guild" title="Adventuring party">
        <div className="card-parchment" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#3a2d18' }}>
            Join the live party
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Set up your secret code (no account or password) to back up your progress and see each other's characters live from your own phones.
          </div>
          {cloudEnabled && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/settings')}>Set up my secret code</button>
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

  // ---- linked: the whole guild, automatically ----
  return (
    <Screen eyebrow="The Guild" title="Adventuring party"
      action={<button className="btn btn-sm btn-ghost" disabled={loading} onClick={() => void refresh()}>↻</button>}>
      <div className="card-parchment" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 12, color: '#4b3c1e' }}>
          Everyone with a secret code is in your party automatically — you and your partner see each other's characters here, live.
        </div>
      </div>

      {members.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 12 }}>
          {loading ? 'Gathering the party…' : err ?? 'No party members yet — your character shows here once your first workout syncs.'}
        </div>
      ) : (
        <div className="center-col">
          {members.map((m) => (
            <div key={m.memberId} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{m.name}</div>
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

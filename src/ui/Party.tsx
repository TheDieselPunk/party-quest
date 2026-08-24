import { useNavigate } from 'react-router-dom'
import { ALL_ATTRIBUTES, ATTRIBUTE_LABEL } from '../domain/types'
import { useProfiles, useAllCharacters } from '../store/hooks'
import { useSession } from '../store/session'
import { characterLevel, levelFromXp } from '../rpg/character'
import { Screen } from './common'

export function Party() {
  const navigate = useNavigate()
  const profiles = useProfiles() ?? []
  const characters = useAllCharacters() ?? []
  const currentId = useSession((s) => s.currentProfileId)
  const setCurrent = useSession((s) => s.setCurrent)

  const charOf = (pid: string) => characters.find((c) => c.profileId === pid)

  const partySessions = characters.reduce((n, c) => n + c.totalSessions, 0)

  return (
    <Screen eyebrow="The Guild" title="Adventuring party">
      <div className="card-parchment" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ fontSize: 13 }}>Weekly party quest</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#3a2d18' }}>
          Complete workouts together
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {partySessions} total quests logged across the party. (Live cross-device sync comes in a later update — for now each hero is on their own device.)
        </div>
      </div>

      <div className="center-col">
        {profiles.map((p) => {
          const c = charOf(p.id)
          const isMe = p.id === currentId
          return (
            <div key={p.id} className="card" style={{ borderColor: isMe ? 'var(--gold)' : undefined }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
                    {p.characterName} {isMe && <span className="tag" style={{ marginLeft: 6 }}>You</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{p.experience} · {p.goal}</div>
                </div>
                <div className="big-num" style={{ fontSize: 24 }}>Lv {c ? characterLevel(c) : 0}</div>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {ALL_ATTRIBUTES.map((a) => (
                  <span key={a} className="tag">{ATTRIBUTE_LABEL[a].slice(0, 3)} {c ? levelFromXp(c.xp[a]) : 0}</span>
                ))}
              </div>
              {!isMe && (
                <button className="btn btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => { setCurrent(p.id); navigate('/') }}>
                  Play as {p.characterName}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/onboarding')}>
        ➕ Add an adventurer
      </button>
    </Screen>
  )
}

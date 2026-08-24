import type { Profile } from '../domain/types'
import { ALL_ATTRIBUTES, ATTRIBUTE_LABEL, ATTRIBUTE_BLURB } from '../domain/types'
import { useCharacter, useSessions } from '../store/hooks'
import { characterLevel, levelFromXp, levelProgress } from '../rpg/character'
import { EXERCISES_BY_ID } from '../data/exercises'
import { Bar, Screen } from './common'

export function CharacterScreen({ profile }: { profile: Profile }) {
  const character = useCharacter(profile.id)
  const sessions = useSessions(profile.id) ?? []
  if (!character) return <div className="screen">Loading…</div>

  const bests = Object.entries(character.bests)
    .sort((a, b) => b[1].est1rm - a[1].est1rm)
    .slice(0, 8)

  return (
    <Screen eyebrow="Your hero" title={profile.characterName}
      action={<div style={{ textAlign: 'right' }}><div className="big-num">Lv {characterLevel(character)}</div></div>}>
      <div className="row" style={{ gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: 12 }}>
          <div className="big-num" style={{ fontSize: 24 }}>{character.totalSessions}</div>
          <div className="muted" style={{ fontSize: 12 }}>Quests done</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: 12 }}>
          <div className="big-num" style={{ fontSize: 24 }}>🔥 {character.streak}</div>
          <div className="muted" style={{ fontSize: 12 }}>Streak</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: 12 }}>
          <div className="big-num" style={{ fontSize: 24 }}>{sessions.length}</div>
          <div className="muted" style={{ fontSize: 12 }}>Logged</div>
        </div>
      </div>

      <div className="card center-col">
        <div className="eyebrow">Attributes</div>
        {ALL_ATTRIBUTES.map((a) => (
          <div key={a}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>{ATTRIBUTE_LABEL[a]}</span>
              <span className="muted" style={{ fontSize: 13 }}>Lv {levelFromXp(character.xp[a])}</span>
            </div>
            <Bar value={levelProgress(character.xp[a]) * 100} max={100} />
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{ATTRIBUTE_BLURB[a]}</div>
          </div>
        ))}
      </div>

      {bests.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="eyebrow">Hall of records (est. 1RM)</div>
          {bests.map(([id, b]) => (
            <div key={id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 14 }}>{EXERCISES_BY_ID[id]?.name ?? id}</span>
              <span className="muted" style={{ fontSize: 13 }}>{b.load}×{b.reps} · ~{Math.round(b.est1rm)} lb</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}

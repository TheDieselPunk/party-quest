import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../domain/types'
import { ALL_ATTRIBUTES, ATTRIBUTE_LABEL } from '../domain/types'
import { useCharacter, useSessions, useActive } from '../store/hooks'
import { dayForIndex, weeklyVolumeTargets, volumeFromSessions, recentSessions } from '../engine'
import { characterLevel, levelFromXp } from '../rpg/character'
import { startWorkout } from '../db/repo'
import { Bar, Screen } from './common'

export function Dashboard({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const character = useCharacter(profile.id)
  const sessions = useSessions(profile.id) ?? []
  const active = useActive(profile.id)
  const [busy, setBusy] = useState(true)
  const [starting, setStarting] = useState(false)

  const nextDay = dayForIndex(profile, profile.dayIndex)
  const targets = weeklyVolumeTargets(profile)
  const last7 = recentSessions(sessions, 7)
  const actual = volumeFromSessions(last7)

  const totalTarget = Object.values(targets).reduce((a, b) => a + b, 0)
  const totalActual = Object.values(actual).reduce((a, b) => a + b, 0)

  async function begin() {
    setStarting(true)
    await startWorkout(profile, { busy })
    navigate('/workout')
  }

  return (
    <Screen eyebrow={`Party Quest`} title={`Welcome, ${profile.characterName}`}>
      {/* Hero card */}
      <div className="card-parchment">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22 }}>{profile.characterName}</div>
            <div className="muted" style={{ fontSize: 13 }}>{profile.experience} · {profile.location === 'gym' ? 'Apartment Gym' : 'Home Studio'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30, color: '#7a5a1e' }}>
              Lv {character ? characterLevel(character) : 0}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>🔥 {character?.streak ?? 0} streak</div>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 12, gap: 8 }}>
          {ALL_ATTRIBUTES.map((a) => (
            <div key={a} style={{ fontSize: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: '#4b3c1e', fontWeight: 700 }}>{ATTRIBUTE_LABEL[a]}</span>
                <span className="muted">Lv {character ? levelFromXp(character.xp[a]) : 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's quest */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="eyebrow">Today’s Quest</div>
        <h2 style={{ margin: '2px 0 8px', fontSize: 20 }}>{nextDay.label}</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          A {profile.sessionMinutes}-minute session tailored to your {profile.location === 'gym' ? 'apartment gym' : 'home studio'},
          with weights based on your history.
        </div>

        {active ? (
          <>
            <button className="btn btn-ember btn-block" onClick={() => navigate('/workout')}>
              ▶ Resume workout in progress
            </button>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Gym is busy right now?</span>
              <button className="chip" aria-pressed={busy} onClick={() => setBusy((b) => !b)}>
                {busy ? 'Busy — solo sets' : 'Quiet — allow supersets'}
              </button>
            </div>
            <button className="btn btn-primary btn-block" disabled={starting} onClick={begin}>
              {starting ? 'Rolling…' : '⚔️ Start quest'}
            </button>
          </>
        )}
      </div>

      {/* Weekly progress */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="eyebrow">This Week</div>
          <span className="muted" style={{ fontSize: 12 }}>{last7.length}/{profile.frequency} sessions</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', margin: '8px 0 4px' }}>
          <span style={{ fontSize: 14 }}>Total working sets</span>
          <span className="muted" style={{ fontSize: 13 }}>{Math.round(totalActual)} / {totalTarget}</span>
        </div>
        <Bar value={totalActual} max={totalTarget} variant="vol" />
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/coach')}>
          🧙 Ask the Coach (AI review)
        </button>
      </div>
    </Screen>
  )
}

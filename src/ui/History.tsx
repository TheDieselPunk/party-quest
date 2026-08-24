import { useState } from 'react'
import type { Profile } from '../domain/types'
import { useSessions } from '../store/hooks'
import { GOAL_LABEL, Screen } from './common'

function dateStr(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function History({ profile }: { profile: Profile }) {
  const sessions = useSessions(profile.id)
  const [open, setOpen] = useState<string | null>(null)

  if (!sessions) return <div className="screen">Loading…</div>

  return (
    <Screen eyebrow="Chronicle" title="Quest log">
      {sessions.length === 0 && <p className="muted">No quests yet. Your legend starts with the first session.</p>}
      <div className="center-col">
        {sessions.map((s) => {
          const working = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done && !x.warmup).length, 0)
          const isOpen = open === s.id
          return (
            <div key={s.id} className="card" style={{ padding: 14 }}>
              <button className="row" style={{ justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                onClick={() => setOpen(isOpen ? null : s.id)}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{s.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{dateStr(s.date)} · {GOAL_LABEL[s.goal]} · {working} sets{s.durationSeconds ? ` · ${Math.round(s.durationSeconds / 60)} min` : ''}</div>
                </div>
                <span className="muted">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div style={{ marginTop: 10 }}>
                  {s.exercises.map((ex, i) => {
                    const done = ex.sets.filter((x) => x.done && !x.warmup)
                    if (!done.length) return null
                    return (
                      <div key={i} style={{ padding: '4px 0', borderTop: i ? '1px dashed var(--edge)' : undefined }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {done.map((set) => `${set.load == null ? 'BW' : set.load + 'lb'}×${set.reps}${set.rir != null ? `@${set.rir}` : ''}`).join('  ·  ')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Screen>
  )
}

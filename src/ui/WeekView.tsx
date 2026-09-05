import { useNavigate } from 'react-router-dom'
import type { PlannedSession, Profile } from '../domain/types'
import { planWeek } from '../engine'
import { enabledObjectives, OBJECTIVE_META } from '../domain/objectives'
import { useSession } from '../store/session'
import { Screen } from './common'

const KIND_ICON: Record<string, string> = { gym: '⚔️', run: '🏃', ruck: '🎒', mobility: '🧘', rest: '🌙' }

export function WeekView({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const setPending = useSession((s) => s.setPendingGuided)
  const plan = planWeek(profile)
  const objs = enabledObjectives(profile)

  function open(s: PlannedSession) {
    if (s.kind === 'rest') return
    if (s.kind === 'gym') { navigate('/'); return }
    setPending(s)
    navigate('/session')
  }

  return (
    <Screen eyebrow="Your week" title="Battle Plan"
      action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/settings')}>Objectives</button>}>

      {objs.length === 0 ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Add an <b>objective</b> in Settings — like fixing your posture, training for a run, or prepping to
            carry a pack — and your off-gym days fill in with runs, loaded walks, and a daily mobility reset.
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/settings')}>Add an objective</button>
        </div>
      ) : (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {objs.map((o) => (
            <span key={o.id} className="tag" style={{ background: '#00000030', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
              {OBJECTIVE_META[o.kind].icon} {OBJECTIVE_META[o.kind].label}
            </span>
          ))}
        </div>
      )}

      {plan.days.map((d) => (
        <div key={d.offset} className="card" style={{ marginBottom: 10, borderColor: d.isToday ? 'var(--gold)' : undefined }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>{d.isToday ? 'Today' : d.weekday}</span>
            {d.isToday && <span className="eyebrow" style={{ margin: 0, color: 'var(--gold)' }}>now</span>}
          </div>
          <div className="center-col" style={{ gap: 8 }}>
            {d.sessions.map((s, k) => (
              <button
                key={k}
                className="row"
                onClick={() => open(s)}
                disabled={s.kind === 'rest'}
                style={{
                  justifyContent: 'space-between', alignItems: 'center', width: '100%',
                  background: s.kind === 'rest' ? 'transparent' : '#0000002e',
                  border: 'none', borderRadius: 10, padding: s.kind === 'rest' ? '2px 4px' : '10px 12px',
                  cursor: s.kind === 'rest' ? 'default' : 'pointer', textAlign: 'left', color: 'inherit',
                }}
              >
                <span className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>{KIND_ICON[s.kind]}</span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{s.title}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{s.detail}</span>
                  </span>
                </span>
                {s.kind !== 'rest' && (
                  <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {s.estMinutes} min ›
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>
        Runs are kept off your heavy-leg days, and loads build gradually toward your target dates.
      </p>
    </Screen>
  )
}

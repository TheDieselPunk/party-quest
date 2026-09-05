import type { Objective, ObjectiveKind } from '../domain/types'
import {
  OBJECTIVE_META, newPostureObjective, newRunEventObjective, newLoadCarriageObjective, weeksUntil,
} from '../domain/objectives'
import { Field } from './common'

const KINDS: ObjectiveKind[] = ['posture', 'run-event', 'load-carriage']

const toDateInput = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromDateInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).getTime()
}
function countdown(ms: number): string {
  const w = weeksUntil(ms)
  if (w < 0) return 'date passed'
  if (w === 0) return 'this week'
  return `in ${w} week${w === 1 ? '' : 's'}`
}

export function Objectives({ value, onChange }: { value: Objective[]; onChange: (v: Objective[]) => void }) {
  const has = (k: ObjectiveKind) => value.some((o) => o.kind === k)

  function add(k: ObjectiveKind) {
    const o: Objective = k === 'posture' ? newPostureObjective()
      : k === 'run-event' ? newRunEventObjective()
        : newLoadCarriageObjective()
    onChange([...value, o])
  }
  function update(id: string, patch: Partial<Objective>) {
    onChange(value.map((o) => (o.id === id ? ({ ...o, ...patch } as Objective) : o)))
  }
  function remove(id: string) { onChange(value.filter((o) => o.id !== id)) }

  return (
    <div className="card center-col" style={{ marginTop: 12 }}>
      <div className="eyebrow">Objectives</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Bigger goals that shape your gym sessions and fill your off-gym days. Stack as many as you like.
      </p>

      {value.map((o) => (
        <div key={o.id} style={{ background: '#0000002e', borderRadius: 10, padding: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{OBJECTIVE_META[o.kind].icon} {OBJECTIVE_META[o.kind].label}</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="chip" aria-pressed={o.enabled} onClick={() => update(o.id, { enabled: !o.enabled })}>
                {o.enabled ? 'On' : 'Off'}
              </button>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(o.id)}>Remove</button>
            </div>
          </div>

          {o.kind === 'posture' && (
            <label className="row" style={{ gap: 8, marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={o.dailyReset} onChange={(e) => update(o.id, { dailyReset: e.target.checked })} />
              Include a short daily <b>&nbsp;Desk Reset&nbsp;</b> mobility flow
            </label>
          )}

          {o.kind === 'run-event' && (
            <div className="center-col" style={{ marginTop: 8, gap: 8 }}>
              <Field label={`Race date — ${countdown(o.targetDate)}`}>
                <input type="date" value={toDateInput(o.targetDate)} onChange={(e) => update(o.id, { targetDate: fromDateInput(e.target.value) })} />
              </Field>
              <Field label="Distance (km)">
                <input type="number" min={1} value={o.distanceKm} onChange={(e) => update(o.id, { distanceKm: Number(e.target.value) || 5 })} />
              </Field>
              <Field label="Minutes you can jog non-stop right now">
                <input type="number" min={0} value={o.baselineRunMinutes} onChange={(e) => update(o.id, { baselineRunMinutes: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              <Field label={`Run days per week: ${o.daysPerWeek}`}>
                <input type="range" min={2} max={5} value={o.daysPerWeek} onChange={(e) => update(o.id, { daysPerWeek: Number(e.target.value) })} />
              </Field>
            </div>
          )}

          {o.kind === 'load-carriage' && (
            <div className="center-col" style={{ marginTop: 8, gap: 8 }}>
              <Field label="Event name">
                <input value={o.eventName} onChange={(e) => update(o.id, { eventName: e.target.value })} />
              </Field>
              <Field label={`Event date — ${countdown(o.targetDate)}`}>
                <input type="date" value={toDateInput(o.targetDate)} onChange={(e) => update(o.id, { targetDate: fromDateInput(e.target.value) })} />
              </Field>
              <Field label="Target pack weight (lb)">
                <input type="number" min={0} value={o.packLoadLb} onChange={(e) => update(o.id, { packLoadLb: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              <Field label={`Days on your feet: ${o.daysOnFeet}`}>
                <input type="range" min={1} max={7} value={o.daysOnFeet} onChange={(e) => update(o.id, { daysOnFeet: Number(e.target.value) })} />
              </Field>
              <label className="row" style={{ gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={o.recurringAnnual} onChange={(e) => update(o.id, { recurringAnnual: e.target.checked })} />
                Repeats every year (roll the date forward automatically)
              </label>
            </div>
          )}
        </div>
      ))}

      <div className="chips" style={{ marginTop: 4 }}>
        {KINDS.filter((k) => !has(k)).map((k) => (
          <button key={k} className="chip" onClick={() => add(k)}>+ {OBJECTIVE_META[k].icon} {OBJECTIVE_META[k].label}</button>
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { Profile } from '../domain/types'
import { logOffDaySession } from '../db/repo'
import type { SessionRewards } from '../rpg/character'
import { Field } from './common'

const MACHINES = [
  { id: 'stairmaster', label: 'StairMaster' },
  { id: 'treadmill', label: 'Treadmill' },
  { id: 'elliptical', label: 'Elliptical' },
  { id: 'bike', label: 'Bike' },
  { id: 'run', label: 'Outdoor Run/Walk' },
  { id: 'other', label: 'Other' },
]

/** Quick manual log for cardio done outside the guided gym plan / objectives. */
export function LogCardio({ profile, onClose, onDone }: {
  profile: Profile
  onClose: () => void
  onDone: (rewards: SessionRewards) => void
}) {
  const [machine, setMachine] = useState(MACHINES[0].id)
  const [minutesText, setMinutesText] = useState('20')
  const minutes = Number(minutesText) || 0
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (saving) return
    setSaving(true)
    const label = MACHINES.find((m) => m.id === machine)?.label ?? 'Cardio'
    const rewards = await logOffDaySession(profile, {
      kind: 'cardio', title: `${label} — Cardio`, minutes,
    })
    onDone(rewards)
  }

  return (
    <div className="toast-wrap" style={{ background: '#0009', pointerEvents: 'auto' }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', pointerEvents: 'auto' }}>
        <div className="eyebrow">Off the plan</div>
        <h2 style={{ margin: '2px 0 12px' }}>🔥 Log cardio</h2>
        <Field label="Machine / activity">
          <div className="chips">
            {MACHINES.map((m) => (
              <button key={m.id} type="button" className="chip" aria-pressed={machine === m.id} onClick={() => setMachine(m.id)}>{m.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Minutes">
          <input inputMode="numeric" value={minutesText} placeholder="e.g. 20"
            onChange={(e) => setMinutesText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
        </Field>
        <div className="row" style={{ marginTop: 4, gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} disabled={saving} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving || minutes < 1} onClick={submit}>{saving ? 'Logging…' : 'Log it'}</button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Experience, Goal, LocationId, MuscleFocus } from '../domain/types'
import { createProfile } from '../db/repo'
import { useSession } from '../store/session'
import { Chips, Field } from './common'

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Gain Strength' },
  { value: 'muscle', label: 'Build Muscle' },
  { value: 'fatloss', label: 'Fat Loss' },
  { value: 'other', label: 'Other…' },
]
const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Novice (0–1 yr)' },
  { value: 'intermediate', label: 'Adept (1–3 yr)' },
  { value: 'advanced', label: 'Veteran (3+ yr)' },
]
const FOCI: { value: MuscleFocus; label: string }[] = [
  { value: 'chest', label: 'Chest' }, { value: 'back', label: 'Back' },
  { value: 'arms', label: 'Arms' }, { value: 'shoulders', label: 'Shoulders' },
  { value: 'legs', label: 'Legs' }, { value: 'core', label: 'Core' },
]
const LOCATIONS: { value: LocationId; label: string }[] = [
  { value: 'gym', label: 'Apartment Gym' },
  { value: 'studio', label: 'Home Studio' },
]

export function Onboarding({ first }: { first: boolean }) {
  const navigate = useNavigate()
  const setCurrent = useSession((s) => s.setCurrent)

  const [characterName, setName] = useState('')
  const [goal, setGoal] = useState<Goal>('muscle')
  const [goalOther, setGoalOther] = useState('')
  const [experience, setExperience] = useState<Experience>('intermediate')
  const [frequency, setFrequency] = useState(3)
  const [sessionMinutes, setSessionMinutes] = useState(60)
  const [focus, setFocus] = useState<MuscleFocus | null>(null)
  const [location, setLocation] = useState<LocationId>('gym')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const profile = await createProfile({
      name: characterName.trim() || 'Adventurer',
      characterName: characterName.trim() || 'Adventurer',
      goal, goalOther: goal === 'other' ? goalOther.trim() : undefined,
      experience, frequency, sessionMinutes, focus, location,
      cardio: goal === 'fatloss' ? 'moderate' : 'none',
    })
    setCurrent(profile.id)
    navigate('/')
  }

  return (
    <div className="screen fade-in">
      <div className="eyebrow">{first ? 'Form your party' : 'New adventurer'}</div>
      <h1 style={{ marginTop: 0 }}>Create your character</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Your training settings shape every quest. You can change all of this later.
      </p>

      <div className="card center-col" style={{ marginTop: 8 }}>
        <Field label="Character name">
          <input value={characterName} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thorin, Aria…" />
        </Field>

        <Field label="Goal">
          <Chips options={GOALS} value={goal} onChange={setGoal} />
        </Field>
        {goal === 'other' && (
          <Field label="Describe your goal">
            <input value={goalOther} onChange={(e) => setGoalOther(e.target.value)} placeholder="e.g. tone up for a wedding" />
          </Field>
        )}

        <Field label="Experience">
          <Chips options={EXPERIENCE} value={experience} onChange={setExperience} />
        </Field>

        <Field label={`Days per week: ${frequency}`}>
          <input type="range" min={2} max={6} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} />
          <div className="muted" style={{ fontSize: 12 }}>Recommended: 3 — spreads volume so each muscle is trained ≥2×/week.</div>
        </Field>

        <Field label="Session length">
          <Chips
            options={[{ value: '40', label: '40 min' }, { value: '60', label: '60 min' }, { value: '80', label: '80 min' }]}
            value={String(sessionMinutes)}
            onChange={(v) => setSessionMinutes(Number(v))}
          />
        </Field>

        <Field label="Focus (optional)">
          <div className="chips">
            <button type="button" className="chip" aria-pressed={focus === null} onClick={() => setFocus(null)}>Balanced</button>
            {FOCI.map((f) => (
              <button key={f.value} type="button" className="chip" aria-pressed={focus === f.value} onClick={() => setFocus(f.value)}>{f.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Where do you train?">
          <Chips options={LOCATIONS} value={location} onChange={setLocation} />
        </Field>
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={saving} onClick={submit}>
        {saving ? 'Forging…' : 'Begin the adventure ⚔️'}
      </button>
    </div>
  )
}

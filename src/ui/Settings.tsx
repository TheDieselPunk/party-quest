import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  CardioLevel, Experience, Goal, LocationId, Muscle, MuscleFocus, Profile, SplitStyle,
} from '../domain/types'
import { ALL_MUSCLES, MUSCLE_LABEL } from '../domain/types'
import { saveProfile, deleteProfile } from '../db/repo'
import { useSession } from '../store/session'
import { useProfiles } from '../store/hooks'
import { useAuth, signOut } from '../cloud/auth'
import { useSyncStatus } from '../cloud/sync'
import { Chips, Field, Screen } from './common'

export function Settings({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const profiles = useProfiles() ?? []
  const setCurrent = useSession((s) => s.setCurrent)
  const setOffline = useSession((s) => s.setOffline)
  const { session, cloudEnabled } = useAuth()
  const sync = useSyncStatus()
  const [p, setP] = useState<Profile>(profile)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }
  function toggleAvoid(m: Muscle) {
    set('avoidMuscles', p.avoidMuscles.includes(m) ? p.avoidMuscles.filter((x) => x !== m) : [...p.avoidMuscles, m])
  }

  async function save() {
    await saveProfile(p)
    setSaved(true)
  }
  async function remove() {
    if (!confirm(`Delete ${p.characterName}? This erases their history on this device.`)) return
    await deleteProfile(p.id)
    const remaining = profiles.filter((x) => x.id !== p.id)
    setCurrent(remaining[0]?.id ?? null)
    navigate('/')
  }

  return (
    <Screen eyebrow="Adjust your path" title="Settings"
      action={<button className="btn btn-sm btn-primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>}>
      {cloudEnabled && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="eyebrow">Account</div>
          {session ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14 }}>{session.user.email}</span>
                <span className="tag" style={{ color: sync.online ? 'var(--moss)' : 'var(--text-dim)' }}>
                  {sync.pending > 0 ? `${sync.pending} to sync` : sync.online ? 'Backed up ✓' : 'Offline'}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                onClick={async () => { await signOut(); setOffline(false) }}>Sign out</button>
            </>
          ) : (
            <>
              <div className="muted" style={{ fontSize: 13 }}>Not signed in — data is only on this device.</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => setOffline(false)}>Sign in to back up</button>
            </>
          )}
        </div>
      )}
      <div className="card center-col">
        <Field label="Character name">
          <input value={p.characterName} onChange={(e) => { set('characterName', e.target.value); set('name', e.target.value) }} />
        </Field>
        <Field label="Goal">
          <Chips<Goal> value={p.goal} onChange={(v) => set('goal', v)} options={[
            { value: 'strength', label: 'Strength' }, { value: 'muscle', label: 'Muscle' },
            { value: 'fatloss', label: 'Fat Loss' }, { value: 'other', label: 'Other' },
          ]} />
        </Field>
        {p.goal === 'other' && (
          <Field label="Describe your goal">
            <input value={p.goalOther ?? ''} onChange={(e) => set('goalOther', e.target.value)} />
          </Field>
        )}
        <Field label="Experience">
          <Chips<Experience> value={p.experience} onChange={(v) => set('experience', v)} options={[
            { value: 'beginner', label: 'Novice' }, { value: 'intermediate', label: 'Adept' }, { value: 'advanced', label: 'Veteran' },
          ]} />
        </Field>
        <Field label={`Days per week: ${p.frequency}`}>
          <input type="range" min={2} max={6} value={p.frequency} onChange={(e) => set('frequency', Number(e.target.value))} />
        </Field>
        <Field label="Session length">
          <div className="row">
            <Chips value={String(p.sessionMinutes)} onChange={(v) => set('sessionMinutes', Number(v))}
              options={[{ value: '40', label: '40' }, { value: '60', label: '60' }, { value: '80', label: '80' }]} />
            <input style={{ width: 80 }} type="number" value={p.sessionMinutes} onChange={(e) => set('sessionMinutes', Number(e.target.value) || 60)} />
          </div>
        </Field>
        <Field label="Focus">
          <div className="chips">
            <button className="chip" aria-pressed={p.focus === null} onClick={() => set('focus', null)}>Balanced</button>
            {(['chest', 'back', 'arms', 'shoulders', 'legs', 'core'] as MuscleFocus[]).map((f) => (
              <button key={f} className="chip" aria-pressed={p.focus === f} onClick={() => set('focus', f)}>{f}</button>
            ))}
          </div>
        </Field>
        <Field label="Location">
          <Chips<LocationId> value={p.location} onChange={(v) => set('location', v)}
            options={[{ value: 'gym', label: 'Apartment Gym' }, { value: 'studio', label: 'Home Studio' }]} />
        </Field>
      </div>

      <div className="card center-col" style={{ marginTop: 12 }}>
        <div className="eyebrow">Fine-tuning</div>
        <Field label="Conditioning / cardio">
          <Chips<CardioLevel> value={p.cardio} onChange={(v) => set('cardio', v)} options={[
            { value: 'none', label: 'None' }, { value: 'light', label: 'Light' },
            { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' },
          ]} />
        </Field>
        <Field label="Program split">
          <Chips<SplitStyle> value={p.splitStyle} onChange={(v) => set('splitStyle', v)} options={[
            { value: 'auto', label: 'Auto' }, { value: 'fullbody', label: 'Full Body' },
            { value: 'upperlower', label: 'Upper/Lower' }, { value: 'ppl', label: 'PPL' },
          ]} />
        </Field>
        <Field label="Effort target (reps in reserve)">
          <Chips value={String(p.rirTarget)} onChange={(v) => set('rirTarget', Number(v))}
            options={[{ value: '1', label: '1 (hard)' }, { value: '2', label: '2' }, { value: '3', label: '3 (easy)' }]} />
        </Field>
        <Field label="Deload reminder">
          <Chips value={String(p.deloadWeeks)} onChange={(v) => set('deloadWeeks', Number(v))}
            options={[{ value: '0', label: 'Off' }, { value: '6', label: '6 wks' }, { value: '8', label: '8 wks' }, { value: '12', label: '12 wks' }]} />
        </Field>
        <Field label="Avoid these muscles (injuries)">
          <div className="chips">
            {ALL_MUSCLES.map((m) => (
              <button key={m} className="chip" aria-pressed={p.avoidMuscles.includes(m)} onClick={() => toggleAvoid(m)}>{MUSCLE_LABEL[m]}</button>
            ))}
          </div>
        </Field>
        <div className="grid-2">
          <button className="chip" aria-pressed={p.warmup} onClick={() => set('warmup', !p.warmup)}>Warm-up sets {p.warmup ? 'on' : 'off'}</button>
          <button className="chip" aria-pressed={p.restAutostart} onClick={() => set('restAutostart', !p.restAutostart)}>Auto rest timer {p.restAutostart ? 'on' : 'off'}</button>
          <button className="chip" aria-pressed={p.sound} onClick={() => set('sound', !p.sound)}>Timer sound {p.sound ? 'on' : 'off'}</button>
          <button className="chip" aria-pressed={p.units === 'kg'} onClick={() => set('units', p.units === 'kg' ? 'lb' : 'kg')}>Units: {p.units}</button>
        </div>
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={save}>{saved ? 'Saved ✓' : 'Save changes'}</button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8, color: 'var(--danger)' }} onClick={remove}>Delete this adventurer</button>
      <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 16 }}>
        Exercise animations from the open <b>hasaneyldrm/exercises-dataset</b>, bundled for offline use.
      </p>
    </Screen>
  )
}

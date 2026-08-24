import type { ReactNode } from 'react'
import type { Goal, PrescribedExercise } from '../domain/types'
import { EXERCISES_BY_ID } from '../data/exercises'

export const GOAL_LABEL: Record<Goal, string> = {
  strength: 'Gain Strength',
  muscle: 'Build Muscle',
  fatloss: 'Fat Loss',
  other: 'Custom Quest',
}

export function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** How to describe a prescribed load in the UI. */
export function loadLabel(pe: PrescribedExercise, load: number | null): string {
  if (pe.kind === 'conditioning') return 'effort'
  const basis = EXERCISES_BY_ID[pe.exerciseId]?.loadBasis
  if (load == null || basis === 'bodyweight') return 'Bodyweight'
  return basis === 'per-hand' ? `${load} lb/hand` : `${load} lb`
}

export function repLabel(pe: PrescribedExercise, reps: [number, number]): string {
  if (pe.kind === 'conditioning') return 'rounds'
  return reps[0] === reps[1] ? `${reps[0]} reps` : `${reps[0]}–${reps[1]} reps`
}

export function Bar({ value, max, variant }: { value: number; max: number; variant?: 'vol' | 'over' }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  const cls = variant === 'over' ? 'bar bar-over' : variant === 'vol' ? 'bar bar-vol' : 'bar'
  return <div className={cls}><i style={{ width: `${pct}%` }} /></div>
}

export function Chips<T extends string>({
  options, value, onChange, columns,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  columns?: boolean
}) {
  return (
    <div className="chips" style={columns ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Screen({ title, eyebrow, children, action }: {
  title: string; eyebrow?: string; children: ReactNode; action?: ReactNode
}) {
  return (
    <div className="screen fade-in">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

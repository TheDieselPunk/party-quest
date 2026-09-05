import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GuidedStep, Profile } from '../domain/types'
import { ATTRIBUTE_LABEL } from '../domain/types'
import { useSession } from '../store/session'
import { logOffDaySession } from '../db/repo'
import type { SessionRewards } from '../rpg/character'
import { fmtSeconds } from './common'

const KIND_ICON: Record<string, string> = { mobility: '🧘', run: '🏃', ruck: '🎒' }

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(); osc.stop(ctx.currentTime + 0.5)
    setTimeout(() => ctx.close(), 700)
  } catch { /* no audio */ }
}

/** Split per-side timed holds into two consecutive steps. */
function expand(steps: GuidedStep[]): GuidedStep[] {
  const out: GuidedStep[] = []
  for (const s of steps) {
    if (s.perSide && s.seconds) {
      out.push({ ...s, label: `${s.label} · left`, perSide: false })
      out.push({ ...s, label: `${s.label} · right`, perSide: false })
    } else out.push(s)
  }
  return out
}

export function GuidedSession({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const pending = useSession((s) => s.pendingGuided)
  const setPending = useSession((s) => s.setPendingGuided)

  const steps = useMemo(() => (pending?.steps ? expand(pending.steps) : []), [pending])
  const [i, setI] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState<SessionRewards | null>(null)
  const [finishing, setFinishing] = useState(false)
  const endRef = useRef(0)

  useEffect(() => {
    // Redirect only if there was never a session — not after finishing (which
    // clears `pending` but shows the completion screen via `done`).
    if (!pending && !done) navigate('/plan', { replace: true })
  }, [pending, done, navigate])

  const step: GuidedStep | undefined = steps[i]
  const isLast = i >= steps.length - 1

  // (Re)initialise the timer whenever the step changes.
  useEffect(() => {
    if (!step) return
    if (step.seconds != null) {
      endRef.current = Date.now() + step.seconds * 1000
      setRemaining(step.seconds)
    } else {
      setRemaining(null)
    }
    setPaused(false)
  }, [i, step])

  // Countdown for timed steps; auto-advances (or stops on the last step).
  useEffect(() => {
    if (!step || step.seconds == null || paused || done) return
    const id = setInterval(() => {
      const left = Math.round((endRef.current - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(id)
        beep()
        if ('vibrate' in navigator) navigator.vibrate?.(150)
        if (!isLast) setTimeout(() => setI((c) => Math.min(c + 1, steps.length - 1)), 500)
      }
    }, 250)
    return () => clearInterval(id)
  }, [i, step, paused, done, isLast, steps.length])

  function togglePause() {
    if (paused) { endRef.current = Date.now() + (remaining ?? 0) * 1000; setPaused(false) } else setPaused(true)
  }

  async function finish() {
    if (!pending || finishing) return
    setFinishing(true)
    const kind = pending.kind as 'mobility' | 'run' | 'ruck'
    const rewards = await logOffDaySession(profile, {
      kind, title: pending.title, minutes: pending.estMinutes, objectiveId: pending.objectiveId,
    })
    // Keep `pending` set so the completion screen can read it; it's cleared when
    // the user leaves via the buttons below.
    setDone(rewards)
  }

  function leave(to: string) {
    setPending(null)
    navigate(to)
  }

  if (!pending) return null

  // --- completion screen ----------------------------------------------------
  if (done) {
    const gained = Object.entries(done.xpGained).filter(([, v]) => v > 0)
    return (
      <div className="screen fade-in" style={{ textAlign: 'center', paddingTop: 40 }}>
        <div style={{ fontSize: 54 }}>{KIND_ICON[pending.kind] ?? '✅'}</div>
        <h1 style={{ margin: '8px 0' }}>Session complete!</h1>
        <div className="muted" style={{ marginBottom: 16 }}>{pending.title} · +{done.totalXp} XP</div>
        <div className="card" style={{ textAlign: 'left', maxWidth: 340, margin: '0 auto' }}>
          {gained.map(([a, v]) => (
            <div key={a} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontWeight: 600 }}>{ATTRIBUTE_LABEL[a as keyof typeof ATTRIBUTE_LABEL]}</span>
              <span className="muted">+{v} XP</span>
            </div>
          ))}
          {done.levelUps.map((l) => (
            <div key={l.attribute} style={{ color: 'var(--gold)', fontWeight: 700, marginTop: 6 }}>
              ⬆ {ATTRIBUTE_LABEL[l.attribute]} reached Lv {l.to}!
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => leave('/plan')}>Back to plan</button>
          <button className="btn btn-primary" onClick={() => leave('/')}>Done</button>
        </div>
      </div>
    )
  }

  // --- guided player --------------------------------------------------------
  const timed = step?.seconds != null
  return (
    <div className="screen fade-in">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="eyebrow">{KIND_ICON[pending.kind] ?? ''} {pending.detail}</div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{pending.title}</h1>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => { setPending(null); navigate('/plan') }}>Exit</button>
      </div>

      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Step {i + 1} of {steps.length}</div>
      <div className="bar bar-vol" style={{ marginBottom: 16 }}><i style={{ width: `${((i) / Math.max(1, steps.length)) * 100}%` }} /></div>

      <div className="card center-col" style={{ alignItems: 'center', textAlign: 'center', padding: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24 }}>{step?.label}</div>
        {timed ? (
          <div className="big-num" style={{ fontSize: 52, color: (remaining ?? 0) <= 0 ? 'var(--moss)' : 'var(--gold-soft)', margin: '6px 0' }}>
            {(remaining ?? 0) <= 0 ? 'Done!' : fmtSeconds(Math.max(0, remaining ?? 0))}
          </div>
        ) : (
          <div className="big-num" style={{ fontSize: 44, color: 'var(--gold-soft)', margin: '6px 0' }}>
            {step?.reps} {step?.perSide ? 'reps/side' : 'reps'}
          </div>
        )}
        {step?.instruction && <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{step.instruction}</p>}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI((c) => Math.max(0, c - 1))}>← Back</button>
        {timed && <button className="btn btn-ghost" style={{ flex: 1 }} onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>}
        {!isLast ? (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setI((c) => Math.min(steps.length - 1, c + 1))}>
            {timed ? 'Skip →' : 'Done →'}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={finishing} onClick={finish}>
            {finishing ? 'Saving…' : 'Finish ✓'}
          </button>
        )}
      </div>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 10, color: 'var(--text-dim)' }} disabled={finishing} onClick={finish}>
        End &amp; log now
      </button>
    </div>
  )
}

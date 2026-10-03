import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile, PrescribedExercise, LoggedSet } from '../domain/types'
import type { ActiveWorkout } from '../domain/active'
import { elapsedMs } from '../domain/active'
import { db } from '../db/db'
import { saveActive, swapExercise, finishWorkout, discardActive } from '../db/repo'
import { EXERCISES_BY_ID } from '../data/exercises'
import { loadEntryFor, repMeaning } from '../data/loadEntry'
import { machinePhoto } from '../data/machinePhotos'
import { gifFor } from '../data/gifs'
import { WARMUP_SET_REST_SECONDS } from '../engine/params'
import type { SessionRewards } from '../rpg/character'
import { RestTimer } from './RestTimer'
import { RewardsModal } from './Rewards'
import { useWakeLock } from './useWakeLock'
import { loadLabel, repLabel, fmtSeconds, fmtLoad } from './common'

interface Block { group: number | null; indices: number[] }

/**
 * Keep only what a number can contain, so a stray keystroke (a comma or dash
 * from the phone's number pad) can never turn into NaN.
 */
function sanitizeNumeric(raw: string, decimals: boolean): string {
  if (!decimals) return raw.replace(/[^0-9]/g, '')
  const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '')
  const dot = cleaned.indexOf('.')
  return dot < 0 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')
}

function parseNumOrNull(text: string): number | null {
  if (text === '' || text === '.') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/**
 * A set-table number cell. While focused it edits a local string (so "37." or
 * an empty field survive mid-typing); every keystroke commits a sanitized
 * number (or null) upward, and on blur it re-syncs to the stored value.
 */
function NumberCell({ value, onCommit, placeholder, decimals = false, label }: {
  value: number | null
  onCommit: (v: number | null) => void
  placeholder?: string
  decimals?: boolean
  label: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value != null && Number.isFinite(value) ? String(value) : '')
  return (
    <input className="pill-input" inputMode={decimals ? 'decimal' : 'numeric'} aria-label={label}
      value={shown} placeholder={placeholder}
      onFocus={() => setDraft(shown)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = sanitizeNumeric(e.target.value, decimals)
        setDraft(text)
        onCommit(parseNumOrNull(text))
      }} />
  )
}

function buildBlocks(exercises: PrescribedExercise[]): Block[] {
  const blocks: Block[] = []
  for (let i = 0; i < exercises.length; i++) {
    const g = exercises[i].supersetGroup ?? null
    const last = blocks[blocks.length - 1]
    if (g != null && last && last.group === g) last.indices.push(i)
    else blocks.push({ group: g, indices: [i] })
  }
  return blocks
}

const doneWorking = (logs: LoggedSet[]) => logs.filter((s) => s.done && !s.warmup).length

/** Every working set of every exercise in the block is checked off. */
function blockComplete(block: Block, logs: LoggedSet[][]): boolean {
  return block.indices.every((i) => {
    const working = logs[i].filter((s) => !s.warmup)
    return working.length > 0 && working.every((s) => s.done)
  })
}

/** One-line recap for a finished exercise's collapsed bar, e.g. "3 × 10 · 85 lb". */
function recap(pe: PrescribedExercise, logs: LoggedSet[]): string {
  const done = logs.filter((s) => s.done && !s.warmup)
  if (!done.length) return 'done'
  if (pe.kind === 'conditioning') return `${done.length} rounds`
  const reps = done.map((s) => s.reps)
  const repsStr = reps.every((r) => r === reps[0]) ? `${done.length} × ${reps[0]}` : `${done.length} sets · ${reps.join('/')}`
  const loads = [...new Set(done.map((s) => s.load))]
  const loadStr = loads.length === 1 ? fmtLoad(pe.exerciseId, loads[0]) : `up to ${fmtLoad(pe.exerciseId, Math.max(...loads.map((l) => l ?? 0)))}`
  return `${repsStr} · ${loadStr}`
}

export function WorkoutPlayer({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [active, setActive] = useState<ActiveWorkout | null | undefined>(undefined)
  const [timer, setTimer] = useState<{ key: number; seconds: number; label: string } | null>(null)
  const [rewards, setRewards] = useState<SessionRewards | null>(null)
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  /** Finished blocks the trainee re-opened (finished blocks collapse by default). */
  const [reopened, setReopened] = useState<Set<number>>(new Set())

  useEffect(() => { db.active.get(profile.id).then((a) => setActive(a ?? null)) }, [profile.id])
  useEffect(() => {
    if (!active) return
    const tick = () => setElapsed(Math.floor(elapsedMs(active) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])

  const blocks = useMemo(() => (active ? buildBlocks(active.plan.exercises) : []), [active])

  // Keep the screen awake while an actual workout is loaded, so the rest timer
  // and its alert keep running when you set the phone down between sets.
  useWakeLock((profile.keepAwake ?? true) && !!active)

  if (active === undefined) return <div className="screen">Loading…</div>
  if (active === null) {
    return (
      <div className="screen center-col">
        <p className="muted">No workout in progress.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to the tavern</button>
      </div>
    )
  }

  const plan = active.plan
  const totalSets = active.logs.reduce((n, l) => n + l.filter((s) => !s.warmup).length, 0)
  const doneSets = active.logs.reduce((n, l) => n + doneWorking(l), 0)

  function persist(next: ActiveWorkout) { setActive(next); void saveActive(next) }

  const paused = active?.pausedAt != null

  /** Fields that resume a paused timer (banking the paused span); empty if running. */
  function resumeFields(a: ActiveWorkout): Partial<ActiveWorkout> {
    return a.pausedAt != null
      ? { pausedTotalMs: (a.pausedTotalMs ?? 0) + (Date.now() - a.pausedAt), pausedAt: undefined }
      : {}
  }

  function togglePause() {
    if (!active) return
    if (active.pausedAt != null) persist({ ...active, ...resumeFields(active) })
    else persist({ ...active, pausedAt: Date.now() })
  }

  function withSet(logs: LoggedSet[][], exIdx: number, setIdx: number, patch: Partial<LoggedSet>): LoggedSet[][] {
    return logs.map((l, i) => (i === exIdx ? l.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) : l))
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<LoggedSet>) {
    if (!active) return
    // Logging a set means you're training again — auto-resume if paused.
    persist({ ...active, logs: withSet(active.logs, exIdx, setIdx, patch), ...resumeFields(active) })
  }

  /** Why a set can't be checked off yet (null = it can). Junk sets never reach history. */
  function blockReason(pe: PrescribedExercise, s: LoggedSet): string | null {
    const showLoad = loadEntryFor(pe.exerciseId).mode !== 'bodyweight' && pe.kind !== 'conditioning'
    if (showLoad && (s.load == null || !Number.isFinite(s.load) || s.load <= 0)) return 'Enter a weight before checking off this set'
    if (!Number.isFinite(s.reps) || s.reps <= 0) return 'Enter your reps before checking off this set'
    return null
  }

  /** The rest that follows a just-completed set, given the logs after it was checked. */
  function restAfter(exIdx: number, setIdx: number, logs: LoggedSet[][]): { seconds: number; label: string } {
    const pe = plan.exercises[exIdx]
    if (logs[exIdx][setIdx].warmup) return { seconds: WARMUP_SET_REST_SECONDS, label: `Ramp-up set done — next set of ${pe.name}` }

    const partners = pe.supersetGroup != null
      ? plan.exercises.map((x, i) => ({ x, i })).filter(({ x, i }) => i !== exIdx && x.supersetGroup === pe.supersetGroup)
      : []
    if (partners.length && pe.transitionSeconds != null) {
      // Mid-round: a partner hasn't done this round yet → quick transition to it.
      const mine = doneWorking(logs[exIdx])
      const behind = partners.find(({ i }) => doneWorking(logs[i]) < mine && doneWorking(logs[i]) < logs[i].filter((s) => !s.warmup).length)
      if (behind) return { seconds: pe.transitionSeconds, label: `Superset → ${behind.x.name}` }
      // Round complete → full rest before the next round.
      const rest = Math.max(pe.restSeconds, ...partners.map(({ x }) => x.restSeconds))
      return { seconds: rest, label: 'Superset round done — rest, then go again' }
    }

    const remaining = logs[exIdx].filter((s) => !s.done && !s.warmup).length
    if (remaining > 0) return { seconds: pe.restSeconds, label: `Before your next set of ${pe.name}` }
    const next = plan.exercises.slice(exIdx + 1).find((_, k) => logs[exIdx + 1 + k].some((s) => !s.done))
    return { seconds: pe.restSeconds, label: next ? `Next up: ${next.name}` : 'Last set done — finish strong!' }
  }

  function markDone(exIdx: number, setIdx: number) {
    if (!active) return
    const pe = plan.exercises[exIdx]
    const set = active.logs[exIdx][setIdx]
    const nowDone = !set.done
    if (nowDone && blockReason(pe, set)) return
    const logs = withSet(active.logs, exIdx, setIdx, { done: nowDone })
    persist({ ...active, logs, ...resumeFields(active) })
    // Every completed set (warm-ups included) pops the rest timer — nothing
    // else (like a blank RIR) gates it.
    if (nowDone && profile.restAutostart) {
      const r = restAfter(exIdx, setIdx, logs)
      setTimer({ key: Date.now(), ...r })
    }
  }

  async function onSwap(exIdx: number, altId: string) {
    if (!active) return
    const next = await swapExercise(profile, active, exIdx, altId)
    setActive(next)
  }

  async function finish() {
    if (!active) return
    setTimer(null)
    const r = await finishWorkout(profile, active)
    setRewards(r)
  }

  async function abandon() {
    if (!active) return
    if (!confirm('Abandon this quest? Logged sets will be discarded.')) return
    await discardActive(profile.id)
    navigate('/')
  }

  function toggleReopen(bi: number) {
    setReopened((prev) => {
      const next = new Set(prev)
      if (next.has(bi)) next.delete(bi)
      else next.add(bi)
      return next
    })
  }

  const gridCols = '26px 1fr 1fr 46px 44px'

  return (
    <div className="screen fade-in" style={{ paddingBottom: timer ? 190 : undefined }}>
      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="btn btn-sm btn-ghost" onClick={abandon}>✕</button>
        <button onClick={togglePause} title={paused ? 'Resume workout' : 'Pause workout'}
          style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'center', cursor: 'pointer', padding: 0 }}>
          <div className="eyebrow" style={{ margin: 0 }}>{plan.busy ? 'Busy — 1-machine supersets' : 'Quiet — cross-machine supersets'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: paused ? 'var(--gold)' : 'inherit' }}>
            {paused ? '⏸ ' : ''}{fmtSeconds(elapsed)}
          </div>
          <div className="eyebrow" style={{ margin: 0, color: paused ? 'var(--gold)' : 'var(--text-dim)', fontSize: 9 }}>
            {paused ? 'paused — tap to resume' : 'tap to pause'}
          </div>
        </button>
        <button className="btn btn-sm btn-primary" onClick={finish}>Finish</button>
      </div>
      <h1 style={{ fontSize: 20, margin: '0 0 2px' }}>{plan.title}</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {doneSets}/{totalSets} sets · ~{plan.estMinutes} min planned
      </div>
      <div className="bar bar-vol" style={{ marginBottom: 10 }}><i style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>

      <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.45 }}>
        <b>RIR</b> = reps in reserve — how many more reps you could’ve done before failing (0 = to failure).
        Optional: it gates weight increases (leave blank to just use your reps). Aim for about <b>{profile.rirTarget}</b>.
      </div>

      {plan.warmup.length > 0 && (
        <details className="card" style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔥 Warm-up</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }} className="muted">
            {plan.warmup.map((w, i) => <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{w}</li>)}
          </ul>
        </details>
      )}

      {blocks.map((block, bi) => {
        const isSuper = block.group != null && block.indices.length > 1
        const complete = blockComplete(block, active.logs)

        // Finished: collapse to a slim bar with a green check (tap to re-open).
        if (complete && !reopened.has(bi)) {
          return (
            <button key={bi} className="card done-bar fade-in" onClick={() => toggleReopen(bi)}
              aria-label={`${block.indices.map((i) => plan.exercises[i].name).join(' and ')} complete — tap to show sets`}>
              <span className="done-check">✓</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isSuper ? '⚡ ' : ''}{block.indices.map((i) => plan.exercises[i].name).join(' + ')}
                </span>
                <span className="muted" style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {block.indices.map((i) => recap(plan.exercises[i], active.logs[i])).join('  ·  ')}
                </span>
              </span>
              <span className="muted" style={{ fontSize: 12 }}>▼</span>
            </button>
          )
        }

        return (
        <div key={bi} style={{ marginBottom: 14 }}>
          {isSuper && (
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="tag tag-super">⚡ Superset · {plan.exercises[block.indices[0]].supersetKind === 'same-unit' ? 'same machine' : 'antagonist'}</span>
              <span className="muted" style={{ fontSize: 12 }}>alternate the moves, then rest</span>
            </div>
          )}
          {complete && (
            <button className="card done-bar" style={{ marginBottom: 6 }} onClick={() => toggleReopen(bi)}>
              <span className="done-check">✓</span>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Done — tap to collapse</span>
              <span className="muted" style={{ fontSize: 12 }}>▲</span>
            </button>
          )}
          <div className="card" style={{ borderColor: isSuper ? 'var(--gold)' : undefined, padding: 0 }}>
            {block.indices.map((exIdx, k) => {
              const pe = plan.exercises[exIdx]
              const meta = EXERCISES_BY_ID[pe.exerciseId]
              const entry = loadEntryFor(pe.exerciseId)
              const showLoad = entry.mode !== 'bodyweight' && pe.kind !== 'conditioning'
              const isCalib = pe.sets.some((s) => s.calibration)
              const gif = gifFor(pe.exerciseId)
              const photoSrc = machinePhoto(pe.equipmentId)
              const repNote = pe.kind !== 'conditioning' ? repMeaning(pe.exerciseId) : null
              const showHowTo = showLoad && (entry.mode === 'per-hand' || entry.mode === 'one-dumbbell' || entry.mode === 'per-side' || entry.mode === 'bar-total' || pe.equipmentId === 'hoist-hd3000')
              const repsHeader = pe.kind === 'conditioning' ? 'Min/Rnds' : meta?.timed ? 'Sec' : meta?.perSide ? 'Reps/side' : 'Reps'
              return (
                <div key={exIdx} style={{ padding: 14, borderTop: k > 0 ? '1px dashed var(--edge)' : undefined }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
                      {gif && (
                        <img src={gif} alt={`${pe.name} demo`} loading="lazy" onClick={() => setZoom({ src: gif, name: pe.name })}
                          style={{ width: 58, height: 58, borderRadius: 10, objectFit: 'cover', background: '#efe9dc', cursor: 'zoom-in', flexShrink: 0, border: '1px solid var(--edge)' }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{pe.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {pe.equipmentName}{pe.modeName ? ` · ${pe.modeName} mode` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="center-col" style={{ gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                      {pe.kind !== 'conditioning' && (
                        <span className="tag">{repLabel(pe, pe.sets.find((s) => !s.warmup)?.reps ?? [0, 0])} · {Math.round(pe.restSeconds / 15) * 15 / 60 >= 1 ? `${(pe.restSeconds / 60).toFixed(1)}m` : `${pe.restSeconds}s`} rest</span>
                      )}
                      {pe.modeGrip && (
                        <span className="tag" style={{ color: 'var(--sky)', borderColor: '#33637a' }}>
                          {pe.modeGrip === 'vertical' ? '⭿' : '⭤'} {pe.modeGrip} handles
                        </span>
                      )}
                    </div>
                  </div>

                  {meta?.attachment && (
                    <div className="attach-line">🔗 <b>Attachment:</b> {meta.attachment}</div>
                  )}

                  {photoSrc && (
                    <div className="row" style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
                      <img src={photoSrc} alt={pe.equipmentName} loading="lazy" onClick={() => setZoom({ src: photoSrc, name: pe.equipmentName })}
                        style={{ width: 66, height: 66, borderRadius: 10, objectFit: 'contain', background: '#efe9dc', cursor: 'zoom-in', border: '1px solid var(--edge)', flexShrink: 0 }} />
                      <span className="muted" style={{ fontSize: 12 }}>📷 {pe.equipmentName} — tap to enlarge</span>
                    </div>
                  )}

                  {pe.modeSetup && (
                    <div style={{ marginTop: 8, fontSize: 13, background: '#0000002e', borderRadius: 10, padding: '8px 10px', borderLeft: '3px solid var(--gold)' }}>
                      <b style={{ color: 'var(--gold-soft)' }}>Set up:</b> {pe.modeSetup}
                    </div>
                  )}
                  {pe.cues && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>💡 {pe.cues}</div>}
                  {repNote && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>🔁 <b style={{ color: 'var(--text)' }}>Counting reps:</b> {repNote}</div>}
                  {showHowTo && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>⚖️ <b style={{ color: 'var(--text)' }}>Logging weight:</b> {entry.howTo}</div>}

                  {/* why this weight — the engine's recommendation reason */}
                  {showLoad && pe.rationale && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
                      {isCalib && (
                        <span style={{ display: 'inline-block', background: '#00000030', borderRadius: 8, padding: '2px 7px', color: 'var(--gold-soft)', fontWeight: 700, marginRight: 6 }}>
                          ≈ Estimate
                        </span>
                      )}
                      {pe.sets.find((s) => !s.warmup)?.load != null && <b style={{ color: 'var(--text)' }}>{loadLabel(pe, pe.sets.find((s) => !s.warmup)!.load)} — </b>}
                      {pe.rationale}
                    </div>
                  )}

                  {/* set table */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, fontSize: 11, color: 'var(--text-dim)', padding: '0 2px 4px', fontWeight: 700 }}>
                      <span>#</span><span>{showLoad ? (entry.unit === 'lb' ? 'Weight' : entry.unit) : 'Type'}</span><span>{repsHeader}</span><span>RIR</span><span>✓</span>
                    </div>
                    {active.logs[exIdx].map((s, setIdx) => {
                      const why = !s.done ? blockReason(pe, s) : null
                      const rx = pe.sets[setIdx]
                      return (
                        <div key={setIdx} className={`set-row ${s.done ? 'done' : ''}`} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.warmup ? 'W' : pe.sets.filter((_, j) => j <= setIdx && !pe.sets[j].warmup).length}</span>
                          {showLoad ? (
                            <div>
                              <NumberCell decimals label={`Weight (${entry.unit})`}
                                value={s.load != null && Number.isFinite(s.load) ? entry.toInput(s.load) : null}
                                placeholder={rx?.load != null ? String(entry.toInput(rx.load)) : '0'}
                                onCommit={(v) => updateSet(exIdx, setIdx, { load: v == null ? null : entry.fromInput(v) })} />
                              {entry.mode === 'per-side' && s.load != null && Number.isFinite(s.load) && (
                                <div className="muted" style={{ fontSize: 10, textAlign: 'center', marginTop: 2 }}>= {s.load} lb total</div>
                              )}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>BW</span>
                          )}
                          <NumberCell label={repsHeader} value={s.reps}
                            onCommit={(v) => updateSet(exIdx, setIdx, { reps: v ?? 0 })} />
                          <NumberCell label="Reps in reserve" value={s.rir} placeholder="–"
                            onCommit={(v) => updateSet(exIdx, setIdx, { rir: v })} />
                          <button className="btn btn-sm" disabled={!!why} title={why ?? undefined}
                            style={s.done ? { background: 'var(--moss)', color: '#10240c', borderColor: '#4c7a3f' } : undefined}
                            onClick={() => markDone(exIdx, setIdx)}>{s.done ? '✓' : ''}</button>
                        </div>
                      )
                    })}
                  </div>

                  {/* swap / alternatives */}
                  {pe.altIds.length > 0 && (
                    <div className="row" style={{ marginTop: 6, gap: 8 }}>
                      <span className="tag tag-alt">Machine busy?</span>
                      <select value="" onChange={(e) => e.target.value && onSwap(exIdx, e.target.value)} style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}>
                        <option value="">Swap to…</option>
                        {pe.altIds.map((id) => (
                          <option key={id} value={id}>{EXERCISES_BY_ID[id]?.name ?? id}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )
      })}

      <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={finish}>🏆 Finish quest</button>

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <img src={zoom.src} alt={zoom.name} style={{ width: '98vw', height: '82vh', objectFit: 'contain', borderRadius: 16, background: '#efe9dc' }} />
          <div style={{ color: '#fff', marginTop: 10, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{zoom.name}</div>
          <div style={{ color: '#bbb', marginTop: 2, fontSize: 12 }}>tap anywhere to close</div>
        </div>
      )}

      {timer && <RestTimer key={timer.key} seconds={timer.seconds} label={timer.label} sound={profile.sound} onClose={() => setTimer(null)} />}
      {rewards && <RewardsModal rewards={rewards} onClose={() => navigate('/')} />}
    </div>
  )
}

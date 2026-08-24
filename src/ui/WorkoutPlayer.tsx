import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile, PrescribedExercise } from '../domain/types'
import type { ActiveWorkout } from '../domain/active'
import { db } from '../db/db'
import { saveActive, swapExercise, finishWorkout, discardActive } from '../db/repo'
import { EXERCISES_BY_ID } from '../data/exercises'
import { gifFor } from '../data/gifs'
import type { SessionRewards } from '../rpg/character'
import { RestTimer } from './RestTimer'
import { RewardsModal } from './Rewards'
import { loadLabel, repLabel, fmtSeconds } from './common'

interface Block { group: number | null; indices: number[] }

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

export function WorkoutPlayer({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [active, setActive] = useState<ActiveWorkout | null | undefined>(undefined)
  const [timer, setTimer] = useState<{ key: number; seconds: number; label: string } | null>(null)
  const [rewards, setRewards] = useState<SessionRewards | null>(null)
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => { db.active.get(profile.id).then((a) => setActive(a ?? null)) }, [profile.id])
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - active.startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [active])

  const blocks = useMemo(() => (active ? buildBlocks(active.plan.exercises) : []), [active])

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
  const doneSets = active.logs.reduce((n, l) => n + l.filter((s) => s.done && !s.warmup).length, 0)

  function persist(next: ActiveWorkout) { setActive(next); void saveActive(next) }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<ActiveWorkout['logs'][0][0]>) {
    if (!active) return
    const logs = active.logs.map((l, i) => (i === exIdx ? l.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) : l))
    persist({ ...active, logs })
  }

  function markDone(exIdx: number, setIdx: number) {
    if (!active) return
    const set = active.logs[exIdx][setIdx]
    const nowDone = !set.done
    updateSet(exIdx, setIdx, { done: nowDone })
    if (nowDone && profile.restAutostart && !set.warmup) {
      const pe = plan.exercises[exIdx]
      const inSuper = pe.supersetGroup != null && pe.transitionSeconds != null
      const partner = inSuper
        ? plan.exercises.find((x, i) => i !== exIdx && x.supersetGroup === pe.supersetGroup)
        : undefined
      setTimer({
        key: Date.now(),
        seconds: inSuper ? pe.transitionSeconds! : pe.restSeconds,
        label: inSuper && partner ? `Superset → ${partner.name}` : `Before your next set`,
      })
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

  const gridCols = '26px 1fr 1fr 46px 44px'

  return (
    <div className="screen fade-in" style={{ paddingBottom: timer ? 150 : undefined }}>
      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="btn btn-sm btn-ghost" onClick={abandon}>✕</button>
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow" style={{ margin: 0 }}>{plan.busy ? 'Busy mode' : 'Quiet — supersets on'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{fmtSeconds(elapsed)}</div>
        </div>
        <button className="btn btn-sm btn-primary" onClick={finish}>Finish</button>
      </div>
      <h1 style={{ fontSize: 20, margin: '0 0 2px' }}>{plan.title}</h1>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {doneSets}/{totalSets} sets · ~{plan.estMinutes} min planned
      </div>
      <div className="bar bar-vol" style={{ marginBottom: 14 }}><i style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>

      {plan.warmup.length > 0 && (
        <details className="card" style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔥 Warm-up</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }} className="muted">
            {plan.warmup.map((w, i) => <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{w}</li>)}
          </ul>
        </details>
      )}

      {blocks.map((block, bi) => (
        <div key={bi} style={{ marginBottom: 14 }}>
          {block.group != null && block.indices.length > 1 && (
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="tag tag-super">⚡ Superset · {plan.exercises[block.indices[0]].supersetKind === 'same-unit' ? 'same machine' : 'antagonist'}</span>
              <span className="muted" style={{ fontSize: 12 }}>alternate the moves, then rest</span>
            </div>
          )}
          <div className="card" style={{ borderColor: block.group != null && block.indices.length > 1 ? 'var(--gold)' : undefined, padding: 0 }}>
            {block.indices.map((exIdx, k) => {
              const pe = plan.exercises[exIdx]
              const meta = EXERCISES_BY_ID[pe.exerciseId]
              const showLoad = meta?.loadBasis !== 'bodyweight' && pe.kind !== 'conditioning'
              const gif = gifFor(pe.exerciseId)
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
                    {pe.kind !== 'conditioning' && (
                      <span className="tag" style={{ flexShrink: 0 }}>{repLabel(pe, pe.sets.find((s) => !s.warmup)?.reps ?? [0, 0])} · {Math.round(pe.restSeconds / 15) * 15 / 60 >= 1 ? `${(pe.restSeconds / 60).toFixed(1)}m` : `${pe.restSeconds}s`} rest</span>
                    )}
                  </div>

                  {pe.modeSetup && (
                    <div style={{ marginTop: 8, fontSize: 13, background: '#0000002e', borderRadius: 10, padding: '8px 10px', borderLeft: '3px solid var(--gold)' }}>
                      <b style={{ color: 'var(--gold-soft)' }}>Set up:</b> {pe.modeSetup}
                    </div>
                  )}
                  {pe.cues && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>💡 {pe.cues}</div>}

                  {/* set table */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, fontSize: 11, color: 'var(--text-dim)', padding: '0 2px 4px', fontWeight: 700 }}>
                      <span>#</span><span>{showLoad ? 'Weight' : 'Type'}</span><span>{pe.kind === 'conditioning' ? 'Min/Rnds' : 'Reps'}</span><span>RIR</span><span>✓</span>
                    </div>
                    {active.logs[exIdx].map((s, setIdx) => (
                      <div key={setIdx} className={`set-row ${s.done ? 'done' : ''}`} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.warmup ? 'W' : pe.sets.filter((_, j) => j <= setIdx && !pe.sets[j].warmup).length}</span>
                        {showLoad ? (
                          <input className="pill-input" inputMode="numeric" value={s.load ?? ''} placeholder={loadLabel(pe, pe.sets[setIdx]?.load ?? null)}
                            onChange={(e) => updateSet(exIdx, setIdx, { load: e.target.value === '' ? null : Number(e.target.value) })} />
                        ) : (
                          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>BW</span>
                        )}
                        <input className="pill-input" inputMode="numeric" value={s.reps}
                          onChange={(e) => updateSet(exIdx, setIdx, { reps: Number(e.target.value) || 0 })} />
                        <input className="pill-input" inputMode="numeric" value={s.rir ?? ''} placeholder="–"
                          onChange={(e) => updateSet(exIdx, setIdx, { rir: e.target.value === '' ? null : Number(e.target.value) })} />
                        <button className="btn btn-sm" style={s.done ? { background: 'var(--moss)', color: '#10240c', borderColor: '#4c7a3f' } : undefined}
                          onClick={() => markDone(exIdx, setIdx)}>{s.done ? '✓' : ''}</button>
                      </div>
                    ))}
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
      ))}

      <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={finish}>🏆 Finish quest</button>

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={zoom.src} alt={zoom.name} style={{ maxWidth: '92vw', maxHeight: '68vh', borderRadius: 16, background: '#efe9dc' }} />
          <div style={{ color: '#fff', marginTop: 14, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{zoom.name}</div>
          <div style={{ color: '#bbb', marginTop: 4, fontSize: 12 }}>tap anywhere to close</div>
        </div>
      )}

      {timer && <RestTimer key={timer.key} seconds={timer.seconds} label={timer.label} sound={profile.sound} onClose={() => setTimer(null)} />}
      {rewards && <RewardsModal rewards={rewards} onClose={() => navigate('/')} />}
    </div>
  )
}

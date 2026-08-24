import { useEffect, useRef, useState } from 'react'
import { fmtSeconds } from './common'

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
  } catch { /* no audio available */ }
}

/** A floating rest countdown. Remounted (via key) to restart between sets. */
export function RestTimer({ seconds, label, sound, onClose }: {
  seconds: number
  label: string
  sound: boolean
  onClose: () => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const firedRef = useRef(false)
  const endRef = useRef(Date.now() + seconds * 1000)

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.round((endRef.current - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        if (sound) beep()
        if ('vibrate' in navigator) navigator.vibrate?.(200)
      }
      if (left <= -2) { clearInterval(id); onClose() }
    }, 250)
    return () => clearInterval(id)
  }, [sound, onClose])

  const done = remaining <= 0
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 78, zIndex: 40,
      maxWidth: 640, margin: '0 auto', padding: '0 16px',
    }}>
      <div className="card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderColor: done ? 'var(--moss)' : 'var(--gold)',
        background: 'linear-gradient(180deg,#2c2115,#171009)',
      }}>
        <div>
          <div className="eyebrow" style={{ margin: 0 }}>{done ? 'Rest complete' : 'Rest'}</div>
          <div className="muted" style={{ fontSize: 12 }}>{label}</div>
        </div>
        <div className="big-num" style={{ color: done ? 'var(--moss)' : 'var(--gold-soft)' }}>
          {done ? 'Go!' : fmtSeconds(Math.max(0, remaining))}
        </div>
        <div className="row">
          <button className="btn btn-sm btn-ghost" onClick={() => { endRef.current += 15000; firedRef.current = false }}>+15s</button>
          <button className="btn btn-sm" onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  )
}

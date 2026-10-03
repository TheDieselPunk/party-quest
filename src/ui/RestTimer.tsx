import { useEffect, useRef, useState } from 'react'
import { fmtSeconds } from './common'

function beep(times = 1) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    for (let k = 0; k < times; k++) {
      const t0 = ctx.currentTime + k * 0.35
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 660
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28)
      osc.start(t0); osc.stop(t0 + 0.3)
    }
    setTimeout(() => ctx.close(), 400 * times + 300)
  } catch { /* no audio available */ }
}

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

/**
 * If the trainee has switched apps (or the screen is off-but-awake), post a
 * system notification when rest ends — the closest a web app can get to the
 * phone's own timer popping up over everything.
 */
async function notifyRestOver(label: string) {
  if (!canNotify() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
  const options = {
    body: label,
    tag: 'party-quest-rest',
    renotify: true,
    vibrate: [300, 150, 300],
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
  } as NotificationOptions
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification('Rest is over — next set! 💪', options)
    else new Notification('Rest is over — next set! 💪', options)
  } catch { /* notifications unavailable */ }
}

const RING = 2 * Math.PI * 44

/**
 * The rest countdown — a big ring timer that slides up after every logged set,
 * modeled on the phone's built-in timer. Remounted (via key) to restart between
 * sets. When it hits 0 it beeps/vibrates (and notifies if you've left the app),
 * then stays on screen showing "Go!" until dismissed so it can't be missed.
 */
export function RestTimer({ seconds, label, sound, onClose }: {
  seconds: number
  label: string
  sound: boolean
  onClose: () => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const [total, setTotal] = useState(Math.max(1, seconds))
  const [permission, setPermission] = useState(canNotify() ? Notification.permission : 'denied')
  const firedRef = useRef(false)
  const endRef = useRef(Date.now() + seconds * 1000)

  useEffect(() => {
    const tick = () => {
      const left = Math.round((endRef.current - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        if (sound) beep(2)
        if ('vibrate' in navigator) navigator.vibrate?.([300, 150, 300])
        void notifyRestOver(label)
      }
    }
    const id = setInterval(tick, 250)
    // Catch up immediately when coming back to the app.
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [sound, label])

  function adjust(delta: number) {
    endRef.current += delta * 1000
    setTotal((t) => Math.max(1, t + delta))
    setRemaining(Math.round((endRef.current - Date.now()) / 1000))
    firedRef.current = false
  }

  async function askPermission() {
    if (!canNotify()) return
    try { setPermission(await Notification.requestPermission()) } catch { /* ignore */ }
  }

  const done = remaining <= 0
  const frac = done ? 1 : Math.max(0, Math.min(1, (total - remaining) / total))
  const color = done ? 'var(--moss)' : 'var(--gold)'

  return (
    <div className="rest-sheet" role="timer" aria-live="polite">
      <div className="card" style={{
        padding: '14px 16px',
        borderColor: color,
        borderWidth: 2,
        background: 'linear-gradient(180deg,#332615,#18110a)',
        boxShadow: done ? '0 10px 40px #6fae5f55, 0 8px 24px #0009' : '0 10px 40px #d0a94e40, 0 8px 24px #0009',
      }}>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          {/* ring countdown */}
          <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
            <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="52" cy="52" r="44" fill="none" stroke="#0d0906" strokeWidth="9" />
              <circle cx="52" cy="52" r="44" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - frac)}
                style={{ transition: 'stroke-dashoffset .25s linear' }} />
            </svg>
            <div className="big-num" style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: done ? 28 : 26, color: done ? 'var(--moss)' : 'var(--gold-soft)',
            }}>
              {done ? 'Go!' : fmtSeconds(Math.max(0, remaining))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ margin: 0, color }}>{done ? '✓ Rest complete' : '⏱ Resting'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, margin: '2px 0 8px' }}>{label}</div>
            {!done && (
              <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                <button className="btn btn-sm btn-ghost" style={{ flex: 1, padding: '6px 4px' }} onClick={() => adjust(-15)}>−15s</button>
                <button className="btn btn-sm btn-ghost" style={{ flex: 1, padding: '6px 4px' }} onClick={() => adjust(15)}>+15s</button>
              </div>
            )}
            <button className="btn btn-sm btn-primary btn-block" onClick={onClose}>{done ? "Let's go 💪" : 'Skip rest'}</button>
          </div>
        </div>
        {permission === 'default' && !done && (
          <button className="btn btn-sm btn-ghost btn-block" style={{ marginTop: 8, fontSize: 12, minHeight: 32, color: 'var(--text-dim)' }} onClick={askPermission}>
            🔔 Alert me when rest ends, even if I switch apps
          </button>
        )}
      </div>
    </div>
  )
}

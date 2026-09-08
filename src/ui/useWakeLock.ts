import { useEffect } from 'react'

/**
 * Hold a Screen Wake Lock while `enabled` is true — keeps the phone screen on
 * during a workout so the rest-timer countdown and its beep/vibration fire on
 * time (browsers suspend page timers, and the AudioContext, once the screen
 * sleeps). The browser auto-releases the lock whenever the tab is hidden, so we
 * re-acquire it when the tab becomes visible again, and release it on cleanup.
 *
 * A no-op where the API is unsupported (e.g. iOS < 16.4) — the timer still runs
 * whenever the screen is on; this just stops the screen from turning off.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let released = false

    const acquire = async () => {
      if (released || document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch { /* rejected (tab not visible / denied) — retried on next visibility change */ }
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') void acquire() }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [enabled])
}

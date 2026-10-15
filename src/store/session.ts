import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlannedSession } from '../domain/types'

/** Which local profile is active on this device, plus this device's cloud link. */
interface SessionState {
  currentProfileId: string | null
  setCurrent: (id: string | null) => void
  /**
   * This person's secret code (normalized) — links the phone to their cloud
   * backup + the Party view. Saved on the device; null = local-only.
   */
  cloudCode: string | null
  setCloudCode: (code: string | null) => void
  /** The "set up your secret code" reminder on the Tavern was dismissed. */
  cloudNudgeDismissed: boolean
  dismissCloudNudge: () => void
  /** An off-gym session (mobility/run/ruck) queued for the guided player. */
  pendingGuided: PlannedSession | null
  setPendingGuided: (s: PlannedSession | null) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentProfileId: null,
      setCurrent: (id) => set({ currentProfileId: id }),
      cloudCode: null,
      setCloudCode: (code) => set({ cloudCode: code }),
      cloudNudgeDismissed: false,
      dismissCloudNudge: () => set({ cloudNudgeDismissed: true }),
      pendingGuided: null,
      setPendingGuided: (s) => set({ pendingGuided: s }),
    }),
    {
      name: 'party-quest-session',
      partialize: (s) => ({
        currentProfileId: s.currentProfileId,
        cloudCode: s.cloudCode,
        cloudNudgeDismissed: s.cloudNudgeDismissed,
      }),
    },
  ),
)

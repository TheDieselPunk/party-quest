import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlannedSession } from '../domain/types'

/** Which local profile is currently active on this device, and cloud-gate state. */
interface SessionState {
  currentProfileId: string | null
  setCurrent: (id: string | null) => void
  /** User chose to skip sign-in and use the app locally only. */
  offline: boolean
  setOffline: (v: boolean) => void
  /** An off-gym session (mobility/run/ruck) queued for the guided player. */
  pendingGuided: PlannedSession | null
  setPendingGuided: (s: PlannedSession | null) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentProfileId: null,
      setCurrent: (id) => set({ currentProfileId: id }),
      offline: false,
      setOffline: (v) => set({ offline: v }),
      pendingGuided: null,
      setPendingGuided: (s) => set({ pendingGuided: s }),
    }),
    {
      name: 'party-quest-session',
      partialize: (s) => ({ currentProfileId: s.currentProfileId, offline: s.offline }),
    },
  ),
)

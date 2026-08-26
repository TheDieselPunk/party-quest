import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Which local profile is currently active on this device, and cloud-gate state. */
interface SessionState {
  currentProfileId: string | null
  setCurrent: (id: string | null) => void
  /** User chose to skip sign-in and use the app locally only. */
  offline: boolean
  setOffline: (v: boolean) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentProfileId: null,
      setCurrent: (id) => set({ currentProfileId: id }),
      offline: false,
      setOffline: (v) => set({ offline: v }),
    }),
    { name: 'party-quest-session' },
  ),
)

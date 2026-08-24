import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Which local profile is currently "logged in" on this device. */
interface SessionState {
  currentProfileId: string | null
  setCurrent: (id: string | null) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentProfileId: null,
      setCurrent: (id) => set({ currentProfileId: id }),
    }),
    { name: 'party-quest-session' },
  ),
)

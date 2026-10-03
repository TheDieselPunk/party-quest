import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSession } from './session'
import { normalizeProfile } from '../domain/defaults'
import type { Character, CompletedSession, Profile } from '../domain/types'
import type { ActiveWorkout } from '../domain/active'

export function useProfiles(): Profile[] | undefined {
  return useLiveQuery(async () => (await db.profiles.orderBy('createdAt').toArray()).map(normalizeProfile), [])
}

export function useCurrentProfile(): Profile | undefined | null {
  const id = useSession((s) => s.currentProfileId)
  return useLiveQuery(async () => {
    if (!id) return null
    const p = await db.profiles.get(id)
    return p ? normalizeProfile(p) : null
  }, [id])
}

export function useCharacter(profileId: string | null | undefined): Character | undefined {
  return useLiveQuery(async () => (profileId ? await db.characters.get(profileId) : undefined), [profileId])
}

export function useSessions(profileId: string | null | undefined): CompletedSession[] | undefined {
  return useLiveQuery(
    async () => (profileId ? db.sessions.where('profileId').equals(profileId).reverse().sortBy('date') : []),
    [profileId],
  )
}

export function useActive(profileId: string | null | undefined): ActiveWorkout | undefined | null {
  return useLiveQuery(async () => (profileId ? (await db.active.get(profileId)) ?? null : null), [profileId])
}

export function useAllCharacters(): Character[] | undefined {
  return useLiveQuery(() => db.characters.toArray(), [])
}

import { supabase } from './supabase'
import type { Attribute, Character, Profile } from '../domain/types'
import { ALL_ATTRIBUTES } from '../domain/types'

export interface PartyMember {
  userId: string
  displayName: string
  character?: Character
}

function totalXp(c: Character | undefined): number {
  if (!c) return 0
  return ALL_ATTRIBUTES.reduce((sum, a: Attribute) => sum + (c.xp?.[a] ?? 0), 0)
}

/**
 * Everyone in the guild. Account sign-up is gated by a shared invite code, so
 * every user is a trusted member of one implicit party — there's no create/join
 * step; we simply show them all. One entry per user: their highest-level
 * character and its adventurer name. (Read access to all profiles/characters is
 * granted by RLS — see supabase/schema.sql.)
 */
export async function fetchGuild(): Promise<PartyMember[]> {
  if (!supabase) return []
  const [{ data: chars }, { data: profs }] = await Promise.all([
    supabase.from('characters').select('user_id, profile_id, data'),
    supabase.from('profiles').select('id, data'),
  ])

  const nameByProfile = new Map<string, string>()
  for (const p of (profs ?? []) as Array<{ id: string; data: Profile }>) {
    nameByProfile.set(p.id, p.data?.characterName ?? 'Adventurer')
  }

  // Keep the highest-XP character per user as their representative.
  const best = new Map<string, { profileId: string; char: Character }>()
  for (const c of (chars ?? []) as Array<{ user_id: string; profile_id: string; data: Character }>) {
    const cur = best.get(c.user_id)
    if (!cur || totalXp(c.data) > totalXp(cur.char)) best.set(c.user_id, { profileId: c.profile_id, char: c.data })
  }

  return [...best.entries()]
    .map(([userId, { profileId, char }]) => ({
      userId,
      displayName: nameByProfile.get(profileId) ?? 'Adventurer',
      character: char,
    }))
    .sort((a, b) => totalXp(b.character) - totalXp(a.character))
}

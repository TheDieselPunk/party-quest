import { supabase } from './supabase'
import type { Attribute, Character } from '../domain/types'
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

/** The party this user belongs to, if any (RLS returns only my parties). */
export async function myParty(): Promise<{ partyId: string; code: string } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('parties').select('id, code').limit(1)
  if (error || !data || !data.length) return null
  return { partyId: data[0].id as string, code: data[0].code as string }
}

export async function createParty(displayName: string): Promise<{ partyId: string; code: string }> {
  if (!supabase) throw new Error('Cloud is not configured.')
  const { data, error } = await supabase.rpc('create_party', { member_name: displayName })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { party_id: string; code: string }
  return { partyId: row.party_id, code: row.code }
}

export async function joinParty(code: string, displayName: string): Promise<void> {
  if (!supabase) throw new Error('Cloud is not configured.')
  const { error } = await supabase.rpc('join_party', { join_code: code.trim(), member_name: displayName })
  if (error) throw error
}

export async function leaveParty(partyId: string): Promise<void> {
  if (!supabase) return
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return
  await supabase.from('party_members').delete().eq('party_id', partyId).eq('user_id', u.user.id)
}

/** Members of a party + a representative (highest-level) character each. */
export async function fetchPartyMembers(partyId: string): Promise<PartyMember[]> {
  if (!supabase) return []
  const { data: members } = await supabase
    .from('party_members').select('user_id, display_name').eq('party_id', partyId)
  if (!members) return []
  const userIds = members.map((m) => m.user_id as string)
  const { data: chars } = await supabase.from('characters').select('user_id, data').in('user_id', userIds)

  const byUser = new Map<string, Character>()
  for (const c of (chars ?? []) as Array<{ user_id: string; data: Character }>) {
    const existing = byUser.get(c.user_id)
    if (!existing || totalXp(c.data) > totalXp(existing)) byUser.set(c.user_id, c.data)
  }
  return members.map((m) => ({
    userId: m.user_id as string,
    displayName: (m.display_name as string) ?? 'Adventurer',
    character: byUser.get(m.user_id as string),
  }))
}

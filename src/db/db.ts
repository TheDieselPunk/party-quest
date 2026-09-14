import Dexie, { type Table } from 'dexie'
import type { Character, CompletedSession, Profile } from '../domain/types'
import type { ActiveWorkout } from '../domain/active'

/** A pending cloud write, persisted so it survives offline / reload. */
export interface OutboxItem {
  key: string // `${kind}:${rowId}` — deduped, latest op wins
  kind: 'profiles' | 'characters' | 'sessions'
  rowId: string
  op: 'upsert' | 'delete'
  ts: number
}


// Local-first storage. Everything lives on-device (IndexedDB); the cloud layer
// (src/cloud) syncs it when signed in.
class PartyQuestDB extends Dexie {
  profiles!: Table<Profile, string>
  characters!: Table<Character, string> // keyed by profileId
  sessions!: Table<CompletedSession, string>
  active!: Table<ActiveWorkout, string> // keyed by profileId
  outbox!: Table<OutboxItem, string> // keyed by key

  constructor() {
    super('party-quest')
    this.version(1).stores({
      profiles: 'id, name, createdAt',
      characters: 'profileId',
      sessions: 'id, profileId, date',
      active: 'profileId',
    })
    this.version(2).stores({
      outbox: 'key, ts',
    })
    // v3 briefly added a per-device `equipmentPhotos` table for user-taken
    // machine photos; that was replaced by bundled preset photos
    // (data/machinePhotos.ts), so v4 drops the table. Kept in the version chain
    // (create → delete) so clients that upgraded to v3 migrate cleanly.
    this.version(3).stores({
      equipmentPhotos: 'equipmentId',
    })
    this.version(4).stores({
      equipmentPhotos: null,
    })
  }
}

export const db = new PartyQuestDB()

import Dexie, { type Table } from 'dexie'
import type { Character, CompletedSession, Profile } from '../domain/types'
import type { ActiveWorkout } from '../domain/active'

// Local-first storage. Everything lives on-device (IndexedDB); each phone holds
// its own self-contained profiles. Cloud sync is a later phase.
class PartyQuestDB extends Dexie {
  profiles!: Table<Profile, string>
  characters!: Table<Character, string> // keyed by profileId
  sessions!: Table<CompletedSession, string>
  active!: Table<ActiveWorkout, string> // keyed by profileId

  constructor() {
    super('party-quest')
    this.version(1).stores({
      profiles: 'id, name, createdAt',
      characters: 'profileId',
      sessions: 'id, profileId, date',
      active: 'profileId',
    })
  }
}

export const db = new PartyQuestDB()

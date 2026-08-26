import { useEffect, useState } from 'react'
import { db, type OutboxItem } from '../db/db'
import { supabase, cloudEnabled } from './supabase'
import type { Character, CompletedSession, Profile } from '../domain/types'

// ---------------------------------------------------------------------------
// Local-first cloud sync. Dexie remains the working store (offline-capable);
// this layer pushes local changes up and pulls remote changes down, resolving
// conflicts by last-write-wins on `updatedAt`. A persisted outbox survives
// offline periods and reloads.
// ---------------------------------------------------------------------------

type Kind = 'profiles' | 'characters' | 'sessions'
let currentUserId: string | null = null

/** Stamp a record with the current time for last-write-wins ordering. */
export function stampNow<T extends object>(o: T): T {
  ;(o as { updatedAt?: number }).updatedAt = Date.now()
  return o
}

// --- status (for the Settings sync indicator) ------------------------------
export interface SyncStatus { pending: number; online: boolean; signedIn: boolean }
const listeners = new Set<(s: SyncStatus) => void>()
async function currentStatus(): Promise<SyncStatus> {
  return { pending: await db.outbox.count(), online: navigator.onLine, signedIn: !!currentUserId }
}
function emitStatus(): void { void currentStatus().then((s) => listeners.forEach((l) => l(s))) }

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>({ pending: 0, online: navigator.onLine, signedIn: !!currentUserId })
  useEffect(() => {
    const l = (x: SyncStatus) => setS(x)
    listeners.add(l)
    void currentStatus().then(setS)
    const on = () => emitStatus()
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => { listeners.delete(l); window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  return s
}

// --- row helpers -----------------------------------------------------------
async function readRow(kind: Kind, rowId: string): Promise<Profile | Character | CompletedSession | undefined> {
  if (kind === 'profiles') return db.profiles.get(rowId)
  if (kind === 'characters') return db.characters.get(rowId)
  return db.sessions.get(rowId)
}

function payloadFor(kind: Kind, rowId: string, row: Profile | Character | CompletedSession, userId: string): Record<string, unknown> {
  const updated_at = new Date((row as { updatedAt?: number }).updatedAt ?? Date.now()).toISOString()
  if (kind === 'profiles') return { id: rowId, user_id: userId, data: row, updated_at }
  if (kind === 'characters') return { profile_id: rowId, user_id: userId, data: row, updated_at }
  const s = row as CompletedSession
  return { id: rowId, user_id: userId, profile_id: s.profileId, date: s.date, data: s, updated_at }
}

async function writeLocal(kind: Kind, data: Profile | Character | CompletedSession): Promise<void> {
  if (kind === 'profiles') await db.profiles.put(data as Profile)
  else if (kind === 'characters') await db.characters.put(data as Character)
  else await db.sessions.put(data as CompletedSession)
}

async function pushItem(item: OutboxItem): Promise<void> {
  if (!supabase || !currentUserId) throw new Error('not signed in')
  if (item.op === 'delete') {
    const col = item.kind === 'characters' ? 'profile_id' : 'id'
    const { error } = await supabase.from(item.kind).delete().eq(col, item.rowId)
    if (error) throw error
    return
  }
  const row = await readRow(item.kind, item.rowId)
  if (!row) return // row removed locally before push; nothing to upsert
  const { error } = await supabase.from(item.kind).upsert(payloadFor(item.kind, item.rowId, row, currentUserId))
  if (error) throw error
}

/** Queue a cloud write. Pushes immediately when possible; otherwise persists to the outbox. */
export function queuePush(kind: Kind, rowId: string, op: 'upsert' | 'delete' = 'upsert'): void {
  if (!cloudEnabled || !currentUserId) return
  const item: OutboxItem = { key: `${kind}:${rowId}`, kind, rowId, op, ts: Date.now() }
  void (async () => {
    if (navigator.onLine) {
      try { await pushItem(item); await db.outbox.delete(item.key); emitStatus(); return } catch { /* fall through to outbox */ }
    }
    await db.outbox.put(item)
    emitStatus()
  })()
}

export async function flushOutbox(): Promise<void> {
  if (!cloudEnabled || !currentUserId || !navigator.onLine) return
  const items = await db.outbox.orderBy('ts').toArray()
  for (const item of items) {
    try { await pushItem(item); await db.outbox.delete(item.key) }
    catch { break } // likely offline again; retry on next trigger
  }
  emitStatus()
}

// --- pull + merge ----------------------------------------------------------
type CloudIndex = Record<Kind, Map<string, number>> // rowId -> cloud updatedAt (ms)

function cloudUpdatedMs(r: { data?: { updatedAt?: number }; updated_at?: string }): number {
  return r.data?.updatedAt ?? (r.updated_at ? Date.parse(r.updated_at) : 0)
}

async function pullKind(kind: Kind, userId: string, index: CloudIndex): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.from(kind).select('*').eq('user_id', userId)
  if (error || !data) return
  const idField = kind === 'characters' ? 'profile_id' : 'id'
  for (const r of data as Array<Record<string, unknown>>) {
    const rowId = r[idField] as string
    const obj = r.data as Profile | Character | CompletedSession
    const cu = cloudUpdatedMs(r as { data?: { updatedAt?: number }; updated_at?: string })
    index[kind].set(rowId, cu)
    const local = await readRow(kind, rowId)
    const lu = (local as { updatedAt?: number } | undefined)?.updatedAt ?? -1
    if (!local || cu >= lu) await writeLocal(kind, obj)
  }
}

async function pullAll(userId: string): Promise<CloudIndex> {
  const index: CloudIndex = { profiles: new Map(), characters: new Map(), sessions: new Map() }
  await Promise.all([
    pullKind('profiles', userId, index),
    pullKind('characters', userId, index),
    pullKind('sessions', userId, index),
  ])
  return index
}

/** Push local rows the cloud is missing or that are locally newer (adopt on-device data). */
async function migrateLocal(index: CloudIndex): Promise<void> {
  const isNewer = (kind: Kind, id: string, updatedAt?: number) => {
    const cu = index[kind].get(id)
    return cu == null || (updatedAt ?? 0) > cu
  }
  for (const p of await db.profiles.toArray()) if (isNewer('profiles', p.id, p.updatedAt)) queuePush('profiles', p.id)
  for (const c of await db.characters.toArray()) if (isNewer('characters', c.profileId, c.updatedAt)) queuePush('characters', c.profileId)
  for (const s of await db.sessions.toArray()) if (isNewer('sessions', s.id, s.updatedAt)) queuePush('sessions', s.id)
}

// --- lifecycle -------------------------------------------------------------
function onOnline() { void flushOutbox() }
function onFocus() { void flushOutbox() }

export async function initSync(userId: string): Promise<void> {
  if (!cloudEnabled || !supabase) return
  currentUserId = userId
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  emitStatus()
  const index = await pullAll(userId)
  await migrateLocal(index)
  await flushOutbox()
  emitStatus()
}

export function clearSync(): void {
  currentUserId = null
  window.removeEventListener('online', onOnline)
  window.removeEventListener('focus', onFocus)
  emitStatus()
}

/** Pull the latest for the signed-in user (used when opening data-heavy screens). */
export async function pullLatest(): Promise<void> {
  if (currentUserId) await pullAll(currentUserId)
}

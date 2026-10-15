import { useEffect, useState } from 'react'
import { db, type OutboxItem } from '../db/db'
import { apiPull, apiPush, cloudEnabled, type CloudRecord, type Kind, type PullResult } from './api'
import type { Character, CompletedSession, Profile } from '../domain/types'

// ---------------------------------------------------------------------------
// Local-first cloud sync. Dexie remains the working store (the app never waits
// on the cloud); this layer pushes local changes up and pulls remote changes
// down, resolving conflicts by last-write-wins on `updatedAt`. A persisted
// outbox survives offline periods, reloads, and the cloud being unreachable.
// Identity is the person's secret code — no accounts, nothing to log into.
// ---------------------------------------------------------------------------

let currentCode: string | null = null
let initialSyncDone = false
let lastError = false

/** Stamp a record with the current time for last-write-wins ordering. */
export function stampNow<T extends object>(o: T): T {
  ;(o as { updatedAt?: number }).updatedAt = Date.now()
  return o
}

// --- status (for the Settings sync indicator) ------------------------------
export interface SyncStatus {
  pending: number
  online: boolean
  linked: boolean
  initialSyncDone: boolean
  /** The last attempt to reach the cloud failed (it may be down or unreachable). */
  unreachable: boolean
}
const listeners = new Set<(s: SyncStatus) => void>()
async function currentStatus(): Promise<SyncStatus> {
  return {
    pending: await db.outbox.count(), online: navigator.onLine, linked: !!currentCode,
    initialSyncDone, unreachable: lastError,
  }
}
function emitStatus(): void { void currentStatus().then((s) => listeners.forEach((l) => l(s))) }

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>({
    pending: 0, online: navigator.onLine, linked: !!currentCode, initialSyncDone, unreachable: lastError,
  })
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
async function readRow(kind: Kind, rowId: string): Promise<CloudRecord | undefined> {
  if (kind === 'profiles') return db.profiles.get(rowId)
  if (kind === 'characters') return db.characters.get(rowId)
  return db.sessions.get(rowId)
}

async function writeLocal(kind: Kind, data: CloudRecord): Promise<void> {
  if (kind === 'profiles') await db.profiles.put(data as Profile)
  else if (kind === 'characters') await db.characters.put(data as Character)
  else await db.sessions.put(data as CompletedSession)
}

const updatedAtOf = (r: CloudRecord | undefined) => (r as { updatedAt?: number } | undefined)?.updatedAt

// --- push ------------------------------------------------------------------
async function enqueue(kind: Kind, rowId: string, op: 'upsert' | 'delete'): Promise<void> {
  if (!cloudEnabled || !currentCode) return
  const item: OutboxItem = { key: `${kind}:${rowId}`, kind, rowId, op, ts: Date.now() }
  await db.outbox.put(item)
  emitStatus()
  scheduleFlush()
}

/** Queue a cloud write; it's sent with the next (debounced) flush. */
export function queuePush(kind: Kind, rowId: string, op: 'upsert' | 'delete' = 'upsert'): void {
  void enqueue(kind, rowId, op)
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { flushTimer = null; void flushOutbox() }, 400)
}

let flushing = false
let flushAgain = false
const CHUNK = 50

/** Send everything in the outbox, in chunks. Stops quietly if the cloud is unreachable. */
export async function flushOutbox(): Promise<void> {
  if (!cloudEnabled || !currentCode || !navigator.onLine) return
  if (flushing) { flushAgain = true; return }
  flushing = true
  flushAgain = false
  const code = currentCode
  try {
    const items = await db.outbox.orderBy('ts').toArray()
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = items.slice(i, i + CHUNK)
      const upserts: Parameters<typeof apiPush>[1] = []
      const deletes: Parameters<typeof apiPush>[2] = []
      for (const item of batch) {
        if (item.op === 'delete') { deletes.push({ kind: item.kind, id: item.rowId }); continue }
        const row = await readRow(item.kind, item.rowId)
        if (row) upserts.push({ kind: item.kind, id: item.rowId, data: row, updatedAt: updatedAtOf(row) ?? item.ts })
      }
      await apiPush(code, upserts, deletes)
      // Clear only what we sent — an item re-queued mid-flush (newer ts) stays.
      await db.transaction('rw', db.outbox, async () => {
        for (const item of batch) {
          const cur = await db.outbox.get(item.key)
          if (cur && cur.ts === item.ts) await db.outbox.delete(item.key)
        }
      })
    }
    lastError = false
  } catch {
    lastError = true // offline / cloud down — retried on focus, online, or the next change
  } finally {
    flushing = false
    if (flushAgain && !lastError) scheduleFlush() // something was queued mid-flush
    emitStatus()
  }
}

// --- pull + merge ----------------------------------------------------------
async function mergePulled(pulled: PullResult): Promise<Record<Kind, Map<string, number>>> {
  const index: Record<Kind, Map<string, number>> = { profiles: new Map(), characters: new Map(), sessions: new Map() }
  for (const kind of ['profiles', 'characters', 'sessions'] as Kind[]) {
    for (const r of pulled[kind] ?? []) {
      const cu = updatedAtOf(r.data) ?? r.updatedAt
      index[kind].set(r.id, cu)
      const local = await readRow(kind, r.id)
      if (!local || cu >= (updatedAtOf(local) ?? -1)) await writeLocal(kind, r.data)
    }
  }
  return index
}

/** Queue local rows the cloud is missing or that are locally newer (adopt on-device data). */
async function queueLocalNewer(index: Record<Kind, Map<string, number>>): Promise<void> {
  const isNewer = (kind: Kind, id: string, updatedAt?: number) => {
    const cu = index[kind].get(id)
    return cu == null || (updatedAt ?? 0) > cu
  }
  for (const p of await db.profiles.toArray()) if (isNewer('profiles', p.id, p.updatedAt)) await enqueue('profiles', p.id, 'upsert')
  for (const c of await db.characters.toArray()) if (isNewer('characters', c.profileId, c.updatedAt)) await enqueue('characters', c.profileId, 'upsert')
  for (const s of await db.sessions.toArray()) if (isNewer('sessions', s.id, s.updatedAt)) await enqueue('sessions', s.id, 'upsert')
}

async function syncNow(code: string): Promise<void> {
  const pulled = await apiPull(code)
  if (currentCode !== code) return // unlinked/relinked meanwhile
  const index = await mergePulled(pulled)
  await queueLocalNewer(index)
  await flushOutbox()
}

// --- lifecycle -------------------------------------------------------------
function onOnline() { if (currentCode) void syncNow(currentCode).catch(() => {}) }
function onVisible() { if (document.visibilityState === 'visible') void flushOutbox() }

/** Link this device to a code: pull its backup, then push anything only this phone has. */
export async function initSync(code: string): Promise<void> {
  if (!cloudEnabled) return
  currentCode = code
  initialSyncDone = false
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  emitStatus()
  try {
    await syncNow(code)
    lastError = false
  } catch {
    lastError = true // cloud unreachable — keep using local data; retries later
  } finally {
    initialSyncDone = true
    emitStatus()
  }
}

export function clearSync(): void {
  currentCode = null
  initialSyncDone = false
  lastError = false
  window.removeEventListener('online', onOnline)
  document.removeEventListener('visibilitychange', onVisible)
  emitStatus()
}

/** Pull the latest for the linked code (e.g. on opening data-heavy screens). */
export async function pullLatest(): Promise<void> {
  if (currentCode) await syncNow(currentCode)
}

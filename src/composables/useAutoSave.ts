import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'

import type { JsonFormatting } from '@/core/json/exporter'
import type { JsonHistoryState } from '@/core/json/history'
import {
  applyStorageBudget,
  deserializeSession,
  getSessionPreview,
  isPersistedSessionTombstone,
  isValidPersistedSessionRecord,
  migrateLegacySingleSession,
  serializeRecoverySession,
  type PersistedSession,
  type PersistedSessionTombstone,
  type QuarantinedSessionInfo,
  type RestoredSession,
  type SessionPreview,
} from '@/core/json/sessionStorage'
import type { JsonValue, LoadedJsonDocument } from '@/core/json/types'

import type { RestoreSessionInput } from './useJsonDocument'

const DB_NAME = 'json-visual-editor'
const DB_VERSION = 3
const STORE_NAME = 'sessions'
const LEASE_STORE_NAME = 'session-leases'
/** Object store name used by DB v1's single global slot. Preserved after migration. */
const LEGACY_STORE_NAME = 'session'
const LEGACY_RECORD_KEY = 'current'

const BROADCAST_CHANNEL_NAME = 'json-visual-editor-session'
const TAB_HEARTBEAT_MS = 4000
const TAB_STALE_MS = 10_000
const LEASE_TTL_MS = 5 * 60 * 1000

/**
 * Wait for an editing pause before preparing a full IndexedDB snapshot.
 * Lifecycle events flush a pending save immediately, so the delay only
 * removes repeated work from the active typing/navigation path.
 */
export const AUTO_SAVE_DEBOUNCE_MS = 4000

/** Retention policy (AS-04/AS-09): bounds how many recoverable sessions accumulate. */
const MAX_RECOVERABLE_SESSIONS = 5
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AutoSaveFailureKind =
  | 'unavailable'
  | 'blocked'
  | 'quota-exceeded'
  | 'read-failure'
  | 'write-failure'
  | 'too-large'
  | 'transient'

export interface AutoSaveStatus {
  kind: AutoSaveFailureKind
}

/** Failure kinds that mean "storage is structurally broken for this session" — stop retrying. */
function isTerminalFailure(kind: AutoSaveFailureKind): boolean {
  return kind === 'unavailable' || kind === 'quota-exceeded'
}

class AutoSaveError extends Error {
  readonly kind: AutoSaveFailureKind
  constructor(kind: AutoSaveFailureKind, message: string) {
    super(message)
    this.name = 'AutoSaveError'
    this.kind = kind
  }
}

function classifyError(error: unknown): AutoSaveFailureKind {
  if (error instanceof AutoSaveError) return error.kind
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return 'quota-exceeded'
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'transient'
  }
  return 'write-failure'
}

type SessionBroadcastMessage = { type: 'editing' | 'closing'; tabId: string; sessionId: string }

function isSessionBroadcastMessage(data: unknown): data is SessionBroadcastMessage {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as { type?: unknown; tabId?: unknown; sessionId?: unknown }
  return (
    (candidate.type === 'editing' || candidate.type === 'closing') &&
    typeof candidate.tabId === 'string' &&
    typeof candidate.sessionId === 'string'
  )
}

function createId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new AutoSaveError('unavailable', 'IndexedDB is not available in this browser.'))
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      reject(new AutoSaveError('unavailable', 'Failed to open the session database.'))
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' })
      }
      if (!db.objectStoreNames.contains(LEASE_STORE_NAME)) {
        db.createObjectStore(LEASE_STORE_NAME, { keyPath: 'leaseId' })
      }

      // DB v1 stored one record at `session/current`, without identity or
      // revision fields. Copy a valid record into the per-session store but
      // deliberately retain the legacy store: malformed/unknown data is
      // never destroyed merely by opening a newer build.
      const upgradeTx = request.transaction
      if (upgradeTx && db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        const legacyRequest = upgradeTx.objectStore(LEGACY_STORE_NAME).get(LEGACY_RECORD_KEY)
        legacyRequest.onsuccess = () => {
          const migrated = migrateLegacySingleSession(legacyRequest.result)
          if (migrated) upgradeTx.objectStore(STORE_NAME).put(migrated)
        }
      }
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(new AutoSaveError('unavailable', 'Failed to open the session database.'))
    request.onblocked = () =>
      reject(new AutoSaveError('blocked', 'The session database is blocked by another tab.'))
  })
}

interface SessionLease {
  leaseId: string
  sessionId: string
  tabId: string
  expiresAt: number
}

function readAllRecords(db: IDBDatabase): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    let request: IDBRequest<unknown[]>
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      request = tx.objectStore(STORE_NAME).getAll()
    } catch {
      reject(new AutoSaveError('read-failure', 'Failed to read saved sessions.'))
      return
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new AutoSaveError('read-failure', 'Failed to read saved sessions.'))
  })
}

function readAllLeases(db: IDBDatabase): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    let request: IDBRequest<unknown[]>
    try {
      request = db.transaction(LEASE_STORE_NAME, 'readonly').objectStore(LEASE_STORE_NAME).getAll()
    } catch {
      reject(new AutoSaveError('read-failure', 'Failed to read active session leases.'))
      return
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new AutoSaveError('read-failure', 'Failed to read active session leases.'))
  })
}

function isSessionLease(value: unknown): value is SessionLease {
  if (typeof value !== 'object' || value === null) return false
  const lease = value as Partial<SessionLease>
  return (
    typeof lease.leaseId === 'string' &&
    typeof lease.sessionId === 'string' &&
    typeof lease.tabId === 'string' &&
    typeof lease.expiresAt === 'number' &&
    Number.isFinite(lease.expiresAt)
  )
}

function putLease(db: IDBDatabase, lease: SessionLease): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEASE_STORE_NAME, 'readwrite')
    tx.objectStore(LEASE_STORE_NAME).put(lease)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(new AutoSaveError('write-failure', 'Failed to refresh the active session lease.'))
    tx.onabort = () => reject(new AutoSaveError('write-failure', 'Refreshing the active session lease was aborted.'))
  })
}

function deleteLease(db: IDBDatabase, leaseId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEASE_STORE_NAME, 'readwrite')
    tx.objectStore(LEASE_STORE_NAME).delete(leaseId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(new AutoSaveError('write-failure', 'Failed to clear an active session lease.'))
    tx.onabort = () => reject(new AutoSaveError('write-failure', 'Clearing an active session lease was aborted.'))
  })
}

type WriteOutcome = { status: 'written' } | { status: 'conflict'; storedOwnerTabId: string }

/**
 * Reads the current stored record for this sessionId and writes the new one
 * in the same readwrite transaction (atomic compare-before-write), refusing
 * to overwrite a record that another tab has already advanced to a revision
 * at or beyond ours (AS-01 ordering safety, AS-04 conflict detection).
 */
function compareAndWrite(db: IDBDatabase, record: PersistedSession): Promise<WriteOutcome> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(STORE_NAME, 'readwrite')
    } catch {
      reject(new AutoSaveError('write-failure', 'Failed to open a write transaction.'))
      return
    }
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(record.sessionId)

    let outcome: WriteOutcome = { status: 'written' }

    getRequest.onsuccess = () => {
      const existing: unknown = getRequest.result
      if (isPersistedSessionTombstone(existing)) {
        outcome = { status: 'conflict', storedOwnerTabId: existing.ownerTabId }
        return
      }
      // Unknown/currently invalid records fail closed. In particular, an
      // older build must never overwrite a future-schema record whose
      // revision fields may have different semantics.
      if (existing !== undefined && !isValidPersistedSessionRecord(existing)) {
        outcome = { status: 'conflict', storedOwnerTabId: 'unknown' }
        return
      }
      const staleAgainstAnotherTab =
        existing !== undefined &&
        existing.ownerTabId !== record.ownerTabId &&
        existing.revision >= record.revision
      if (staleAgainstAnotherTab) {
        outcome = { status: 'conflict', storedOwnerTabId: existing.ownerTabId }
        return
      }
      store.put(record)
    }

    tx.oncomplete = () => resolve(outcome)
    tx.onerror = () => {
      const domError = tx.error
      if (domError instanceof DOMException && domError.name === 'QuotaExceededError') {
        reject(new AutoSaveError('quota-exceeded', 'Storage quota exceeded while saving the session.'))
      } else {
        reject(new AutoSaveError('write-failure', domError?.message ?? 'Failed to save the session.'))
      }
    }
    tx.onabort = () => reject(new AutoSaveError('write-failure', 'Saving the session was aborted.'))
  })
}

/**
 * Replaces a session with a revisioned tombstone in the same transaction
 * that reads its latest revision. Absence is not used as deletion state:
 * stale/suspended tabs must continue seeing a durable conflict indefinitely.
 */
function tombstoneRecord(
  db: IDBDatabase,
  sessionId: string,
  ownerTabId: string,
  minimumRevision: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(STORE_NAME, 'readwrite')
    } catch {
      reject(new AutoSaveError('write-failure', 'Failed to open a cleanup transaction.'))
      return
    }
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(sessionId)
    getRequest.onsuccess = () => {
      const existing: unknown = getRequest.result
      const existingRevision =
        isPersistedSessionTombstone(existing) || isValidPersistedSessionRecord(existing)
          ? existing.revision
          : 0
      const tombstone: PersistedSessionTombstone = {
        recordType: 'tombstone',
        sessionId,
        ownerTabId,
        revision: Math.max(existingRevision, minimumRevision) + 1,
        deletedAt: Date.now(),
      }
      store.put(tombstone)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(new AutoSaveError('write-failure', 'Failed to clean up a saved session.'))
    tx.onabort = () => reject(new AutoSaveError('write-failure', 'Cleanup was aborted.'))
  })
}

interface SessionSummary {
  sessionId: string
  savedAt: number
}

interface RetentionResult {
  keep: SessionSummary[]
  quarantineKeep: QuarantinedSessionInfo[]
  evictedIds: string[]
}

function extractSessionId(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const id = (raw as { sessionId?: unknown }).sessionId
  return typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * TTL + max-count retention for recoverable records. Active sessions are
 * never evicted, even if that temporarily exceeds the cap. Future-schema
 * records remain quarantined until the user explicitly discards them.
 */
function sweepRetention(
  restorable: SessionSummary[],
  quarantined: QuarantinedSessionInfo[],
  activeSessionIds: ReadonlySet<string>,
  now: number,
): RetentionResult {
  const active = restorable.filter((record) => activeSessionIds.has(record.sessionId))
  const inactiveFresh = restorable
    .filter((record) => !activeSessionIds.has(record.sessionId) && now - record.savedAt <= SESSION_TTL_MS)
    .sort((a, b) => b.savedAt - a.savedAt)
  const availableInactiveSlots = Math.max(0, MAX_RECOVERABLE_SESSIONS - active.length)
  const keep = [...active, ...inactiveFresh.slice(0, availableInactiveSlots)].sort((a, b) => b.savedAt - a.savedAt)
  const keepIds = new Set(keep.map((record) => record.sessionId))
  const evictedIds = restorable
    .filter((record) => !activeSessionIds.has(record.sessionId) && !keepIds.has(record.sessionId))
    .map((record) => record.sessionId)

  return {
    keep,
    quarantineKeep: [...quarantined].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)),
    evictedIds,
  }
}

export interface UseAutoSaveParams {
  document: Ref<LoadedJsonDocument | null>
  history: Ref<JsonHistoryState | null>
  lastExported: Ref<JsonValue | undefined>
  restoreSession: (input: RestoreSessionInput) => void
  restoreOriginal: () => boolean
  downloadDocument: (formatting: JsonFormatting) => boolean
}

/**
 * Persists the in-progress editing session to IndexedDB, keyed by a
 * per-document sessionId (never by filename alone), so it can survive an
 * accidental tab close or crash and be offered back on the next visit.
 *
 * Every storage operation is best-effort and classified by failure kind
 * (see AutoSaveFailureKind): total unavailability and quota exhaustion stop
 * further attempts for the rest of this session and are surfaced once;
 * transient/blocked/read/write failures are retried on the next confirmed
 * change and do not repeat the warning on every attempt.
 */
export function useAutoSave(params: UseAutoSaveParams) {
  const { document, history, lastExported } = params

  const recoverableSessions = ref<SessionPreview[]>([])
  const quarantinedSessions = ref<QuarantinedSessionInfo[]>([])
  const otherTabEditing = ref(false)
  const sessionConflict = ref(false)
  const autoSaveStatus = ref<AutoSaveStatus | null>(null)

  /** Backward-compatible single-session view: the most recently saved recoverable session, if any. */
  const pendingResume = computed<SessionPreview | null>(() => recoverableSessions.value[0] ?? null)
  /** Backward-compatible boolean view of autoSaveStatus. */
  const storageWarning = computed(() => autoSaveStatus.value !== null)

  const tabId = createId()
  let dbPromise: Promise<IDBDatabase> | null = null
  let storageAvailable = true

  let activeSessionId: string | null = null
  let activeRevision = 0
  let sessionConflictActive = false
  let documentGeneration = 0
  let suppressNextSchedule = false
  let scheduledSaveTimer: ReturnType<typeof setTimeout> | null = null
  let scheduledSessionId: string | null = null

  /**
   * Per-session serialized task queue (AS-01/AS-02 hardening). Every write
   * and every delete for a given sessionId is chained onto that session's
   * own `tail`, so they can never run concurrently and a delete enqueued
   * after an in-flight write is guaranteed to run after it — this is what
   * stops a slow write from resurrecting a record that Remove file/Restore
   * original/download/Discard just removed. `generation` is a separate,
   * cheaper guard on top: cleanup bumps it synchronously the instant it is
   * requested, and a write still sitting in the queue (not yet past its own
   * `await getDatabase()`) re-checks it immediately before opening its
   * transaction, so it can bail out without even attempting a write it
   * already knows is stale — distinct from `documentGeneration` above,
   * which guards a different race (AS-03, the startup session scan).
   */
  interface SessionQueue {
    generation: number
    tail: Promise<void>
    writeInFlight: boolean
    pendingWriteRequested: boolean
  }
  const sessionQueues = new Map<string, SessionQueue>()

  function getSessionQueue(sessionId: string): SessionQueue {
    let queue = sessionQueues.get(sessionId)
    if (!queue) {
      queue = {
        generation: 0,
        tail: Promise.resolve(),
        writeInFlight: false,
        pendingWriteRequested: false,
      }
      sessionQueues.set(sessionId, queue)
    }
    return queue
  }

  /** Bumps sessionId's generation synchronously, invalidating any not-yet-started write for it. */
  function invalidateSession(sessionId: string): void {
    const queue = getSessionQueue(sessionId)
    queue.generation += 1
    queue.pendingWriteRequested = false
  }

  /**
   * Runs `task` strictly after every previously enqueued task for this
   * sessionId, never concurrently with them. A rejected task does not break
   * the chain for whatever is enqueued next (each task already handles its
   * own errors internally — see performSave/deleteOneRecord — so this is a
   * defensive backstop, not the primary error path).
   */
  function enqueueForSession(sessionId: string, task: () => Promise<void>): Promise<void> {
    const queue = getSessionQueue(sessionId)
    const run = queue.tail.then(task, task)
    queue.tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  let restorableById = new Map<string, RestoredSession>()

  let channel: BroadcastChannel | null = null
  let lastOtherTabHeartbeatAt = 0
  let lastLeaseSessionId: string | null = null
  let lastLeaseRefreshAt = 0

  function getDatabase(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = openDatabase().catch((error: unknown) => {
        dbPromise = null // allow a fresh attempt next time; storageAvailable gates whether callers bother
        throw error
      })
    }
    return dbPromise
  }

  function reportFailure(error: unknown): AutoSaveFailureKind {
    const kind = classifyError(error)
    autoSaveStatus.value = { kind }
    if (isTerminalFailure(kind)) storageAvailable = false
    return kind
  }

  function reportSuccess(): void {
    // A successful operation clears a retryable warning; unavailable/quota
    // are not cleared here since storageAvailable already stops retries.
    if (autoSaveStatus.value && !isTerminalFailure(autoSaveStatus.value.kind)) {
      autoSaveStatus.value = null
    }
  }

  function announceEditing(): void {
    if (!activeSessionId) return
    channel?.postMessage({ type: 'editing', tabId, sessionId: activeSessionId } satisfies SessionBroadcastMessage)
    if (
      lastLeaseSessionId !== activeSessionId ||
      Date.now() - lastLeaseRefreshAt >= TAB_HEARTBEAT_MS
    ) {
      lastLeaseSessionId = activeSessionId
      lastLeaseRefreshAt = Date.now()
      void refreshLease(activeSessionId)
    }
  }

  function leaseId(sessionId: string): string {
    return `${sessionId}:${tabId}`
  }

  async function refreshLease(sessionId: string): Promise<void> {
    if (!storageAvailable) return
    try {
      const db = await getDatabase()
      if (activeSessionId !== sessionId) return
      await putLease(db, {
        leaseId: leaseId(sessionId),
        sessionId,
        tabId,
        expiresAt: Date.now() + LEASE_TTL_MS,
      })
    } catch {
      // A lease is retention metadata, not document persistence. Saving the
      // document remains available even if this best-effort refresh fails.
    }
  }

  async function clearLease(sessionId: string): Promise<void> {
    if (!storageAvailable) return
    try {
      await deleteLease(await getDatabase(), leaseId(sessionId))
    } catch {
      // Expired leases are removed by the next startup sweep.
    }
  }

  /**
   * Writes the current document under `sessionId`, provided that session is
   * still the active one and hasn't been invalidated by a cleanup since
   * this write was requested. `generationAtRequest` is re-checked
   * immediately before the transaction opens (not just at enqueue time) so
   * a write that has been sitting behind a slow prior write on the same
   * queue can still bail out if Remove file/Restore original/download/
   * Discard invalidated it in the meantime — this is what makes an old
   * write unable to resurrect a record cleanup already removed, or already
   * intends to remove once this task's turn comes up.
   */
  async function performSave(sessionId: string, generationAtRequest: number): Promise<void> {
    if (!storageAvailable || sessionConflictActive) return
    // Cheap first check: this task may have been sitting behind an earlier
    // one on the same queue and could already be invalidated before doing
    // any other work at all.
    if (getSessionQueue(sessionId).generation !== generationAtRequest) return
    if (activeSessionId !== sessionId) return // superseded by a different document/session entirely
    if (!document.value || !history.value) return
    if (history.value.past.length === 0) return // AS-05: nothing committed yet, nothing to recover

    const raw = serializeRecoverySession({
      fileName: document.value.fileName,
      original: document.value.original,
      current: document.value.current,
      lastExported: lastExported.value,
      history: history.value,
      sessionId,
      ownerTabId: tabId,
      revision: activeRevision + 1,
    })

    const budgeted = applyStorageBudget(raw)
    if (!budgeted.ok) {
      autoSaveStatus.value = { kind: 'too-large' }
      return
    }

    try {
      const db = await getDatabase()
      // Re-check: the only await between the first check above and opening
      // the write transaction is this one, so this is the check that
      // actually matters for a cleanup that arrives while getDatabase() is
      // pending.
      if (getSessionQueue(sessionId).generation !== generationAtRequest) return
      const outcome = await compareAndWrite(db, budgeted.record)
      if (outcome.status === 'conflict') {
        sessionConflictActive = true
        sessionConflict.value = true
        return
      }
      activeRevision = budgeted.record.revision
      reportSuccess()
    } catch (error) {
      reportFailure(error)
    }
  }

  /**
   * Starts (or coalesces into) a save for `sessionId`. Never lets two
   * writes for the same session run at once: the queue's `writeInFlight` gates that at
   * the request level, and the per-session queue guarantees it at the
   * IndexedDB level too, as a second, independent enforcement of the same
   * rule. If more changes arrive while a write is running, only the fact
   * that *something* changed is remembered (`pendingWriteRequested`); the
   * retry re-reads document/history live, so it always persists whatever
   * is current at that moment rather than a stale snapshot from when it was
   * first requested.
   */
  async function runSave(sessionId: string): Promise<void> {
    const queue = getSessionQueue(sessionId)
    queue.writeInFlight = true
    queue.pendingWriteRequested = false
    const generationAtRequest = queue.generation
    try {
      await enqueueForSession(sessionId, () => performSave(sessionId, generationAtRequest))
    } finally {
      queue.writeInFlight = false
      if (
        queue.pendingWriteRequested &&
        queue.generation === generationAtRequest &&
        activeSessionId === sessionId
      ) {
        queue.pendingWriteRequested = false
        void runSave(sessionId)
      }
    }
  }

  /**
   * Requests a save right away. Normal edits reach this only after the
   * debounce window; tab lifecycle events use it to flush pending work.
   */
  function requestSaveNow(): void {
    if (!storageAvailable || sessionConflictActive) return
    if (!activeSessionId) return
    const queue = getSessionQueue(activeSessionId)
    if (queue.writeInFlight) {
      queue.pendingWriteRequested = true
      return
    }
    void runSave(activeSessionId)
  }

  function cancelScheduledSave(): void {
    if (scheduledSaveTimer !== null) clearTimeout(scheduledSaveTimer)
    scheduledSaveTimer = null
    scheduledSessionId = null
  }

  function scheduleSave(): void {
    if (
      !storageAvailable ||
      sessionConflictActive ||
      !activeSessionId ||
      !history.value ||
      history.value.past.length === 0
    ) return
    cancelScheduledSave()
    scheduledSessionId = activeSessionId
    scheduledSaveTimer = setTimeout(() => {
      const sessionId = scheduledSessionId
      scheduledSaveTimer = null
      scheduledSessionId = null
      if (sessionId === activeSessionId) requestSaveNow()
    }, AUTO_SAVE_DEBOUNCE_MS)
  }

  /** Flushes only a genuinely pending edit; lifecycle events stay cheap when nothing changed. */
  function flushScheduledSave(): void {
    if (scheduledSaveTimer === null) return
    cancelScheduledSave()
    requestSaveNow()
  }

  /**
   * Deletes sessionIds' stored records. Invalidates every id's generation
   * synchronously first — before any async work starts — so a write for
   * any of them that is still queued (not yet past its own `await
   * getDatabase()`) is guaranteed to observe the invalidation. Each id's
   * delete is then enqueued on that session's own queue, ordered after
   * whatever write, if any, had already started there; unrelated sessions'
   * queues are untouched, so clearing one session never blocks or
   * invalidates another.
   */
  interface SessionCleanupRequest {
    sessionId: string
    minimumRevision?: number
  }

  function clearStoredSessions(requests: readonly SessionCleanupRequest[]): Promise<void> {
    if (!storageAvailable || requests.length === 0) return Promise.resolve()
    for (const { sessionId } of requests) invalidateSession(sessionId)
    return Promise.all(
      requests.map(({ sessionId, minimumRevision = 0 }) =>
        enqueueForSession(sessionId, () => tombstoneOneRecord(sessionId, minimumRevision)),
      ),
    ).then(() => undefined)
  }

  async function tombstoneOneRecord(sessionId: string, minimumRevision: number): Promise<void> {
    try {
      const db = await getDatabase()
      await tombstoneRecord(db, sessionId, tabId, minimumRevision)
      reportSuccess()
    } catch (error) {
      reportFailure(error)
    }
  }

  async function handleDocumentCleared(): Promise<void> {
    cancelScheduledSave()
    const sessionToClear = activeSessionId
    const revisionToClear = activeRevision
    activeSessionId = null
    activeRevision = 0
    sessionConflictActive = false
    sessionConflict.value = false
    if (sessionToClear) {
      void clearLease(sessionToClear)
      await clearStoredSessions([{ sessionId: sessionToClear, minimumRevision: revisionToClear }])
    }
  }

  watch([document, history], () => {
    documentGeneration += 1

    if (!document.value || !history.value) {
      void handleDocumentCleared()
      return
    }

    if (suppressNextSchedule) {
      suppressNextSchedule = false
      return
    }

    // Normally set explicitly by resumeSession() before restoreSession() runs;
    // this covers a fresh import, which useAutoSave otherwise cannot
    // distinguish from any other document/history change.
    activeSessionId ??= createId()

    scheduleSave()
    announceEditing()
  })

  function handleChannelMessage(event: MessageEvent<unknown>): void {
    if (!isSessionBroadcastMessage(event.data) || event.data.tabId === tabId) return
    if (event.data.sessionId !== activeSessionId) return // a different document — not a conflict
    if (event.data.type === 'editing') {
      lastOtherTabHeartbeatAt = Date.now()
      otherTabEditing.value = true
    } else {
      otherTabEditing.value = false
    }
  }

  function checkOtherTabStaleness(): void {
    if (otherTabEditing.value && Date.now() - lastOtherTabHeartbeatAt > TAB_STALE_MS) {
      otherTabEditing.value = false
    }
  }

  // Flush a pending debounced edit while the browser still gives the page
  // an opportunity to start its IndexedDB transaction. None of these
  // events can guarantee survival of a force-kill or power loss.
  function handleVisibilityChange(): void {
    if (window.document.visibilityState === 'hidden') flushScheduledSave()
  }

  function handlePageHide(): void {
    flushScheduledSave()
  }

  function handleBeforeUnload(): void {
    flushScheduledSave()
    if (activeSessionId) {
      channel?.postMessage({ type: 'closing', tabId, sessionId: activeSessionId } satisfies SessionBroadcastMessage)
      void clearLease(activeSessionId)
    }
  }

  // Guarded rather than assumed: this composable's setup runs unconditionally
  // (not gated behind onMounted — see AS-01), and must not crash in a
  // non-browser context (e.g. this file's own Node-based test environment).
  const hasWindow = typeof window !== 'undefined'

  try {
    channel = hasWindow ? new BroadcastChannel(BROADCAST_CHANNEL_NAME) : null
    channel?.addEventListener('message', handleChannelMessage)
  } catch {
    channel = null
  }
  const heartbeatTimer = setInterval(() => {
    if (document.value && activeSessionId) announceEditing()
  }, TAB_HEARTBEAT_MS)
  const staleCheckTimer = setInterval(checkOtherTabStaleness, TAB_HEARTBEAT_MS)
  if (hasWindow) {
    window.document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  onScopeDispose(() => {
    cancelScheduledSave()
    if (hasWindow) {
      window.document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    clearInterval(heartbeatTimer)
    clearInterval(staleCheckTimer)
    if (activeSessionId) {
      channel?.postMessage({ type: 'closing', tabId, sessionId: activeSessionId } satisfies SessionBroadcastMessage)
      void clearLease(activeSessionId)
    }
    channel?.close()
  })

  async function checkForExistingSessions(): Promise<void> {
    const startGeneration = documentGeneration
    try {
      const db = await getDatabase()
      const [rawRecords, rawLeases] = await Promise.all([readAllRecords(db), readAllLeases(db)])
      const now = Date.now()
      const validLeases = rawLeases.filter(isSessionLease)
      const activeSessionIds = new Set(
        validLeases.filter((lease) => lease.expiresAt > now).map((lease) => lease.sessionId),
      )
      const staleLeaseIds = validLeases
        .filter((lease) => lease.expiresAt <= now)
        .map((lease) => lease.leaseId)
      await Promise.all(staleLeaseIds.map((id) => deleteLease(db, id)))

      const restored = new Map<string, RestoredSession>()
      const quarantined: QuarantinedSessionInfo[] = []
      const invalidIds: string[] = []

      for (const raw of rawRecords) {
        if (isPersistedSessionTombstone(raw)) continue
        const result = deserializeSession(raw)
        if (result.ok) {
          restored.set(result.value.sessionId, result.value)
          continue
        }
        if (result.error.quarantine) {
          quarantined.push(result.error.quarantine)
        } else {
          const rawId = extractSessionId(raw)
          if (rawId) invalidIds.push(rawId)
        }
      }

      const restorableSummaries: SessionSummary[] = [...restored.values()].map((session) => ({
        sessionId: session.sessionId,
        savedAt: session.savedAt,
      }))
      const retention = sweepRetention(restorableSummaries, quarantined, activeSessionIds, now)
      await clearStoredSessions(
        [...invalidIds, ...retention.evictedIds].map((sessionId) => ({ sessionId })),
      )

      if (documentGeneration !== startGeneration) return // AS-03: a document became active meanwhile

      const keepIds = new Set(retention.keep.map((entry) => entry.sessionId))
      restorableById = new Map([...restored].filter(([id]) => keepIds.has(id)))
      recoverableSessions.value = [...restorableById.values()]
        .map((session) => getSessionPreview(session))
        .sort((a, b) => b.savedAt - a.savedAt)
      quarantinedSessions.value = retention.quarantineKeep
    } catch (error) {
      if (documentGeneration === startGeneration) reportFailure(error)
    }
  }

  void checkForExistingSessions()

  function resumeSession(sessionId?: string): void {
    const targetId = sessionId ?? pendingResume.value?.sessionId
    if (!targetId) return
    const target = restorableById.get(targetId)
    if (!target) return

    suppressNextSchedule = true
    activeSessionId = target.sessionId
    activeRevision = target.revision
    sessionConflictActive = false
    sessionConflict.value = false

    params.restoreSession({
      fileName: target.fileName,
      original: target.original,
      current: target.current,
      lastExported: target.lastExported,
      history: target.history,
    })

    restorableById.delete(targetId)
    // Only one document can be active. Other records remain untouched in
    // IndexedDB and will be offered next visit, but the modal closes now so
    // it cannot replace the document the user just resumed.
    recoverableSessions.value = []
    quarantinedSessions.value = []
    announceEditing()
  }

  function discardSession(sessionId?: string): void {
    const targetId = sessionId ?? pendingResume.value?.sessionId
    if (!targetId) return
    restorableById.delete(targetId)
    recoverableSessions.value = recoverableSessions.value.filter((entry) => entry.sessionId !== targetId)
    void clearStoredSessions([{ sessionId: targetId }])
  }

  function discardQuarantinedSession(sessionId: string): void {
    quarantinedSessions.value = quarantinedSessions.value.filter((entry) => entry.sessionId !== sessionId)
    void clearStoredSessions([{ sessionId }])
  }

  /** Dismisses the recoverable-session prompt for this visit without touching storage — sessions remain offered next time. */
  function dismissRecoverablePrompt(): void {
    recoverableSessions.value = []
    quarantinedSessions.value = []
  }

  function restoreOriginal(): boolean {
    // Restoring keeps editing the same document (reset to its original
    // content) rather than clearing it, and is itself pushed onto history
    // as an undoable step — so history.past.length stays > 0 afterward, and
    // the watcher below would otherwise see a normal recoverable change and
    // schedule a fresh save that immediately re-creates the session record
    // clearStoredSessions is about to remove. suppressNextSchedule is the
    // only thing that stops that: bumping this session's generation (via
    // clearStoredSessions) does not help here, since the watcher's own save
    // request captures a *new*, already-current generation, not a stale one.
    cancelScheduledSave()
    suppressNextSchedule = true
    const restored = params.restoreOriginal()
    if (restored) {
      const sessionToClear = activeSessionId
      const revisionToClear = activeRevision
      if (sessionToClear) {
        void clearLease(sessionToClear)
        activeSessionId = createId()
        activeRevision = 0
        sessionConflictActive = false
        sessionConflict.value = false
        void clearStoredSessions([{ sessionId: sessionToClear, minimumRevision: revisionToClear }])
        announceEditing()
      }
    } else {
      suppressNextSchedule = false
    }
    return restored
  }

  function downloadDocument(formatting: JsonFormatting): boolean {
    const succeeded = params.downloadDocument(formatting)
    if (succeeded && activeSessionId) {
      cancelScheduledSave()
      const sessionToClear = activeSessionId
      const revisionToClear = activeRevision
      void clearLease(sessionToClear)
      activeSessionId = createId()
      activeRevision = 0
      sessionConflictActive = false
      sessionConflict.value = false
      void clearStoredSessions([{ sessionId: sessionToClear, minimumRevision: revisionToClear }])
      announceEditing()
    }
    return succeeded
  }

  return {
    pendingResume,
    recoverableSessions,
    quarantinedSessions,
    otherTabEditing,
    sessionConflict,
    storageWarning,
    autoSaveStatus,
    resumeSession,
    discardSession,
    discardQuarantinedSession,
    dismissRecoverablePrompt,
    restoreOriginal,
    downloadDocument,
  }
}

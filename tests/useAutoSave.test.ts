import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createJsonHistory } from '@/core/json/history'
import { serializeSession, type PersistedSession } from '@/core/json/sessionStorage'
import type { JsonValue, LoadedJsonDocument } from '@/core/json/types'

import { useAutoSave, type UseAutoSaveParams } from '@/composables/useAutoSave'

interface FakeIndexedDbOptions {
  /** Pre-existing stored records, as if written by a previous visit or another tab. */
  initialRecords?: unknown[]
  /** Every write fails with QuotaExceededError (permanent per the app's policy). */
  failWrites?: boolean
  /** Every write fails with a generic, non-quota error (retryable per the app's policy). */
  failWritesWithGenericError?: boolean
  /** Delays the startup getAll() read specifically, to test the AS-03 race. */
  readGate?: Promise<void>
  /**
   * Delays every write transaction's completion (put and delete alike)
   * until this resolves, to deterministically test out-of-order completion
   * and the cleanup-vs-in-flight-write race (AS-01/AS-02 hardening).
   */
  writeGate?: Promise<void>
  /**
   * Object store names that already exist before this database is ever
   * opened by the code under test, simulating a real upgrade from an older
   * DB_VERSION (e.g. the rejected v1 single-slot store) rather than a
   * brand-new database.
   */
  preexistingStoreNames?: string[]
  /** Record stored under DB v1's unkeyed `session/current` slot. */
  legacyRecord?: unknown
}

/**
 * Models the real IndexedDB contract useAutoSave relies on: a single object
 * store keyed by `sessionId` (get/getAll/put/delete), reached through
 * db.transaction(name, mode).objectStore(name). Multi-record and keyed on
 * purpose — useAutoSave persists one record per document session, not a
 * single global slot.
 */
class FakeIndexedDb {
  readonly writes: unknown[] = []
  deleteAttempts = 0
  readonly factory: IDBFactory

  private readonly stores = new Map<string, Map<string, unknown>>()
  private lastTouchedSessionKey: string | undefined
  /** Mutable on purpose: tests toggle these mid-run to simulate a failure clearing up. */
  failWrites: boolean
  failWritesWithGenericError: boolean
  private readonly readGate: Promise<void> | undefined
  private readonly writeGate: Promise<void> | undefined
  private readonly storeNames = new Set<string>()

  constructor(options: FakeIndexedDbOptions = {}) {
    this.ensureStore('sessions')
    for (const record of options.initialRecords ?? []) this.seedRecord(record)
    this.failWrites = options.failWrites ?? false
    this.failWritesWithGenericError = options.failWritesWithGenericError ?? false
    this.readGate = options.readGate
    this.writeGate = options.writeGate
    for (const name of options.preexistingStoreNames ?? []) this.ensureStore(name)
    if (options.legacyRecord !== undefined) {
      this.ensureStore('session').set('current', structuredClone(options.legacyRecord))
    }
    this.factory = { open: () => this.open() } as IDBFactory
  }

  /** Convenience for single-session tests: the most recently touched session-store record. */
  get record(): unknown {
    return this.lastTouchedSessionKey === undefined
      ? undefined
      : this.ensureStore('sessions').get(this.lastTouchedSessionKey)
  }

  /** Live session records only; tombstones remain available through allStoredRecords. */
  get allRecords(): unknown[] {
    return [...this.ensureStore('sessions').values()].filter(
      (record) =>
        typeof record !== 'object' ||
        record === null ||
        (record as { recordType?: unknown }).recordType !== 'tombstone',
    )
  }

  get allStoredRecords(): unknown[] {
    return [...this.ensureStore('sessions').values()]
  }

  /** Object store names currently present, reflecting any create/delete done during onupgradeneeded. */
  get objectStoreNames(): ReadonlySet<string> {
    return this.storeNames
  }

  /** Test-only backdoor to simulate "another tab already wrote this" without a real race. */
  seedRecord(record: unknown): void {
    const key = FakeIndexedDb.keyOf('sessions', record)
    this.ensureStore('sessions').set(key, structuredClone(record))
    this.lastTouchedSessionKey = key
  }

  seedLease(sessionId: string, expiresAt: number): void {
    const lease = { leaseId: `${sessionId}:other-tab`, sessionId, tabId: 'other-tab', expiresAt }
    this.ensureStore('session-leases').set(lease.leaseId, lease)
  }

  private ensureStore(name: string): Map<string, unknown> {
    this.storeNames.add(name)
    let store = this.stores.get(name)
    if (!store) {
      store = new Map()
      this.stores.set(name, store)
    }
    return store
  }

  private static keyOf(storeName: string, record: unknown, explicitKey?: IDBValidKey): string {
    if (explicitKey !== undefined) return String(explicitKey)
    if (typeof record === 'object' && record !== null) {
      const field = storeName === 'session-leases' ? 'leaseId' : 'sessionId'
      const id = (record as Record<string, unknown>)[field]
      if (typeof id === 'string' && id.length > 0) return id
    }
    return '__missing_key__'
  }

  private open(): IDBOpenDBRequest {
    const request = {} as IDBOpenDBRequest
    void Promise.resolve().then(async () => {
      Object.defineProperty(request, 'result', { value: this.createDatabase() })
      Object.defineProperty(request, 'transaction', {
        value: this.createTransaction('sessions', 'versionchange'),
      })
      request.onupgradeneeded?.({} as IDBVersionChangeEvent)
      // A real open request succeeds only after upgrade requests complete.
      for (let index = 0; index < 5; index += 1) await Promise.resolve()
      request.onsuccess?.({} as Event)
    })
    return request
  }

  private createDatabase(): IDBDatabase {
    return {
      objectStoreNames: {
        contains: (name: string) => this.storeNames.has(name),
      },
      createObjectStore: (name: string) => {
        this.ensureStore(name)
        return {} as IDBObjectStore
      },
      deleteObjectStore: (name: string) => {
        this.storeNames.delete(name)
        this.stores.delete(name)
      },
      transaction: (storeName: string, mode: IDBTransactionMode) =>
        this.createTransaction(storeName, mode),
      close: () => undefined,
    } as IDBDatabase
  }

  private createTransaction(primaryStoreName: string, mode: IDBTransactionMode): IDBTransaction {
    const transaction = { error: null } as IDBTransaction
    let writeIssued = false
    let completed = false
    const completeIfIdle = (): void => {
      if (completed || writeIssued) return
      completed = true
      transaction.oncomplete?.({} as Event)
    }

    const objectStoreFor = (storeName: string): IDBObjectStore =>
      ({
        get: (key: IDBValidKey) =>
          this.createReadRequest(storeName, String(key), completeIfIdle),
        getAll: () => this.createReadAllRequest(storeName),
        put: (record: unknown, explicitKey?: IDBValidKey) => {
          writeIssued = true
          return this.createPutRequest(storeName, record, transaction, explicitKey)
        },
        delete: (key: IDBValidKey) => {
          writeIssued = true
          return this.createDeleteRequest(storeName, String(key), transaction)
        },
      }) as IDBObjectStore

    Object.defineProperty(transaction, 'mode', { value: mode })
    Object.defineProperty(transaction, 'objectStore', {
      value: (requestedName?: string) => objectStoreFor(requestedName ?? primaryStoreName),
    })
    return transaction
  }

  private createReadRequest(
    storeName: string,
    key: string,
    onIdleComplete: () => void,
  ): IDBRequest {
    const request = {} as IDBRequest
    void Promise.resolve().then(() => {
      Object.defineProperty(request, 'result', {
        value: structuredClone(this.ensureStore(storeName).get(key)),
      })
      request.onsuccess?.({} as Event)
      void Promise.resolve().then(onIdleComplete)
    })
    return request
  }

  private createReadAllRequest(storeName: string): IDBRequest {
    const request = {} as IDBRequest
    void Promise.resolve(this.readGate).then(() => {
      Object.defineProperty(request, 'result', {
        value: structuredClone([...this.ensureStore(storeName).values()]),
      })
      request.onsuccess?.({} as Event)
    })
    return request
  }

  private createPutRequest(
    storeName: string,
    record: unknown,
    transaction: IDBTransaction,
    explicitKey?: IDBValidKey,
  ): IDBRequest {
    const key = FakeIndexedDb.keyOf(storeName, record, explicitKey)
    if (storeName === 'sessions') this.writes.push(structuredClone(record))
    void Promise.resolve(this.writeGate).then(() => {
      if (this.failWrites) {
        Object.defineProperty(transaction, 'error', {
          value: new DOMException('Quota exceeded', 'QuotaExceededError'),
        })
        transaction.onerror?.({} as Event)
        return
      }
      if (this.failWritesWithGenericError) {
        Object.defineProperty(transaction, 'error', {
          value: new DOMException('Temporary failure', 'UnknownError'),
        })
        transaction.onerror?.({} as Event)
        return
      }
      this.ensureStore(storeName).set(key, structuredClone(record))
      if (storeName === 'sessions') this.lastTouchedSessionKey = key
      transaction.oncomplete?.({} as Event)
    })
    return {} as IDBRequest
  }

  private createDeleteRequest(
    storeName: string,
    key: string,
    transaction: IDBTransaction,
  ): IDBRequest {
    this.deleteAttempts += 1
    void Promise.resolve(this.writeGate).then(() => {
      this.ensureStore(storeName).delete(key)
      if (storeName === 'sessions') this.lastTouchedSessionKey = key
      transaction.oncomplete?.({} as Event)
    })
    return {} as IDBRequest
  }
}

/**
 * Minimal `EventTarget`-shaped double: tracks listeners per event type and
 * lets a test invoke them directly via `dispatch`, without depending on a
 * real `Event`/`EventTarget` implementation. Used to stand in for `window`
 * and `window.document` (see FakeWindow below) so visibilitychange/
 * pagehide/beforeunload wiring can be exercised under Vitest's Node test
 * environment — see the comment above the "browser event wiring" describe
 * block further down for why this, rather than jsdom/happy-dom, is used.
 */
class FakeEventTarget {
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  hasListener(type: string): boolean {
    return (this.listeners.get(type)?.size ?? 0) > 0
  }

  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }
}

class FakeDocument extends FakeEventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible'
}

/** Stands in for the global `window` via vi.stubGlobal — see FakeEventTarget above. */
class FakeWindow extends FakeEventTarget {
  readonly document = new FakeDocument()
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function deferred(): Deferred {
  let resolve = (): void => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/**
 * Drains pending microtask work. The per-session queue (AS-01/AS-02
 * hardening: enqueueForSession chains a getDatabase() await, a
 * deleteRecord()/compareAndWrite() round trip, and a Promise.all wrapper
 * per cleared session) is several microtask ticks deeper than the single
 * batched transaction useAutoSave used before, so this loops generously
 * rather than to a number tuned to the current call depth — the cost of
 * extra idle ticks is negligible, the cost of a flaky test is not.
 */
async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 40; index += 1) await Promise.resolve()
  await nextTick()
}

function persistedRecord(current: JsonValue, overrides: Partial<Parameters<typeof serializeSession>[0]> = {}) {
  return serializeSession({
    fileName: 'saved.json',
    original: 'original',
    current,
    lastExported: 'original',
    // A realistic "just saved" timestamp by default — retention (AS-04/AS-09)
    // sweeps by real wall-clock age, so a small sentinel like `123` (123ms
    // after the Unix epoch) reads as ~decades old and gets swept before a
    // test ever sees it. Tests that specifically exercise TTL/eviction pass
    // an explicit savedAt override instead.
    savedAt: Date.now(),
    history: createJsonHistory(current),
    ...overrides,
  })
}

describe('useAutoSave', () => {
  let scopes: EffectScope[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    for (const scope of scopes) scope.stop()
    scopes = []
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function setup(fake: FakeIndexedDb) {
    vi.stubGlobal('indexedDB', fake.factory)
    const document = shallowRef<LoadedJsonDocument | null>(null)
    const history = shallowRef<ReturnType<typeof createJsonHistory> | null>(null)
    const lastExported = shallowRef<JsonValue>()
    const restoreSession = vi.fn<UseAutoSaveParams['restoreSession']>()
    const restoreOriginal = vi.fn<UseAutoSaveParams['restoreOriginal']>(() => false)
    const downloadDocument = vi.fn<UseAutoSaveParams['downloadDocument']>(() => true)

    const params: UseAutoSaveParams = {
      document,
      history,
      lastExported,
      restoreSession,
      restoreOriginal,
      downloadDocument,
    }

    const scope = effectScope()
    scopes.push(scope)
    const autoSave = scope.run(() => useAutoSave(params))
    if (!autoSave) throw new Error('The auto-save composable did not initialize.')

    return {
      autoSave,
      scope,
      document,
      history,
      lastExported,
      restoreSession,
      restoreOriginal,
      downloadDocument,
    }
  }

  async function loadDocument(
    harness: ReturnType<typeof setup>,
    current: JsonValue,
    original: JsonValue = 'original',
    fileName = 'active.json',
  ): Promise<void> {
    harness.document.value = { fileName, original, current }
    harness.history.value = createJsonHistory(current)
    harness.lastExported.value = original
    await nextTick()
  }

  /** Commits at least one real history entry, since the app only persists sessions with something recoverable. */
  async function editDocument(harness: ReturnType<typeof setup>, next: JsonValue): Promise<void> {
    const current = harness.document.value
    if (!current) throw new Error('No document loaded to edit.')
    harness.document.value = { ...current, current: next }
    harness.history.value = createJsonHistory(harness.history.value?.present ?? current.current)
    // createJsonHistory alone has an empty past; commit through the same
    // shape applyEditorOperation would produce so history.past.length > 0.
    harness.history.value = {
      ...harness.history.value,
      past: [current.current],
      present: next,
    }
    await nextTick()
  }

  it('restores a valid saved session with its original, history, and exported baseline', async () => {
    const stored = persistedRecord(false)
    const fake = new FakeIndexedDb({ initialRecords: [stored] })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.pendingResume.value).toEqual({
      sessionId: stored.sessionId,
      fileName: 'saved.json',
      savedAt: stored.savedAt,
      approxSizeBytes: 5,
    })

    harness.autoSave.resumeSession()
    expect(harness.restoreSession).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'saved.json',
        original: 'original',
        current: false,
        lastExported: 'original',
        history: expect.objectContaining({ present: false, grouping: null }),
      }),
    )
    expect(harness.autoSave.pendingResume.value).toBeNull()
  })

  it('closes the multi-session prompt after resuming one without deleting the others', async () => {
    const first = persistedRecord('first', { sessionId: 'first', fileName: 'first.json' })
    const second = persistedRecord('second', { sessionId: 'second', fileName: 'second.json' })
    const future = { ...persistedRecord('future', { sessionId: 'future' }), schemaVersion: 99 }
    const fake = new FakeIndexedDb({ initialRecords: [first, second, future] })
    const harness = setup(fake)
    await flushAsyncWork()

    harness.autoSave.resumeSession('first')

    expect(harness.autoSave.recoverableSessions.value).toHaveLength(0)
    expect(harness.autoSave.quarantinedSessions.value).toHaveLength(0)
    expect(fake.allRecords).toHaveLength(3) // hidden for this visit, not discarded
  })

  // AS-01 hardening: persistence used to be debounced by an artificial
  // 1500ms window. It is now immediate-fire-with-coalescing instead — a
  // recoverable change starts a write right away, and the only thing that
  // gets debounced is *how many separate transactions* a burst of rapid
  // edits produces (still just one), not *when* the first one starts. The
  // six tests below (this one plus the next three, plus two more in the
  // "browser event wiring" describe block further down for proof 6) map
  // directly onto the six proofs required for this contract.

  it('[AS-01 proof 1] starts persisting a recoverable change immediately, without advancing any timer', async () => {
    const fake = new FakeIndexedDb()
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')

    await editDocument(harness, 'first-edit')
    await flushAsyncWork() // no vi.advanceTimersByTimeAsync anywhere in this test

    expect(fake.writes).toHaveLength(1)
    expect(fake.record).toEqual(expect.objectContaining({ current: 'first-edit' }))
  })

  it('[AS-01 proofs 2, 3, 5] never starts a second write while one is in flight, and a delayed write cannot overwrite the newer state that follows it', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'v0')

    await editDocument(harness, 'v1')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1) // the first write was attempted...
    expect(fake.allRecords).toHaveLength(0) // ...but its gated transaction has not completed

    // Proof 2/3: further rapid edits while that write is still in flight
    // must never start a second, concurrent write attempt.
    await editDocument(harness, 'v2')
    await editDocument(harness, 'v3')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)

    gate.resolve()
    await flushAsyncWork()

    // Proof 5: exactly one retry follows the delayed write's completion
    // (v2 and v3 coalesced into it, not each producing their own write),
    // and it strictly supersedes — never gets overwritten by — the delayed
    // first write, because the per-session queue guarantees the retry can
    // only start after the first write's transaction has finished.
    expect(fake.writes).toHaveLength(2)
    const [firstWrite, secondWrite] = fake.writes as PersistedSession[]
    expect(firstWrite?.current).toBe('v1')
    expect(secondWrite?.current).toBe('v3')
    expect(secondWrite?.revision).toBeGreaterThan(firstWrite?.revision ?? 0)
    expect(fake.record).toEqual(expect.objectContaining({ current: 'v3', revision: secondWrite?.revision }))
  })

  it('[AS-01 proof 4] coalesces several rapid edits into a single write reflecting only the latest state', async () => {
    // Gated deterministically, same as the test above: without an artificial
    // debounce window, whether an ungated burst of edits actually overlaps
    // one write's real (micro-task-timed) completion is a race, not a
    // guarantee — the gate removes that race so this asserts the contract
    // itself, not how fast the fake IndexedDB happens to resolve.
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'v0')

    await editDocument(harness, 'v1') // starts the one gated write
    await flushAsyncWork()
    for (const value of ['v2', 'v3', 'v4', 'v5']) {
      await editDocument(harness, value) // all coalesce while v1's write is still in flight
    }
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)

    gate.resolve()
    await flushAsyncWork()

    expect(fake.writes).toHaveLength(2)
    expect(fake.record).toEqual(expect.objectContaining({ current: 'v5' }))
  })

  // AS-02 hardening: an in-flight write's transaction can finish after
  // Remove file / Restore original / a download / Discard has already
  // asked to clear that same session. Each test below deterministically
  // gates a write mid-transaction, triggers the cleanup action while it is
  // still pending, then releases the write and confirms the record does
  // not reappear — proving the delete (ordered after, on the same
  // per-session queue) always wins, never the stale write.

  it('[AS-02 race 1] does not resurrect the record if an in-flight write completes after Remove file', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first-edit')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1) // write attempted, gated — not yet completed
    expect(fake.allRecords).toHaveLength(0)

    harness.document.value = null
    harness.history.value = null
    await nextTick()
    await flushAsyncWork() // Remove file's cleanup enqueues its delete behind the gated write

    gate.resolve()
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
  })

  it('[AS-02 race 2] does not resurrect the record if an in-flight write completes after Restore original', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first-edit')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)
    expect(fake.allRecords).toHaveLength(0)

    harness.restoreOriginal.mockReturnValue(true)
    expect(harness.autoSave.restoreOriginal()).toBe(true)
    await flushAsyncWork()

    gate.resolve()
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
  })

  it('[AS-02 race 3] does not resurrect the record if an in-flight write completes after a download', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first-edit')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)
    expect(fake.allRecords).toHaveLength(0)

    expect(harness.autoSave.downloadDocument('formatted')).toBe(true)
    await flushAsyncWork()

    gate.resolve()
    await flushAsyncWork()

    expect(harness.downloadDocument).toHaveBeenCalledWith('formatted')
    expect(fake.allRecords).toHaveLength(0)
  })

  it('[AUTO-01] cancels a coalesced retry when download cleans an in-flight session', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'v0')
    await editDocument(harness, 'v1')
    await flushAsyncWork()
    await editDocument(harness, 'v2') // coalesced behind v1
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)

    expect(harness.autoSave.downloadDocument('formatted')).toBe(true)
    gate.resolve()
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
    expect(fake.allStoredRecords).toEqual([
      expect.objectContaining({ recordType: 'tombstone' }),
    ])
  })

  it('[AUTO-01] cancels a coalesced retry when Restore original cleans an in-flight session', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'v0', 'original')
    await editDocument(harness, 'v1')
    await flushAsyncWork()
    await editDocument(harness, 'v2') // coalesced behind v1
    await flushAsyncWork()

    harness.restoreOriginal.mockImplementation(() => {
      const loaded = harness.document.value
      const state = harness.history.value
      if (!loaded || !state) return false
      harness.document.value = { ...loaded, current: loaded.original }
      harness.history.value = {
        ...state,
        past: [...state.past, state.present],
        present: loaded.original,
        future: [],
      }
      return true
    })
    expect(harness.autoSave.restoreOriginal()).toBe(true)
    await nextTick()
    gate.resolve()
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
    expect(fake.allStoredRecords).toEqual([
      expect.objectContaining({ recordType: 'tombstone' }),
    ])
  })

  it('starts a new session identity when editing again after a successful download', async () => {
    const fake = new FakeIndexedDb()
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'v0')
    await editDocument(harness, 'v1')
    await flushAsyncWork()
    const oldSessionId = (fake.record as PersistedSession).sessionId

    expect(harness.autoSave.downloadDocument('formatted')).toBe(true)
    await flushAsyncWork()
    await editDocument(harness, 'v2 after download')
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(1)
    const newRecord = fake.allRecords[0] as PersistedSession
    expect(newRecord.sessionId).not.toBe(oldSessionId)
    expect(newRecord.current).toBe('v2 after download')
    expect(fake.allStoredRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordType: 'tombstone', sessionId: oldSessionId }),
        expect.objectContaining({ sessionId: newRecord.sessionId, current: 'v2 after download' }),
      ]),
    )
  })

  it('[AS-02 race 4] does not resurrect the record if an in-flight write completes after Discard', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first-edit')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)
    expect(fake.allRecords).toHaveLength(0)
    const sessionId = (fake.writes[0] as PersistedSession).sessionId

    harness.autoSave.discardSession(sessionId)
    await flushAsyncWork()

    gate.resolve()
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
  })

  it('[AS-02 race 5] clears one session without blocking or being affected by a different session', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({ writeGate: gate.promise })
    const harnessA = setup(fake)
    const harnessB = setup(fake)
    await flushAsyncWork()

    await loadDocument(harnessA, 'from A', 'from A', 'a.json')
    await editDocument(harnessA, 'a-edited')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1) // session A's write attempted, gated
    const sessionIdA = (fake.writes[0] as PersistedSession).sessionId

    await loadDocument(harnessB, 'from B', 'from B', 'b.json')
    await editDocument(harnessB, 'b-edited')
    await flushAsyncWork()
    // Session B's write is attempted independently: A's still-gated write,
    // queued under A's own sessionId, does not block B's.
    expect(fake.writes).toHaveLength(2)
    const sessionIdB = (fake.writes[1] as PersistedSession).sessionId
    expect(sessionIdB).not.toBe(sessionIdA)

    harnessA.autoSave.discardSession(sessionIdA) // A's write is still gated at this point
    await flushAsyncWork()

    gate.resolve() // releases both A's and B's gated writes together
    await flushAsyncWork()

    const remainingIds = fake.allRecords.map((record) => (record as PersistedSession).sessionId)
    expect(remainingIds).not.toContain(sessionIdA)
    expect(remainingIds).toContain(sessionIdB)
  })

  // Section 3 hardening: DB v1 used a single-slot store. The current upgrade
  // used a single-slot store literally named 'session' (LEGACY_STORE_NAME
  // in useAutoSave.ts) instead of the current per-session 'sessions' store.
  // Verified via `git log --all` / `git branch --merged main` that this
  // feature, on any schema version including that v1 store, was never
  // merged into main or deployed — there is no production data on it to
  // migrate. This test does not assert that (it can't be proven from
  // inside a unit test), only that a database which already has that
  // legacy store present — as a real upgrading browser would — opens and
  // upgrades cleanly rather than crashing, and that the new store is fully
  // functional immediately afterward.
  it('upgrades cleanly from a pre-existing legacy (v1) database without failing', async () => {
    const fake = new FakeIndexedDb({ preexistingStoreNames: ['session'] })
    const harness = setup(fake)
    await flushAsyncWork()

    // The upgrade ran without throwing: startup completed normally, with no
  // records to offer and no failure status surfaced.
    expect(harness.autoSave.autoSaveStatus.value).toBeNull()
    expect(harness.autoSave.pendingResume.value).toBeNull()
    expect(fake.objectStoreNames.has('session')).toBe(true) // preserved; never silently dropped

    // The new per-session store works normally after the upgrade.
    await loadDocument(harness, 'after-upgrade')
    await editDocument(harness, 'after-upgrade-edited')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)
    expect(fake.record).toEqual(expect.objectContaining({ current: 'after-upgrade-edited' }))
  })

  it('migrates a valid DB v1 single-slot record without deleting the legacy store', async () => {
    const modern = persistedRecord({ migrated: true }, { fileName: 'legacy.json' })
    const legacy = {
      schemaVersion: modern.schemaVersion,
      fileName: modern.fileName,
      savedAt: modern.savedAt,
      original: modern.original,
      current: modern.current,
      lastExported: modern.lastExported,
      history: modern.history,
    }
    const fake = new FakeIndexedDb({
      preexistingStoreNames: ['session'],
      legacyRecord: legacy,
    })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.pendingResume.value).toEqual(
      expect.objectContaining({ fileName: 'legacy.json' }),
    )
    expect(fake.objectStoreNames.has('session')).toBe(true)
    expect(fake.allRecords).toEqual([
      expect.objectContaining({
        fileName: 'legacy.json',
        current: { migrated: true },
        ownerTabId: 'legacy-v1-migration',
        revision: 1,
      }),
    ])
  })

  it('replaces a malformed stored record with a tombstone without offering to restore it', async () => {
    const fake = new FakeIndexedDb({ initialRecords: [{ schemaVersion: 1, sessionId: 'broken' }] })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.pendingResume.value).toBeNull()
    expect(fake.allStoredRecords).toEqual([
      expect.objectContaining({ recordType: 'tombstone', sessionId: 'broken' }),
    ])
    expect(fake.allRecords).toHaveLength(0)
  })

  it('preserves a valid-looking record from a newer unsupported schema version', async () => {
    const newerRecord = { ...persistedRecord('future'), schemaVersion: 2 }
    const fake = new FakeIndexedDb({ initialRecords: [newerRecord] })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.pendingResume.value).toBeNull()
    expect(fake.deleteAttempts).toBe(0)
    expect(fake.record).toEqual(newerRecord)
  })

  it('exposes a quarantined future-schema session distinctly, with enough info to discard it', async () => {
    const newerRecord = {
      ...persistedRecord('future'),
      schemaVersion: 5,
      sessionId: 'future-session',
      fileName: 'from-tomorrow.json',
    }
    const fake = new FakeIndexedDb({ initialRecords: [newerRecord] })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.quarantinedSessions.value).toEqual([
      { sessionId: 'future-session', fileName: 'from-tomorrow.json', savedAt: newerRecord.savedAt, schemaVersion: 5 },
    ])

    harness.autoSave.discardQuarantinedSession('future-session')
    await flushAsyncWork()

    expect(harness.autoSave.quarantinedSessions.value).toHaveLength(0)
    expect(fake.allRecords).toHaveLength(0)
  })

  it('warns once and stops retrying after a quota-exceeded write failure', async () => {
    const fake = new FakeIndexedDb({ failWrites: true })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first edit')

    await flushAsyncWork()
    expect(harness.autoSave.storageWarning.value).toBe(true)
    expect(harness.autoSave.autoSaveStatus.value).toEqual({ kind: 'quota-exceeded' })
    expect(fake.writes).toHaveLength(1)

    await editDocument(harness, 'second edit')
    await flushAsyncWork()

    expect(fake.writes).toHaveLength(1)
    expect(harness.autoSave.storageWarning.value).toBe(true)
  })

  it('retries after a transient (non-quota) write failure instead of permanently disabling auto-save', async () => {
    const fake = new FakeIndexedDb({ failWritesWithGenericError: true })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first edit')

    await flushAsyncWork()
    expect(harness.autoSave.autoSaveStatus.value).toEqual({ kind: 'write-failure' })
    expect(fake.writes).toHaveLength(1)

    await editDocument(harness, 'second edit')
    await flushAsyncWork()

    // a transient/generic failure is retried on the next confirmed change
    expect(fake.writes).toHaveLength(2)
  })

  it('clears the warning once a save succeeds again after a transient failure', async () => {
    const fake = new FakeIndexedDb({ failWritesWithGenericError: true })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'first')
    await editDocument(harness, 'first edit')
    await flushAsyncWork()
    expect(harness.autoSave.autoSaveStatus.value).not.toBeNull()

    fake.failWritesWithGenericError = false
    await editDocument(harness, 'second edit')
    await flushAsyncWork()

    expect(harness.autoSave.autoSaveStatus.value).toBeNull()
    expect(harness.autoSave.storageWarning.value).toBe(false)
  })

  it('informs the user (autoSaveStatus) when IndexedDB itself is unavailable, without throwing', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const document = shallowRef<LoadedJsonDocument | null>(null)
    const history = shallowRef<ReturnType<typeof createJsonHistory> | null>(null)
    const lastExported = shallowRef<JsonValue>()
    const params: UseAutoSaveParams = {
      document,
      history,
      lastExported,
      restoreSession: vi.fn(),
      restoreOriginal: vi.fn(() => false),
      downloadDocument: vi.fn(() => true),
    }
    const scope = effectScope()
    scopes.push(scope)
    const autoSave = scope.run(() => useAutoSave(params))
    if (!autoSave) throw new Error('The auto-save composable did not initialize.')
    await flushAsyncWork()

    expect(autoSave.autoSaveStatus.value).toEqual({ kind: 'unavailable' })
    expect(autoSave.pendingResume.value).toBeNull()
  })

  it('does not create a resume record for a newly imported but unedited document', async () => {
    const fake = new FakeIndexedDb()
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'unchanged', 'unchanged')

    await flushAsyncWork()

    expect(fake.writes).toHaveLength(0)
  })

  it('does not offer a stale session after a new document is loaded during the initial read', async () => {
    const gate = deferred()
    const fake = new FakeIndexedDb({
      initialRecords: [persistedRecord('stale saved document')],
      readGate: gate.promise,
    })
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'newly imported document', 'newly imported document')

    gate.resolve()
    await flushAsyncWork()

    expect(harness.autoSave.pendingResume.value).toBeNull()
    expect(harness.autoSave.recoverableSessions.value).toHaveLength(0)
  })

  it('clears the persisted session when the active file is removed', async () => {
    const fake = new FakeIndexedDb()
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'active document')
    await editDocument(harness, 'active document edited')
    await flushAsyncWork()
    expect(fake.allRecords).toHaveLength(1)

    harness.document.value = null
    harness.history.value = null
    await nextTick()
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
  })

  it('keeps two documents loaded in two tabs fully isolated from each other', async () => {
    const fake = new FakeIndexedDb()
    const harnessA = setup(fake)
    const harnessB = setup(fake)
    await flushAsyncWork()

    await loadDocument(harnessA, 'from tab A', 'from tab A', 'a.json')
    await editDocument(harnessA, 'a-edited')
    await loadDocument(harnessB, 'from tab B', 'from tab B', 'b.json')
    await editDocument(harnessB, 'b-edited')

    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(2)
    const fileNames = fake.allRecords.map((record) => (record as PersistedSession).fileName).sort()
    expect(fileNames).toEqual(['a.json', 'b.json'])
    expect(harnessA.autoSave.sessionConflict.value).toBe(false)
    expect(harnessB.autoSave.sessionConflict.value).toBe(false)
  })

  it('keeps two same-named files with different content in separate sessions', async () => {
    const fake = new FakeIndexedDb()
    const harnessA = setup(fake)
    const harnessB = setup(fake)
    await flushAsyncWork()

    await loadDocument(harnessA, 'content A', 'content A', 'same-name.json')
    await editDocument(harnessA, 'content A edited')
    await loadDocument(harnessB, 'content B', 'content B', 'same-name.json')
    await editDocument(harnessB, 'content B edited')

    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(2)
    const currents = fake.allRecords.map((record) => (record as PersistedSession).current).sort()
    expect(currents).toEqual(['content A edited', 'content B edited'])
  })

  it('refuses to overwrite a session another tab has already advanced to a newer revision', async () => {
    const fake = new FakeIndexedDb()
    const harness = setup(fake)
    await flushAsyncWork()
    await loadDocument(harness, 'v0')
    await editDocument(harness, 'v1')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(1)

    const storedAfterFirstSave = fake.record as PersistedSession
    // Simulate another tab picking up the same session and advancing it further.
    fake.seedRecord({
      ...storedAfterFirstSave,
      ownerTabId: 'a-different-tab',
      revision: storedAfterFirstSave.revision + 5,
      current: 'from another tab',
    })

    await editDocument(harness, 'v2 from this tab, now stale')
    await flushAsyncWork()

    expect(harness.autoSave.sessionConflict.value).toBe(true)
    expect((fake.record as PersistedSession).current).toBe('from another tab') // never clobbered

    // The conflict is sticky: further edits in this tab do not attempt more writes.
    const writesBefore = fake.writes.length
    await editDocument(harness, 'v3, still stale')
    await flushAsyncWork()
    expect(fake.writes).toHaveLength(writesBefore)
  })

  it('[AUTO-02] refuses to recreate a session another tab replaced with a tombstone', async () => {
    const stored = persistedRecord('shared', { sessionId: 'shared-session', revision: 4 })
    const fake = new FakeIndexedDb({ initialRecords: [stored] })
    const oldTab = setup(fake)
    const deletingTab = setup(fake)
    await flushAsyncWork()

    oldTab.autoSave.resumeSession('shared-session')
    const restoredInput = oldTab.restoreSession.mock.calls[0]?.[0]
    if (!restoredInput) throw new Error('resumeSession did not call restoreSession.')
    oldTab.document.value = {
      fileName: restoredInput.fileName,
      original: restoredInput.original,
      current: restoredInput.current,
    }
    oldTab.history.value = restoredInput.history
    oldTab.lastExported.value = restoredInput.lastExported
    await nextTick()

    deletingTab.autoSave.discardSession('shared-session')
    await flushAsyncWork()
    expect(fake.allRecords).toHaveLength(0)
    expect(fake.allStoredRecords).toEqual([
      expect.objectContaining({ recordType: 'tombstone', sessionId: 'shared-session' }),
    ])

    await editDocument(oldTab, 'old tab edit after deletion')
    await flushAsyncWork()

    expect(fake.allRecords).toHaveLength(0)
    expect(oldTab.autoSave.sessionConflict.value).toBe(true)
  })

  it('lets a resuming tab correctly claim a session and save over it without a false conflict', async () => {
    const fake = new FakeIndexedDb({ initialRecords: [persistedRecord('resumed value')] })
    const harness = setup(fake)
    await flushAsyncWork()

    harness.autoSave.resumeSession()
    // restoreSession is a spy in this harness (useJsonDocument owns the real
    // implementation); apply what it was called with, the way the real one would.
    const restoredInput = harness.restoreSession.mock.calls[0]?.[0]
    if (!restoredInput) throw new Error('resumeSession did not call restoreSession.')
    harness.document.value = {
      fileName: restoredInput.fileName,
      original: restoredInput.original,
      current: restoredInput.current,
    }
    harness.history.value = restoredInput.history
    harness.lastExported.value = restoredInput.lastExported
    await nextTick()

    await editDocument(harness, 'edited after resume')
    await flushAsyncWork()

    expect(harness.autoSave.sessionConflict.value).toBe(false)
    expect((fake.record as PersistedSession).current).toBe('edited after resume')
  })

  it('sweeps sessions past the TTL from the recoverable list and deletes them', async () => {
    const now = Date.now()
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000
    const fresh = persistedRecord('fresh', { fileName: 'fresh.json', savedAt: now - 1_000 })
    const expired = persistedRecord('old', { fileName: 'old.json', savedAt: eightDaysAgo })
    const fake = new FakeIndexedDb({ initialRecords: [fresh, expired] })
    const harness = setup(fake)
    await flushAsyncWork()

    const fileNames = harness.autoSave.recoverableSessions.value.map((s) => s.fileName)
    expect(fileNames).toEqual(['fresh.json'])
    expect(fake.allRecords).toHaveLength(1)
  })

  it('caps recoverable sessions and evicts the oldest beyond the limit', async () => {
    const now = Date.now()
    const records = Array.from({ length: 7 }, (_, i) =>
      persistedRecord(`v${i}`, { fileName: `file-${i}.json`, savedAt: now - i * 1_000 }),
    )
    const fake = new FakeIndexedDb({ initialRecords: records })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.recoverableSessions.value).toHaveLength(5)
    // newest-first; the 5 most recent (lowest index / largest savedAt) survive
    const keptFiles = harness.autoSave.recoverableSessions.value.map((s) => s.fileName)
    expect(keptFiles).toEqual(['file-0.json', 'file-1.json', 'file-2.json', 'file-3.json', 'file-4.json'])
    expect(fake.allRecords).toHaveLength(5)
  })

  it('never evicts an actively leased session when enforcing the five-session cap', async () => {
    const now = Date.now()
    const records = Array.from({ length: 6 }, (_, i) =>
      persistedRecord(`v${i}`, {
        sessionId: `session-${i}`,
        fileName: `file-${i}.json`,
        savedAt: now - i * 1_000,
      }),
    )
    const fake = new FakeIndexedDb({ initialRecords: records })
    fake.seedLease('session-5', now + 60_000) // oldest, but active in another tab
    const harness = setup(fake)
    await flushAsyncWork()

    const kept = harness.autoSave.recoverableSessions.value.map((session) => session.sessionId)
    expect(kept).toContain('session-5')
    expect(kept).not.toContain('session-4')
    expect(fake.allRecords).toHaveLength(5)
  })

  it('keeps every future-schema record quarantined regardless of age or count', async () => {
    const now = Date.now()
    const records = Array.from({ length: 7 }, (_, i) => ({
      ...persistedRecord(`future-${i}`, {
        sessionId: `future-${i}`,
        fileName: `future-${i}.json`,
        savedAt: now - (8 * 24 * 60 * 60 * 1_000 + i),
      }),
      schemaVersion: 99,
    }))
    const fake = new FakeIndexedDb({ initialRecords: records })
    const harness = setup(fake)
    await flushAsyncWork()

    expect(harness.autoSave.quarantinedSessions.value).toHaveLength(7)
    expect(fake.allRecords).toHaveLength(7)
    expect(fake.allStoredRecords).toHaveLength(7)
  })

  it('dismissing the recoverable-session prompt does not delete anything from storage', async () => {
    const fake = new FakeIndexedDb({ initialRecords: [persistedRecord('keep me')] })
    const harness = setup(fake)
    await flushAsyncWork()
    expect(harness.autoSave.recoverableSessions.value).toHaveLength(1)

    harness.autoSave.dismissRecoverablePrompt()

    expect(harness.autoSave.recoverableSessions.value).toHaveLength(0)
    expect(fake.allRecords).toHaveLength(1)
    expect(fake.deleteAttempts).toBe(0)
  })

  /**
   * Section 4 hardening: visibilitychange/pagehide/beforeunload wiring.
   *
   * This project's whole test suite, including this file, runs under
   * Vitest's `environment: 'node'` (see vite.config.ts) — confirmed by
   * direct inspection that neither `jsdom` nor `happy-dom` is installed;
   * both appear only inside vitest's own `optional: true`
   * peerDependenciesMeta in package-lock.json, unresolved. Adding either as
   * a real dependency, purely to get a `window`/`document` implementation,
   * is exactly the kind of dependency this project's "no dependency without
   * proven need" convention (and this task's explicit "não instale
   * dependências") rules out here, since the actual thing under test —
   * *does useAutoSave register the right handlers on the right targets,
   * call the right function, and remove them on unmount* — does not need a
   * real DOM at all.
   *
   * What IS achievable, and what the tests below actually do: `window` is
   * stubbed via `vi.stubGlobal` (the same technique this file already uses
   * for `indexedDB`) with a minimal hand-rolled event-target double
   * (FakeWindow/FakeDocument, above) that records `addEventListener`/
   * `removeEventListener` calls and lets a test invoke a registered
   * listener directly. This exercises useAutoSave's own logic exactly as
   * written — the real `window.addEventListener('pagehide', handler)` call,
   * the real `handler` function, the real `removeEventListener` call on
   * unmount — without emulating browser semantics that useAutoSave never
   * relies on (event bubbling/capturing, a real `Event` object's fields,
   * actual page-lifecycle timing). What this can *not* do is prove
   * anything about real browser scheduling guarantees around an actual
   * visibilitychange/pagehide/unload sequence, or about what survives an
   * ungraceful process kill — no unit test, with or without jsdom, can
   * prove that; it is a platform guarantee no browser makes. A manual
   * reload is not exercised here at all and must not be read as a stand-in
   * for an abrupt browser shutdown — it is not equivalent and this suite
   * does not claim it is.
   */
  describe('browser event wiring (visibilitychange/pagehide/beforeunload)', () => {
    it('persists a change immediately without any window event ever firing [AS-01 proof 6]', async () => {
      // No FakeWindow/vi.stubGlobal('window', ...) at all in this test —
      // hasWindow is false, exactly like every other test in this file —
      // yet the write below still happens, proving these events are not
      // the mechanism that makes persistence happen.
      const fake = new FakeIndexedDb()
      const harness = setup(fake)
      await flushAsyncWork()
      await loadDocument(harness, 'first')
      await editDocument(harness, 'first-edit')
      await flushAsyncWork()

      expect(fake.writes).toHaveLength(1)
    })

    it('triggers a save attempt when visibilitychange reports the tab as hidden', async () => {
      const fakeWindow = new FakeWindow()
      vi.stubGlobal('window', fakeWindow)
      const fake = new FakeIndexedDb()
      const harness = setup(fake)
      await flushAsyncWork()
      await loadDocument(harness, 'first')
      await editDocument(harness, 'first-edit')
      await flushAsyncWork()
      expect(fake.writes).toHaveLength(1) // already persisted before any event fires

      fakeWindow.document.visibilityState = 'hidden'
      fakeWindow.document.dispatch('visibilitychange')
      await flushAsyncWork()

      // Confirms the listener is registered on window.document and its
      // handler does call into the real save path (reinforcement, not the
      // primary mechanism — see the block comment above).
      expect(fake.writes).toHaveLength(2)
    })

    it('triggers a save attempt when pagehide fires', async () => {
      const fakeWindow = new FakeWindow()
      vi.stubGlobal('window', fakeWindow)
      const fake = new FakeIndexedDb()
      const harness = setup(fake)
      await flushAsyncWork()
      await loadDocument(harness, 'first')
      await editDocument(harness, 'first-edit')
      await flushAsyncWork()
      expect(fake.writes).toHaveLength(1)

      fakeWindow.dispatch('pagehide')
      await flushAsyncWork()

      expect(fake.writes).toHaveLength(2)
    })

    it('triggers a save attempt when beforeunload fires', async () => {
      const fakeWindow = new FakeWindow()
      vi.stubGlobal('window', fakeWindow)
      const fake = new FakeIndexedDb()
      const harness = setup(fake)
      await flushAsyncWork()
      await loadDocument(harness, 'first')
      await editDocument(harness, 'first-edit')
      await flushAsyncWork()
      expect(fake.writes).toHaveLength(1)

      fakeWindow.dispatch('beforeunload')
      await flushAsyncWork()

      expect(fake.writes).toHaveLength(2)
    })

    it('removes its visibilitychange/pagehide/beforeunload listeners when its scope is disposed', async () => {
      const fakeWindow = new FakeWindow()
      vi.stubGlobal('window', fakeWindow)
      const fake = new FakeIndexedDb()
      const harness = setup(fake)
      await flushAsyncWork()

      expect(fakeWindow.document.hasListener('visibilitychange')).toBe(true)
      expect(fakeWindow.hasListener('pagehide')).toBe(true)
      expect(fakeWindow.hasListener('beforeunload')).toBe(true)

      harness.scope.stop()

      expect(fakeWindow.document.hasListener('visibilitychange')).toBe(false)
      expect(fakeWindow.hasListener('pagehide')).toBe(false)
      expect(fakeWindow.hasListener('beforeunload')).toBe(false)
    })

    it('does not persist further changes after its scope is disposed', async () => {
      const fakeWindow = new FakeWindow()
      vi.stubGlobal('window', fakeWindow)
      const fake = new FakeIndexedDb()
      const harness = setup(fake)
      await flushAsyncWork()
      await loadDocument(harness, 'first')
      await editDocument(harness, 'first-edit')
      await flushAsyncWork()
      expect(fake.writes).toHaveLength(1)

      harness.scope.stop()

      // Vue stops every watcher created inside a disposed scope, so this
      // mutation must not reach useAutoSave's watch([document, history])
      // callback at all.
      const current = harness.document.value
      if (!current) throw new Error('No document loaded to edit.')
      harness.document.value = { ...current, current: 'after-unmount' }
      harness.history.value = { ...harness.history.value!, past: [current.current], present: 'after-unmount' }
      await nextTick()
      await flushAsyncWork()

      expect(fake.writes).toHaveLength(1) // unchanged

      // Dispatching the (now-removed) events must not somehow still reach
      // useAutoSave's handlers either.
      fakeWindow.dispatch('pagehide')
      await flushAsyncWork()
      expect(fake.writes).toHaveLength(1)
    })
  })
})

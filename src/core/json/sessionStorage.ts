import type { JsonHistoryState } from './history'
import type { JsonValue } from './types'

export const SESSION_SCHEMA_VERSION = 1

/**
 * How much persisted history each side (past/future) keeps, and the
 * approximate byte ceiling for a whole session record. These are storage
 * budgets only — they do not change the in-memory undo/redo limit
 * (DEFAULT_HISTORY_LIMIT in history.ts), only how much of it gets written to
 * IndexedDB. Entries farthest from `current` are dropped first.
 */
export const MAX_PERSISTED_HISTORY_ENTRIES = 20
export const MAX_SESSION_BYTES_APPROX = 8 * 1024 * 1024

/**
 * Ceiling for history.limit and for past/future array lengths during
 * validation. The app always uses DEFAULT_HISTORY_LIMIT (50); this is a
 * generous upper bound for rejecting corrupt or hostile records, not a real
 * product limit.
 */
export const MAX_HISTORY_LIMIT = 200

export const MAX_FILE_NAME_LENGTH = 512

export interface PersistedJsonHistory {
  past: JsonValue[]
  future: JsonValue[]
  limit: number
}

export type PersistedLastExported = { saved: false } | { saved: true; value: JsonValue }

export interface PersistedSession {
  schemaVersion: number
  sessionId: string
  ownerTabId: string
  revision: number
  fileName: string
  savedAt: number
  original: JsonValue
  current: JsonValue
  lastExported: PersistedLastExported
  history: PersistedJsonHistory
}

/**
 * Minimal deletion marker. It intentionally contains no filename or JSON
 * content: its only job is to make deletion a durable, revisioned state so a
 * suspended or stale tab cannot recreate a session merely because the live
 * record is absent.
 */
export interface PersistedSessionTombstone {
  recordType: 'tombstone'
  sessionId: string
  ownerTabId: string
  revision: number
  deletedAt: number
}

export interface RestoredSession {
  sessionId: string
  revision: number
  fileName: string
  savedAt: number
  original: JsonValue
  current: JsonValue
  lastExported: JsonValue | undefined
  history: JsonHistoryState
}

export interface SessionPreview {
  sessionId: string
  fileName: string
  savedAt: number
  approxSizeBytes: number
}

/** A record from a schema version newer than this build understands. Kept, never deleted. */
export interface QuarantinedSessionInfo {
  sessionId: string
  fileName: string | null
  savedAt: number | null
  schemaVersion: number
}

export type SessionDeserializeErrorCode = 'invalid-record' | 'unsupported-version'

export interface SessionDeserializeError {
  code: SessionDeserializeErrorCode
  message: string
  /** Present only for 'unsupported-version': lets the caller quarantine rather than discard. */
  quarantine?: QuarantinedSessionInfo
}

export type SessionDeserializeResult =
  | { ok: true; value: RestoredSession }
  | { ok: false; error: SessionDeserializeError }

export interface SerializeSessionInput {
  fileName: string
  original: JsonValue
  current: JsonValue
  lastExported: JsonValue | undefined
  history: JsonHistoryState
  savedAt?: number
  /** Identity fields owned by useAutoSave. Optional here so this module stays usable in isolation; each defaults to a fresh/neutral value when omitted. */
  sessionId?: string
  ownerTabId?: string
  revision?: number
}

function generateId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function serializeSession(input: SerializeSessionInput): PersistedSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: input.sessionId ?? generateId(),
    ownerTabId: input.ownerTabId ?? 'unspecified',
    revision: input.revision ?? 1,
    fileName: input.fileName,
    savedAt: input.savedAt ?? Date.now(),
    original: input.original,
    current: input.current,
    lastExported:
      input.lastExported === undefined ? { saved: false } : { saved: true, value: input.lastExported },
    history: {
      past: input.history.past,
      future: input.history.future,
      limit: input.history.limit,
    },
  }
}

// ---------------------------------------------------------------------------
// Deep, hostile-input-safe JSON validation (AS-02)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainObjectPrototype(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Same numeric policy as core/json/parser.ts's validateNumberLiterals: every
 * number must be finite, and integers must additionally stay within
 * Number.isSafeInteger range.
 */
function isValidJsonNumber(value: number): boolean {
  if (!Number.isFinite(value)) return false
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) return false
  return true
}

/**
 * Iterative (explicit-stack) structural validation of an arbitrary value as
 * JsonValue. Iterative on purpose: a naive recursive walk over a deeply
 * nested but otherwise valid JSON document could overflow the call stack.
 * IndexedDB structured clone can also carry cycles, unlike JSON; `seen`
 * rejects those without imposing an arbitrary depth/node ceiling that would
 * make auto-save accept less JSON than the importer.
 */
export function isValidJsonValue(root: unknown): root is JsonValue {
  const stack: unknown[] = [root]
  const seen = new WeakSet<object>()

  while (stack.length > 0) {
    const value = stack.pop()

    if (value === null) continue

    if (typeof value === 'string' || typeof value === 'boolean') continue
    if (typeof value === 'number') {
      if (!isValidJsonNumber(value)) return false
      continue
    }
    // undefined, function, symbol, bigint all fall through here as invalid.
    if (typeof value !== 'object') return false
    if (seen.has(value)) return false
    seen.add(value)

    if (Array.isArray(value)) {
      for (const item of value) stack.push(item)
      continue
    }

    if (!isPlainObjectPrototype(value)) return false // rejects Date, Map, Set, class instances, ...

    for (const key of Object.keys(value)) {
      stack.push((value as Record<string, unknown>)[key])
    }
  }

  return true
}

function isValidFileName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_FILE_NAME_LENGTH
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isBoundedHistoryLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_HISTORY_LIMIT
}

function isValidRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isValidPersistedLastExported(value: unknown): value is PersistedLastExported {
  if (!isRecord(value)) return false
  if (value['saved'] === false) return true
  return value['saved'] === true && isValidJsonValue(value['value'])
}

function isValidPersistedHistory(value: unknown): value is PersistedJsonHistory {
  if (!isRecord(value)) return false
  if (!isBoundedHistoryLimit(value['limit'])) return false
  const limit = value['limit']

  const past = value['past']
  const future = value['future']
  if (!Array.isArray(past) || past.length > limit) return false
  if (!Array.isArray(future) || future.length > limit) return false

  return past.every(isValidJsonValue) && future.every(isValidJsonValue)
}

export function isValidPersistedSessionRecord(value: unknown): value is PersistedSession {
  return (
    isRecord(value) &&
    value['schemaVersion'] === SESSION_SCHEMA_VERSION &&
    isNonEmptyString(value['sessionId']) &&
    isNonEmptyString(value['ownerTabId']) &&
    isValidRevision(value['revision']) &&
    isValidFileName(value['fileName']) &&
    isFiniteTimestamp(value['savedAt']) &&
    isValidJsonValue(value['original']) &&
    isValidJsonValue(value['current']) &&
    isValidPersistedLastExported(value['lastExported']) &&
    isValidPersistedHistory(value['history'])
  )
}

export function isPersistedSessionTombstone(value: unknown): value is PersistedSessionTombstone {
  return (
    isRecord(value) &&
    value['recordType'] === 'tombstone' &&
    isNonEmptyString(value['sessionId']) &&
    isNonEmptyString(value['ownerTabId']) &&
    isValidRevision(value['revision']) &&
    isFiniteTimestamp(value['deletedAt'])
  )
}

function toRestoredSession(record: PersistedSession): RestoredSession {
  return {
    sessionId: record.sessionId,
    revision: record.revision,
    fileName: record.fileName,
    savedAt: record.savedAt,
    original: record.original,
    current: record.current,
    lastExported: record.lastExported.saved ? record.lastExported.value : undefined,
    history: {
      past: record.history.past,
      present: record.current,
      future: record.history.future,
      limit: record.history.limit,
      grouping: null,
    },
  }
}

function toQuarantineInfo(raw: Record<string, unknown>, schemaVersion: number): QuarantinedSessionInfo {
  return {
    sessionId: isNonEmptyString(raw['sessionId']) ? raw['sessionId'] : generateId(),
    fileName: typeof raw['fileName'] === 'string' ? raw['fileName'] : null,
    savedAt: isFiniteTimestamp(raw['savedAt']) ? raw['savedAt'] : null,
    schemaVersion,
  }
}

/**
 * Upgrades a record from an older schema version to the current one. There
 * is only one schema version so far, so there is nothing to migrate from
 * yet — this is the extension point for future version bumps, keyed by the
 * version being migrated *from*.
 */
const migrations: Record<number, (raw: Record<string, unknown>) => PersistedSession | null> = {}

/**
 * Converts the DB v1 single-slot record into the current per-session shape.
 * DB v1 used the same payload schema number but predated identity/revision
 * fields, so this database migration must be separate from payload-schema
 * migrations. Invalid legacy data is left untouched in the legacy store.
 */
export function migrateLegacySingleSession(
  raw: unknown,
  sessionId = generateId(),
): PersistedSession | null {
  if (!isRecord(raw)) return null
  const candidate: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId,
    ownerTabId: 'legacy-v1-migration',
    revision: 1,
    fileName: raw['fileName'] as string,
    savedAt: raw['savedAt'] as number,
    original: raw['original'] as JsonValue,
    current: raw['current'] as JsonValue,
    lastExported: raw['lastExported'] as PersistedLastExported,
    history: raw['history'] as PersistedJsonHistory,
  }
  return isValidPersistedSessionRecord(candidate) ? candidate : null
}

export function deserializeSession(raw: unknown): SessionDeserializeResult {
  if (!isRecord(raw) || typeof raw['schemaVersion'] !== 'number') {
    return {
      ok: false,
      error: { code: 'invalid-record', message: 'The saved session is not a recognizable record.' },
    }
  }

  const schemaVersion = raw['schemaVersion']

  if (schemaVersion === SESSION_SCHEMA_VERSION) {
    if (!isValidPersistedSessionRecord(raw)) {
      return {
        ok: false,
        error: { code: 'invalid-record', message: 'The saved session record is malformed.' },
      }
    }
    return { ok: true, value: toRestoredSession(raw) }
  }

  if (schemaVersion > SESSION_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'unsupported-version',
        message: `The saved session was created by a newer version of the app (schema ${String(schemaVersion)}) and cannot be opened here.`,
        quarantine: toQuarantineInfo(raw, schemaVersion),
      },
    }
  }

  const migrated = migrations[schemaVersion]?.(raw) ?? null
  if (!migrated) {
    return {
      ok: false,
      error: {
        code: 'unsupported-version',
        message: `The saved session was created by an incompatible older version of the app (schema ${String(schemaVersion)}).`,
      },
    }
  }

  return { ok: true, value: toRestoredSession(migrated) }
}

export interface SessionPreviewInput {
  sessionId: string
  fileName: string
  savedAt: number
  current: JsonValue
}

/** Deep-safe UTF-8 size of JSON.stringify(value), for already validated JSON-compatible data. */
function jsonByteSize(value: unknown): number {
  const stack: unknown[] = [value]
  let bytes = 0

  while (stack.length > 0) {
    const current = stack.pop()
    if (current === null) {
      bytes += 4
    } else if (typeof current === 'string') {
      bytes += new TextEncoder().encode(JSON.stringify(current)).length
    } else if (typeof current === 'number') {
      bytes += Object.is(current, -0) ? 1 : String(current).length
    } else if (typeof current === 'boolean') {
      bytes += current ? 4 : 5
    } else if (Array.isArray(current)) {
      bytes += 2 + Math.max(0, current.length - 1)
      for (const item of current) stack.push(item)
    } else if (typeof current === 'object' && current !== null) {
      const entries = Object.entries(current)
      bytes += 2 + Math.max(0, entries.length - 1)
      for (const [key, item] of entries) {
        bytes += new TextEncoder().encode(JSON.stringify(key)).length + 1
        stack.push(item)
      }
    }
  }

  return bytes
}

/** Accepts either a PersistedSession or a RestoredSession — both are supersets of this shape. */
export function getSessionPreview(input: SessionPreviewInput): SessionPreview {
  return {
    sessionId: input.sessionId,
    fileName: input.fileName,
    savedAt: input.savedAt,
    approxSizeBytes: jsonByteSize(input.current),
  }
}

// ---------------------------------------------------------------------------
// Storage budget (AS-09): cap what gets persisted, not the live undo/redo stack
// ---------------------------------------------------------------------------

function approxByteSize(record: PersistedSession): number {
  return jsonByteSize(record)
}

export type BudgetedSessionResult =
  | { ok: true; record: PersistedSession; historyTrimmed: boolean }
  | { ok: false; reason: 'too-large-even-without-history' }

/**
 * Trims persisted history to fit MAX_PERSISTED_HISTORY_ENTRIES and
 * MAX_SESSION_BYTES_APPROX, dropping the entries farthest from `current`
 * first (oldest `past`, then farthest `future`). original/current/
 * lastExported are never trimmed — if the record is still oversized with an
 * empty history, persisting even the minimal state is reported as
 * impossible so the caller can warn the user instead of silently truncating
 * their document.
 */
export function applyStorageBudget(record: PersistedSession): BudgetedSessionResult {
  let past = record.history.past
  let future = record.history.future
  let historyTrimmed = false

  if (past.length > MAX_PERSISTED_HISTORY_ENTRIES) {
    past = past.slice(past.length - MAX_PERSISTED_HISTORY_ENTRIES)
    historyTrimmed = true
  }
  if (future.length > MAX_PERSISTED_HISTORY_ENTRIES) {
    future = future.slice(0, MAX_PERSISTED_HISTORY_ENTRIES)
    historyTrimmed = true
  }

  let candidate: PersistedSession = { ...record, history: { ...record.history, past, future } }

  // Drop future (redo) first, then past (undo), farthest-from-present entries
  // first, until the record fits the byte budget or history is empty.
  while (approxByteSize(candidate) > MAX_SESSION_BYTES_APPROX && (future.length > 0 || past.length > 0)) {
    historyTrimmed = true
    if (future.length > 0) {
      future = future.slice(0, -1)
    } else {
      past = past.slice(1)
    }
    candidate = { ...candidate, history: { ...candidate.history, past, future } }
  }

  if (approxByteSize(candidate) > MAX_SESSION_BYTES_APPROX) {
    return { ok: false, reason: 'too-large-even-without-history' }
  }

  return { ok: true, record: candidate, historyTrimmed }
}

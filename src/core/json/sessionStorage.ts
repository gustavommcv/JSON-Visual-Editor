import type { JsonHistoryState } from './history'
import type { JsonValue } from './types'

export const SESSION_SCHEMA_VERSION = 1

export interface PersistedJsonHistory {
  past: JsonValue[]
  future: JsonValue[]
  limit: number
}

export type PersistedLastExported = { saved: false } | { saved: true; value: JsonValue }

export interface PersistedSession {
  schemaVersion: number
  fileName: string
  savedAt: number
  original: JsonValue
  current: JsonValue
  lastExported: PersistedLastExported
  history: PersistedJsonHistory
}

export interface RestoredSession {
  fileName: string
  savedAt: number
  original: JsonValue
  current: JsonValue
  lastExported: JsonValue | undefined
  history: JsonHistoryState
}

export interface SessionPreview {
  fileName: string
  savedAt: number
  approxSizeBytes: number
}

export type SessionDeserializeErrorCode = 'invalid-record' | 'unsupported-version'

export interface SessionDeserializeError {
  code: SessionDeserializeErrorCode
  message: string
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
}

export function serializeSession(input: SerializeSessionInput): PersistedSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPersistedLastExported(value: unknown): value is PersistedLastExported {
  if (!isRecord(value)) return false
  if (value['saved'] === false) return true
  return value['saved'] === true && 'value' in value
}

function isPersistedHistory(value: unknown): value is PersistedJsonHistory {
  return (
    isRecord(value) &&
    Array.isArray(value['past']) &&
    Array.isArray(value['future']) &&
    typeof value['limit'] === 'number' &&
    Number.isFinite(value['limit'])
  )
}

function isPersistedSessionShape(value: unknown): value is PersistedSession {
  return (
    isRecord(value) &&
    typeof value['schemaVersion'] === 'number' &&
    typeof value['fileName'] === 'string' &&
    typeof value['savedAt'] === 'number' &&
    'original' in value &&
    'current' in value &&
    isPersistedLastExported(value['lastExported']) &&
    isPersistedHistory(value['history'])
  )
}

function toRestoredSession(record: PersistedSession): RestoredSession {
  return {
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

/**
 * Upgrades a record from an older schema version to the current one. There
 * is only one schema version so far, so there is nothing to migrate from
 * yet — this is the extension point for future version bumps, keyed by the
 * version being migrated *from*.
 */
const migrations: Record<number, (raw: Record<string, unknown>) => PersistedSession | null> = {}

export function deserializeSession(raw: unknown): SessionDeserializeResult {
  if (!isRecord(raw) || typeof raw['schemaVersion'] !== 'number') {
    return {
      ok: false,
      error: { code: 'invalid-record', message: 'The saved session is not a recognizable record.' },
    }
  }

  const schemaVersion = raw['schemaVersion']

  if (schemaVersion === SESSION_SCHEMA_VERSION) {
    if (!isPersistedSessionShape(raw)) {
      return {
        ok: false,
        error: { code: 'invalid-record', message: 'The saved session record is malformed.' },
      }
    }
    return { ok: true, value: toRestoredSession(raw) }
  }

  const record = migrations[schemaVersion]?.(raw) ?? null
  if (!record) {
    return {
      ok: false,
      error: {
        code: 'unsupported-version',
        message: `The saved session was created by an incompatible version of the app (schema ${String(schemaVersion)}).`,
      },
    }
  }

  return { ok: true, value: toRestoredSession(record) }
}

export interface SessionPreviewInput {
  fileName: string
  savedAt: number
  current: JsonValue
}

/** Accepts either a PersistedSession or a RestoredSession — both are supersets of this shape. */
export function getSessionPreview(input: SessionPreviewInput): SessionPreview {
  return {
    fileName: input.fileName,
    savedAt: input.savedAt,
    approxSizeBytes: new TextEncoder().encode(JSON.stringify(input.current)).length,
  }
}

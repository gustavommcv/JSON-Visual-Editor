import { describe, expect, it } from 'vitest'

import { createJsonHistory, commitJsonHistory } from './history'
import {
  SESSION_SCHEMA_VERSION,
  deserializeSession,
  getSessionPreview,
  serializeSession,
  type PersistedSession,
} from './sessionStorage'
import type { JsonValue } from './types'

function buildHistory() {
  let history = createJsonHistory({ name: 'before' })
  history = commitJsonHistory(history, { name: 'after' }, { timestamp: 1_000 })
  return history
}

describe('serializeSession', () => {
  it('captures the schema version, document, and history fields', () => {
    const history = buildHistory()
    const record = serializeSession({
      fileName: 'data.json',
      original: { name: 'before' },
      current: history.present,
      lastExported: { name: 'before' },
      history,
      savedAt: 42,
    })

    expect(record).toEqual<PersistedSession>({
      schemaVersion: SESSION_SCHEMA_VERSION,
      fileName: 'data.json',
      savedAt: 42,
      original: { name: 'before' },
      current: { name: 'after' },
      lastExported: { saved: true, value: { name: 'before' } },
      history: { past: history.past, future: history.future, limit: history.limit },
    })
  })

  it('marks lastExported as unsaved when undefined', () => {
    const history = createJsonHistory('value')
    const record = serializeSession({
      fileName: 'data.json',
      original: 'value',
      current: 'value',
      lastExported: undefined,
      history,
    })

    expect(record.lastExported).toEqual({ saved: false })
  })

  it('defaults savedAt to the current time when omitted', () => {
    const before = Date.now()
    const record = serializeSession({
      fileName: 'data.json',
      original: null,
      current: null,
      lastExported: undefined,
      history: createJsonHistory(null),
    })
    const after = Date.now()

    expect(record.savedAt).toBeGreaterThanOrEqual(before)
    expect(record.savedAt).toBeLessThanOrEqual(after)
  })

  it('does not persist the ephemeral typing-group marker', () => {
    const history = buildHistory()
    const record = serializeSession({
      fileName: 'data.json',
      original: { name: 'before' },
      current: history.present,
      lastExported: undefined,
      history,
    })

    expect(record.history).not.toHaveProperty('grouping')
    expect(record.history).not.toHaveProperty('present')
  })
})

describe('deserializeSession (restore)', () => {
  it('round-trips a serialized session back into a restorable shape', () => {
    const history = buildHistory()
    const record = serializeSession({
      fileName: 'data.json',
      original: { name: 'before' },
      current: history.present,
      lastExported: { name: 'before' },
      history,
      savedAt: 99,
    })

    const result = deserializeSession(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value).toEqual({
      fileName: 'data.json',
      savedAt: 99,
      original: { name: 'before' },
      current: { name: 'after' },
      lastExported: { name: 'before' },
      history: {
        past: history.past,
        present: { name: 'after' },
        future: history.future,
        limit: history.limit,
        grouping: null,
      },
    })
  })

  it('restores lastExported as undefined when it was never saved', () => {
    const record = serializeSession({
      fileName: 'data.json',
      original: 'a',
      current: 'b',
      lastExported: undefined,
      history: createJsonHistory('b'),
    })

    const result = deserializeSession(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.lastExported).toBeUndefined()
  })

  it('resets the typing-group marker on restore', () => {
    const record = serializeSession({
      fileName: 'data.json',
      original: 'a',
      current: 'b',
      lastExported: undefined,
      history: createJsonHistory('b'),
    })

    const result = deserializeSession(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.history.grouping).toBeNull()
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['a string', 'not a record'],
    ['an array', ['not', 'a', 'record']],
    ['missing schemaVersion', { fileName: 'x.json' }],
  ])('rejects %s as an invalid record', (_label, raw) => {
    const result = deserializeSession(raw)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid-record')
  })

  it('rejects a current-version record that is missing required fields', () => {
    const result = deserializeSession({
      schemaVersion: SESSION_SCHEMA_VERSION,
      fileName: 'x.json',
      // savedAt, original, current, lastExported, history all missing
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid-record')
  })

  it('rejects a record from an unrecognized future schema version', () => {
    const result = deserializeSession({
      schemaVersion: SESSION_SCHEMA_VERSION + 1,
      fileName: 'x.json',
      savedAt: 1,
      original: {},
      current: {},
      lastExported: { saved: false },
      history: { past: [], future: [], limit: 50 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unsupported-version')
  })

  it('rejects a record from an unrecognized older schema version', () => {
    const result = deserializeSession({
      schemaVersion: 0,
      fileName: 'x.json',
      savedAt: 1,
      original: {},
      current: {},
      lastExported: { saved: false },
      history: { past: [], future: [], limit: 50 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unsupported-version')
  })
})

describe('getSessionPreview (cleanup / display metadata)', () => {
  function record(current: JsonValue): PersistedSession {
    return serializeSession({
      fileName: 'big.json',
      original: current,
      current,
      lastExported: undefined,
      history: createJsonHistory(current),
      savedAt: 1_700_000_000_000,
    })
  }

  it('reports the filename and savedAt unchanged', () => {
    const preview = getSessionPreview(record({ a: 1 }))
    expect(preview.fileName).toBe('big.json')
    expect(preview.savedAt).toBe(1_700_000_000_000)
  })

  it('computes the UTF-8 byte size of the current document', () => {
    const preview = getSessionPreview(record('abc'))
    // JSON.stringify('abc') === '"abc"' -> 5 ASCII bytes
    expect(preview.approxSizeBytes).toBe(5)
  })

  it('counts multi-byte characters correctly', () => {
    const preview = getSessionPreview(record('日本語'))
    // '"日本語"' -> 2 quote bytes + 3 chars * 3 bytes (UTF-8 for these CJK code points)
    expect(preview.approxSizeBytes).toBe(11)
  })

  it('grows with document size', () => {
    const small = getSessionPreview(record({ a: 1 }))
    const large = getSessionPreview(record({ items: Array.from({ length: 1000 }, (_, i) => i) }))
    expect(large.approxSizeBytes).toBeGreaterThan(small.approxSizeBytes)
  })
})

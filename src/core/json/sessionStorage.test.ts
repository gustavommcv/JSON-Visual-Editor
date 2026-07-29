import { describe, expect, it } from 'vitest'

import { createJsonHistory, commitJsonHistory } from './history'
import {
  MAX_PERSISTED_HISTORY_ENTRIES,
  MAX_SESSION_BYTES_APPROX,
  SESSION_SCHEMA_VERSION,
  applyStorageBudget,
  deserializeSession,
  getSessionPreview,
  isPersistedSessionTombstone,
  isValidJsonValue,
  migrateLegacySingleSession,
  serializeRecoverySession,
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
  it('captures the schema version, identity, document, and history fields', () => {
    const history = buildHistory()
    const record = serializeSession({
      fileName: 'data.json',
      original: { name: 'before' },
      current: history.present,
      lastExported: { name: 'before' },
      history,
      savedAt: 42,
      sessionId: 'session-1',
      ownerTabId: 'tab-1',
      revision: 3,
    })

    expect(record).toEqual<PersistedSession>({
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: 'session-1',
      ownerTabId: 'tab-1',
      revision: 3,
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

  it('creates a compact recovery record without duplicating undo or redo snapshots', () => {
    const history = buildHistory()
    history.future = [{ name: 'future' }]

    const record = serializeRecoverySession({
      fileName: 'large.json',
      original: { name: 'before' },
      current: history.present,
      lastExported: undefined,
      history,
    })

    expect(record.current).toEqual(history.present)
    expect(record.history).toEqual({ past: [], future: [], limit: history.limit })
    expect(history.past).toHaveLength(1)
    expect(history.future).toHaveLength(1)
  })

  it('defaults sessionId, ownerTabId, and revision when the caller does not care about identity', () => {
    const record = serializeSession({
      fileName: 'data.json',
      original: 'a',
      current: 'a',
      lastExported: undefined,
      history: createJsonHistory('a'),
    })

    expect(typeof record.sessionId).toBe('string')
    expect(record.sessionId.length).toBeGreaterThan(0)
    expect(typeof record.ownerTabId).toBe('string')
    expect(record.revision).toBe(1)
  })

  it('generates a different sessionId for each call when none is supplied', () => {
    const first = serializeSession({
      fileName: 'a.json',
      original: 'a',
      current: 'a',
      lastExported: undefined,
      history: createJsonHistory('a'),
    })
    const second = serializeSession({
      fileName: 'b.json',
      original: 'b',
      current: 'b',
      lastExported: undefined,
      history: createJsonHistory('b'),
    })

    expect(first.sessionId).not.toBe(second.sessionId)
  })
})

describe('isValidJsonValue', () => {
  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a Date', new Date(0)],
    ['a function', () => undefined],
    ['a symbol', Symbol('x')],
    ['an unsafe integer', 2 ** 53 + 2],
    ['a Map', new Map()],
    ['a Set', new Set()],
  ])('rejects %s at the root', (_label, value) => {
    expect(isValidJsonValue(value)).toBe(false)
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['a string', 'value'],
    ['a finite number', 42],
    ['a safe integer boundary', Number.MAX_SAFE_INTEGER],
    ['true', true],
    ['false', false],
    ['an empty object', {}],
    ['an empty array', []],
  ])('accepts %s at the root', (_label, value) => {
    expect(isValidJsonValue(value)).toBe(true)
  })

  it('rejects an invalid value nested inside an array inside an object', () => {
    expect(isValidJsonValue({ items: [1, 2, { bad: Number.NaN }] })).toBe(false)
  })

  it('rejects an invalid value several levels deep', () => {
    expect(isValidJsonValue({ a: { b: { c: [{ d: undefined }] } } })).toBe(false)
  })

  it('rejects a class instance nested in an otherwise valid object', () => {
    class Point {
      x = 1
      y = 2
    }
    expect(isValidJsonValue({ position: new Point() })).toBe(false)
  })

  it('accepts a plain object created with a null prototype', () => {
    const value = Object.create(null) as Record<string, unknown>
    value['ok'] = true
    expect(isValidJsonValue(value)).toBe(true)
  })

  it('rejects a self-referencing (cyclic) object without hanging or overflowing the stack', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' }
    cyclic['self'] = cyclic
    expect(isValidJsonValue(cyclic)).toBe(false)
  })

  it('accepts a pathologically deep but valid array without overflowing the call stack', () => {
    let deep: JsonValue = []
    for (let i = 0; i < 10_000; i += 1) deep = [deep]
    expect(isValidJsonValue(deep)).toBe(true)
  })

  it('accepts a wide valid JSON value beyond the former arbitrary node ceiling', () => {
    const wide: JsonValue = Array.from({ length: 500_001 }, () => null)
    expect(isValidJsonValue(wide)).toBe(true)
  })

  it('accepts a moderately large, moderately nested document', () => {
    const value = {
      items: Array.from({ length: 2_000 }, (_, i) => ({ id: i, tags: ['a', 'b'], active: i % 2 === 0 })),
    }
    expect(isValidJsonValue(value)).toBe(true)
  })
})

describe('legacy migration and tombstones', () => {
  it('migrates a valid DB v1 record while adding identity and revision metadata', () => {
    const current = serializeSession({
      fileName: 'legacy.json',
      original: { value: 0 },
      current: { value: 1 },
      lastExported: undefined,
      history: buildHistory(),
      savedAt: 123,
    })
    const legacy = {
      schemaVersion: current.schemaVersion,
      fileName: current.fileName,
      savedAt: current.savedAt,
      original: current.original,
      current: current.current,
      lastExported: current.lastExported,
      history: current.history,
    }

    expect(migrateLegacySingleSession(legacy, 'migrated-session')).toEqual({
      ...legacy,
      sessionId: 'migrated-session',
      ownerTabId: 'legacy-v1-migration',
      revision: 1,
    })
  })

  it('refuses to migrate malformed DB v1 data', () => {
    expect(migrateLegacySingleSession({ schemaVersion: 1, fileName: 'broken.json' })).toBeNull()
  })

  it('recognizes only complete revisioned tombstones', () => {
    expect(
      isPersistedSessionTombstone({
        recordType: 'tombstone',
        sessionId: 'session-1',
        ownerTabId: 'tab-1',
        revision: 3,
        deletedAt: 123,
      }),
    ).toBe(true)
    expect(isPersistedSessionTombstone({ recordType: 'tombstone', sessionId: 'session-1' })).toBe(false)
  })
})

describe('deserializeSession (restore)', () => {
  const rootCases: [string, JsonValue][] = [
    ['an object', { nested: { value: 'ok' } }],
    ['an array', [1, 'two', true, null]],
    ['a string', 'value'],
    ['a number', 42],
    ['true', true],
    ['false', false],
    ['null', null],
    ['an empty string', ''],
    ['zero', 0],
    ['an empty object', {}],
    ['an empty array', []],
  ]

  it.each(rootCases)('round-trips %s without changing its JSON type or value', (_label, root) => {
    const record = serializeSession({
      fileName: 'root.json',
      original: root,
      current: root,
      lastExported: root,
      history: createJsonHistory(root),
      savedAt: 10,
    })

    const result = deserializeSession(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.original).toEqual(root)
    expect(result.value.current).toEqual(root)
    expect(result.value.lastExported).toEqual(root)
    expect(result.value.history.present).toEqual(root)
  })

  it('preserves Unicode and special property names literally', () => {
    const value = JSON.parse(
      '{"a.b":"slash/value","espaço":"olá 👋","__proto__":{"safe":true},"prototype":0,"constructor":false}',
    ) as JsonValue
    const record = serializeSession({
      fileName: 'literal.json',
      original: value,
      current: value,
      lastExported: value,
      history: createJsonHistory(value),
    })

    const result = deserializeSession(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.current).toEqual(value)
    expect(Object.prototype.hasOwnProperty.call(result.value.current, '__proto__')).toBe(true)
  })

  it('round-trips a serialized session back into a restorable shape', () => {
    const history = buildHistory()
    const record = serializeSession({
      fileName: 'data.json',
      original: { name: 'before' },
      current: history.present,
      lastExported: { name: 'before' },
      history,
      savedAt: 99,
      sessionId: 'session-42',
      revision: 7,
    })

    const result = deserializeSession(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value).toEqual({
      sessionId: 'session-42',
      revision: 7,
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
      // savedAt, original, current, lastExported, history, sessionId, ownerTabId, revision all missing
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid-record')
  })

  function validRawRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: 'session-1',
      ownerTabId: 'tab-1',
      revision: 1,
      fileName: 'x.json',
      savedAt: 1,
      original: {},
      current: {},
      lastExported: { saved: false },
      history: { past: [], future: [], limit: 50 },
      ...overrides,
    }
  }

  it('accepts a fully valid current-version record built field by field', () => {
    const result = deserializeSession(validRawRecord())
    expect(result.ok).toBe(true)
  })

  it.each<[string, Record<string, unknown>]>([
    ['an empty sessionId', { sessionId: '' }],
    ['a missing sessionId', { sessionId: undefined }],
    ['a non-string ownerTabId', { ownerTabId: 42 }],
    ['a negative revision', { revision: -1 }],
    ['a fractional revision', { revision: 1.5 }],
    ['an empty fileName', { fileName: '' }],
    ['a fileName over the length limit', { fileName: 'x'.repeat(600) }],
  ])('rejects a record with %s', (_label, overrides) => {
    const result = deserializeSession(validRawRecord(overrides))
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

  it('reports quarantine info for a future schema version instead of silently dropping it', () => {
    const result = deserializeSession({
      schemaVersion: SESSION_SCHEMA_VERSION + 1,
      sessionId: 'future-session',
      fileName: 'from-the-future.json',
      savedAt: 2_000,
      original: {},
      current: {},
      lastExported: { saved: false },
      history: { past: [], future: [], limit: 50 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.quarantine).toEqual({
      sessionId: 'future-session',
      fileName: 'from-the-future.json',
      savedAt: 2_000,
      schemaVersion: SESSION_SCHEMA_VERSION + 1,
    })
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

  it('rejects non-JSON values in the document and history snapshots', () => {
    const result = deserializeSession({
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: 'session-1',
      ownerTabId: 'tab-1',
      revision: 1,
      fileName: 'invalid.json',
      savedAt: 1,
      original: {},
      current: undefined,
      lastExported: { saved: true, value: Number.NaN },
      history: { past: [undefined], future: [new Date(0)], limit: 50 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid-record')
  })

  it('rejects a record whose current value is valid but whose history snapshot is not', () => {
    const result = deserializeSession(
      validRawRecord({ history: { past: [{ ok: true }, { bad: Number.NaN }], future: [], limit: 50 } }),
    )
    expect(result.ok).toBe(false)
  })

  it('rejects non-finite timestamps and invalid history limits', () => {
    const result = deserializeSession({
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: 'session-1',
      ownerTabId: 'tab-1',
      revision: 1,
      fileName: 'invalid-metadata.json',
      savedAt: Number.POSITIVE_INFINITY,
      original: {},
      current: {},
      lastExported: { saved: false },
      history: { past: [], future: [], limit: -1.5 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid-record')
  })

  it('rejects a NaN savedAt', () => {
    const result = deserializeSession(validRawRecord({ savedAt: Number.NaN }))
    expect(result.ok).toBe(false)
  })

  it.each<[string, number]>([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 2.5],
    ['above the maximum', 100_000],
  ])('rejects a history.limit that is %s', (_label, limit) => {
    const result = deserializeSession(validRawRecord({ history: { past: [], future: [], limit } }))
    expect(result.ok).toBe(false)
  })

  it('rejects a past array longer than its own declared limit', () => {
    const result = deserializeSession(
      validRawRecord({
        history: { past: [1, 2, 3, 4, 5], future: [], limit: 3 },
      }),
    )
    expect(result.ok).toBe(false)
  })

  it('rejects a future array longer than its own declared limit', () => {
    const result = deserializeSession(
      validRawRecord({
        history: { past: [], future: [1, 2, 3, 4, 5], limit: 3 },
      }),
    )
    expect(result.ok).toBe(false)
  })

  it('accepts history at exactly its declared limit', () => {
    const result = deserializeSession(
      validRawRecord({
        history: { past: [1, 2, 3], future: [4, 5, 6], limit: 3 },
      }),
    )
    expect(result.ok).toBe(true)
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
      sessionId: 'session-preview',
    })
  }

  it('reports the sessionId, filename, and savedAt unchanged', () => {
    const preview = getSessionPreview(record({ a: 1 }))
    expect(preview.sessionId).toBe('session-preview')
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

describe('applyStorageBudget (AS-09)', () => {
  function recordWithHistoryLength(entries: number): PersistedSession {
    let history = createJsonHistory({ n: 0 })
    for (let i = 1; i <= entries; i += 1) {
      history = commitJsonHistory(history, { n: i }, { timestamp: i })
    }
    return serializeSession({
      fileName: 'history.json',
      original: { n: 0 },
      current: history.present,
      lastExported: undefined,
      history,
    })
  }

  it('leaves a small record untouched', () => {
    const record = recordWithHistoryLength(3)
    const result = applyStorageBudget(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.historyTrimmed).toBe(false)
    expect(result.record.history.past).toEqual(record.history.past)
  })

  it('measures and preserves a deeply nested valid document without recursive stringify overflow', () => {
    let deep: JsonValue = null
    for (let index = 0; index < 10_000; index += 1) deep = [deep]
    const record = serializeSession({
      fileName: 'deep.json',
      original: deep,
      current: deep,
      lastExported: undefined,
      history: { past: [], present: deep, future: [], limit: 50, grouping: null },
    })

    const result = applyStorageBudget(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.original).toBe(deep)
    expect(result.record.current).toBe(deep)
    expect(getSessionPreview(result.record).approxSizeBytes).toBeGreaterThan(20_000)
  })

  it('caps persisted past entries to MAX_PERSISTED_HISTORY_ENTRIES, keeping the most recent ones', () => {
    const record = recordWithHistoryLength(MAX_PERSISTED_HISTORY_ENTRIES + 10)
    const result = applyStorageBudget(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.historyTrimmed).toBe(true)
    expect(result.record.history.past).toHaveLength(MAX_PERSISTED_HISTORY_ENTRIES)
    // the entries closest to `present` are the ones kept
    expect(result.record.history.past.at(-1)).toEqual(record.history.past.at(-1))
  })

  it('never trims original, current, or lastExported', () => {
    const record = recordWithHistoryLength(MAX_PERSISTED_HISTORY_ENTRIES + 10)
    const result = applyStorageBudget(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.original).toEqual(record.original)
    expect(result.record.current).toEqual(record.current)
    expect(result.record.lastExported).toEqual(record.lastExported)
  })

  it('drops history entries beyond the approximate byte budget for a moderately large document', () => {
    const bigValue = { blob: 'x'.repeat(200_000) }
    let history = createJsonHistory(bigValue)
    for (let i = 1; i <= 30; i += 1) {
      history = commitJsonHistory(history, { blob: 'x'.repeat(200_000), n: i }, { timestamp: i })
    }
    const record = serializeSession({
      fileName: 'big-history.json',
      original: bigValue,
      current: history.present,
      lastExported: undefined,
      history,
    })

    const result = applyStorageBudget(record)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.historyTrimmed).toBe(true)
    expect(result.record.history.past.length).toBeLessThan(record.history.past.length)

    const finalSize = new TextEncoder().encode(JSON.stringify(result.record)).length
    expect(finalSize).toBeLessThanOrEqual(MAX_SESSION_BYTES_APPROX)
  })

  it('reports failure when even original and current alone exceed the byte budget', () => {
    const hugeValue = { blob: 'x'.repeat(MAX_SESSION_BYTES_APPROX + 1_000) }
    const record = serializeSession({
      fileName: 'too-big.json',
      original: hugeValue,
      current: hugeValue,
      lastExported: undefined,
      history: createJsonHistory(hugeValue),
    })

    const result = applyStorageBudget(record)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too-large-even-without-history')
  })
})

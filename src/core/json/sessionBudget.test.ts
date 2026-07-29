import { describe, expect, it } from 'vitest'

import { createJsonHistory } from './history'
import { measurePersistedSessionByteSize } from './sessionBudget'
import {
  getPersistedSessionByteSize,
  serializeRecoverySession,
  type PersistedSession,
} from './sessionStorage'
import type { JsonObject, JsonValue } from './types'

describe('worker-side session budgeting', () => {
  it('matches the exact UTF-8 size of native JSON serialization', () => {
    const record = serializeRecoverySession({
      fileName: 'portfolio.json',
      original: { title: 'Maquete' },
      current: { title: 'Maquete atualizada', active: true },
      lastExported: undefined,
      history: createJsonHistory({ title: 'Maquete atualizada', active: true }),
      sessionId: 'session-1',
      ownerTabId: 'tab-1',
      revision: 2,
      savedAt: 1_000,
    })

    expect(measurePersistedSessionByteSize(record)).toBe(
      new TextEncoder().encode(JSON.stringify(record)).byteLength,
    )
  })

  it('falls back to iterative measurement for JSON deeper than JSON.stringify can handle', () => {
    let current: JsonValue = null
    for (let depth = 0; depth < 20_000; depth += 1) current = { child: current }

    const record: PersistedSession = {
      schemaVersion: 1,
      sessionId: 'deep-session',
      ownerTabId: 'tab-1',
      revision: 1,
      fileName: 'deep.json',
      savedAt: 1_000,
      original: current,
      current,
      lastExported: { saved: false },
      history: { past: [], future: [], limit: 50 },
    }

    expect(() => JSON.stringify(record)).toThrow()
    expect(measurePersistedSessionByteSize(record)).toBe(getPersistedSessionByteSize(record))
    expect((record.current as JsonObject)['child']).toBeDefined()
  })
})

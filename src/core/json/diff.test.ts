import { describe, expect, it } from 'vitest'

import { areJsonSnapshotsEqual, areJsonValuesEqual, compareJsonValues } from './diff'
import type { JsonValue } from './types'

describe('structural JSON comparison', () => {
  it('compares values and types at the affected path', () => {
    expect(compareJsonValues({ value: 1 }, { value: '1' })).toEqual([
      { kind: 'changed', path: ['value'], before: 1, after: '1' },
    ])
  })

  it('reports additions and removals without reducing the document to raw text', () => {
    const changes = compareJsonValues(
      { removed: { id: 1 }, kept: true },
      { added: ['new'], kept: true },
    )

    expect(changes).toEqual([
      { kind: 'removed', path: ['removed'], before: { id: 1 } },
      { kind: 'added', path: ['added'], after: ['new'] },
    ])
  })

  it('detects a pure array reorder as a distinct change', () => {
    const before: JsonValue = { items: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    const after: JsonValue = { items: [{ id: 3 }, { id: 1 }, { id: 2 }] }

    expect(compareJsonValues(before, after)).toEqual([
      {
        kind: 'reordered',
        path: ['items'],
        before: [{ id: 1 }, { id: 2 }, { id: 3 }],
        after: [{ id: 3 }, { id: 1 }, { id: 2 }],
      },
    ])
  })

  it('does not treat object property order as a semantic change', () => {
    const before: JsonValue = { first: 1, second: { a: true, b: false } }
    const after: JsonValue = { second: { b: false, a: true }, first: 1 }

    expect(areJsonValuesEqual(before, after)).toBe(true)
    expect(areJsonSnapshotsEqual(before, after)).toBe(false)
    expect(compareJsonValues(before, after)).toEqual([])
  })

  it('keeps segmented paths for properties with special characters', () => {
    expect(compareJsonValues(
      { 'config. version': { 'main/route': false } },
      { 'config. version': { 'main/route': true } },
    )).toEqual([
      {
        kind: 'changed',
        path: ['config. version', 'main/route'],
        before: false,
        after: true,
      },
    ])
  })
})

import { describe, expect, it } from 'vitest'

import {
  commitJsonHistory,
  createJsonHistory,
  redoJsonHistory,
  undoJsonHistory,
} from './history'
import { applyJsonOperation, type JsonEditorOperation } from './operations'
import type { JsonValue } from './types'

interface OperationCase {
  label: string
  initial: JsonValue
  operation: JsonEditorOperation
  expected: JsonValue
}

const operationCases: OperationCase[] = [
  {
    label: 'editing',
    initial: { name: 'before' },
    operation: { kind: 'set-value', path: ['name'], value: 'after' },
    expected: { name: 'after' },
  },
  {
    label: 'type change',
    initial: { value: null },
    operation: { kind: 'change-type', path: ['value'], valueType: 'array' },
    expected: { value: [] },
  },
  {
    label: 'property creation',
    initial: {},
    operation: { kind: 'add-property', objectPath: [], key: 'active', valueType: 'boolean' },
    expected: { active: false },
  },
  {
    label: 'item creation',
    initial: [],
    operation: { kind: 'append-item', arrayPath: [], valueType: 'number' },
    expected: [0],
  },
  {
    label: 'item duplication',
    initial: [{ nested: ['a'] }],
    operation: { kind: 'duplicate-array-item', arrayPath: [], index: 0 },
    expected: [{ nested: ['a'] }, { nested: ['a'] }],
  },
  {
    label: 'property duplication',
    initial: { profile: { active: true } },
    operation: { kind: 'duplicate-property', objectPath: [], key: 'profile' },
    expected: { profile: { active: true }, 'profile (copy)': { active: true } },
  },
  {
    label: 'deletion',
    initial: { a: 1, b: 2 },
    operation: { kind: 'remove-value', path: ['a'] },
    expected: { b: 2 },
  },
  {
    label: 'renaming',
    initial: { name: 'Ada' },
    operation: { kind: 'rename-property', objectPath: [], previousKey: 'name', nextKey: 'person' },
    expected: { person: 'Ada' },
  },
  {
    label: 'array reordering',
    initial: ['a', 'b', 'c'],
    operation: { kind: 'move-array-item', arrayPath: [], fromIndex: 2, toIndex: 0 },
    expected: ['c', 'a', 'b'],
  },
  {
    label: 'object reordering',
    initial: { a: 1, b: 2 },
    operation: { kind: 'move-property', objectPath: [], key: 'b', toIndex: 0 },
    expected: { b: 2, a: 1 },
  },
  {
    label: 'root replacement',
    initial: { before: true },
    operation: { kind: 'replace-root', value: ['now'] },
    expected: ['now'],
  },
]

describe('JSON snapshot history', () => {
  it.each(operationCases)('undoes and redoes $label', ({ initial, operation, expected }) => {
    const operationResult = applyJsonOperation(initial, operation)
    expect(operationResult.ok).toBe(true)
    if (!operationResult.ok) return

    const committed = commitJsonHistory(createJsonHistory(initial), operationResult.value)
    expect(committed.present).toEqual(expected)

    const undone = undoJsonHistory(committed)
    expect(undone.present).toEqual(initial)
    expect(undone.future).toHaveLength(1)

    const redone = redoJsonHistory(undone)
    expect(redone.present).toEqual(expected)
  })

  it('discards the redo stack after a new edit', () => {
    const first = commitJsonHistory(createJsonHistory(0), 1)
    const second = commitJsonHistory(first, 2)
    const undone = undoJsonHistory(second)
    const branched = commitJsonHistory(undone, 10)

    expect(branched.present).toBe(10)
    expect(branched.future).toEqual([])
    expect(redoJsonHistory(branched)).toBe(branched)
  })

  it('limits stack usage and keeps the most recent snapshots', () => {
    let history = createJsonHistory(0, 3)
    for (let value = 1; value <= 5; value += 1) {
      history = commitJsonHistory(history, value)
    }

    expect(history.past).toEqual([2, 3, 4])
    history = undoJsonHistory(history)
    history = undoJsonHistory(history)
    history = undoJsonHistory(history)
    expect(history.present).toBe(2)
    expect(undoJsonHistory(history)).toBe(history)
  })

  it('groups continuous typing in the same field into one step', () => {
    let history = createJsonHistory({ text: '' })
    history = commitJsonHistory(history, { text: 'a' }, { groupKey: 'text:["text"]', timestamp: 0 })
    history = commitJsonHistory(history, { text: 'ab' }, { groupKey: 'text:["text"]', timestamp: 200 })
    history = commitJsonHistory(history, { text: 'abc' }, { groupKey: 'text:["text"]', timestamp: 500 })

    expect(history.past).toHaveLength(1)
    expect(undoJsonHistory(history).present).toEqual({ text: '' })

    const expired = commitJsonHistory(history, { text: 'abcd' }, {
      groupKey: 'text:["text"]',
      timestamp: 2_000,
    })
    expect(expired.past).toHaveLength(2)
  })

  it('restores the original from a full snapshot and allows undoing the restoration', () => {
    const original: JsonValue = { data: [{ name: 'A' }], active: true }
    const edited: JsonValue = { data: [{ name: 'B' }, { name: 'C' }], active: false }
    const history = commitJsonHistory(createJsonHistory(original), edited)
    const restored = commitJsonHistory(history, original)

    expect(restored.present).toEqual(original)
    expect(undoJsonHistory(restored).present).toEqual(edited)
  })
})

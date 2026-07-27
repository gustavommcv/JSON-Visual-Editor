import { describe, expect, it } from 'vitest'

import { serializeJson } from './exporter'
import {
  addJsonProperty,
  appendJsonArrayItem,
  applyJsonOperation,
  cloneJsonValue,
  changeJsonValueType,
  duplicateJsonArrayItem,
  duplicateJsonProperty,
  getJsonValueAtPath,
  removeJsonValue,
  renameJsonProperty,
  replaceJsonRoot,
  moveJsonArrayItem,
  moveJsonProperty,
  setJsonValue,
} from './operations'
import type { JsonValue } from './types'

function expectValue(result: ReturnType<typeof setJsonValue>): JsonValue {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('path-based JSON operations', () => {
  it('accesses and changes nested objects without modifying the source', () => {
    const source: JsonValue = { project: { name: 'Old', active: true } }
    const result = setJsonValue(source, ['project', 'name'], 'New')

    expect(expectValue(result)).toEqual({ project: { name: 'New', active: true } })
    expect(source).toEqual({ project: { name: 'Old', active: true } })
    expect(getJsonValueAtPath(expectValue(result), ['project', 'name'])).toEqual({
      ok: true,
      value: 'New',
    })
  })

  it('changes nested arrays by index', () => {
    const source: JsonValue = { groups: [[1, 2], [3]] }
    const result = setJsonValue(source, ['groups', 0, 1], 20)

    expect(expectValue(result)).toEqual({ groups: [[1, 20], [3]] })
  })

  it('edits and replaces the root', () => {
    expect(expectValue(setJsonValue({ before: true }, [], 'text now'))).toBe('text now')
    expect(expectValue(replaceJsonRoot('before', [1, false, null]))).toEqual([1, false, null])
  })

  it('changes type using the correct default value', () => {
    const source: JsonValue = { value: null }

    expect(expectValue(changeJsonValueType(source, ['value'], 'array'))).toEqual({ value: [] })
    expect(expectValue(changeJsonValueType(source, ['value'], 'number'))).toEqual({ value: 0 })
  })

  it('adds content to empty objects and arrays', () => {
    const withProperty = expectValue(addJsonProperty({}, [], 'new field', 'boolean'))
    expect(withProperty).toEqual({ 'new field': false })

    const withItem = expectValue(appendJsonArrayItem([], [], 'object'))
    expect(withItem).toEqual([{}])
  })

  it('renames properties while preserving position and value', () => {
    const source: JsonValue = { first: 1, name: { active: true }, last: 3 }
    const result = renameJsonProperty(source, [], 'name', 'data')
    const renamed = expectValue(result)

    expect(renamed).toEqual({ first: 1, data: { active: true }, last: 3 })
    expect(renamed).not.toBeNull()
    expect(Array.isArray(renamed)).toBe(false)
    expect(typeof renamed).toBe('object')
    if (renamed === null || Array.isArray(renamed) || typeof renamed !== 'object') return
    expect(Object.keys(renamed)).toEqual(['first', 'data', 'last'])
  })

  it('prevents collisions when renaming or adding a key', () => {
    const source: JsonValue = { name: 'Ada', active: true }

    expect(renameJsonProperty(source, [], 'name', 'active')).toMatchObject({
      ok: false,
      error: { code: 'duplicate-key' },
    })
    expect(addJsonProperty(source, [], 'name', 'null')).toMatchObject({
      ok: false,
      error: { code: 'duplicate-key' },
    })
    expect(source).toEqual({ name: 'Ada', active: true })
  })

  it('treats dots, spaces, slashes, accents, and symbols as literal segments', () => {
    // This multilingual fixture verifies that user-provided keys are never translated.
    const source: JsonValue = {
      'config.versão': {
        'nome completo': {
          'rota/principal': { 'ação#1': 'before' },
        },
      },
    }
    const path = ['config.versão', 'nome completo', 'rota/principal', 'ação#1']
    const result = setJsonValue(source, path, 'after')

    expect(getJsonValueAtPath(expectValue(result), path)).toEqual({ ok: true, value: 'after' })
  })

  it('fails explicitly when accessing a missing path', () => {
    expect(getJsonValueAtPath({ items: [] }, ['items', 0])).toMatchObject({
      ok: false,
      error: { code: 'invalid-path' },
    })
    expect(setJsonValue({ data: {} }, ['data', 'missing'], true)).toMatchObject({
      ok: false,
      error: { code: 'invalid-path' },
    })
  })

  it('removes items and properties only through the central operation layer', () => {
    expect(expectValue(removeJsonValue({ items: [1, 2, 3] }, ['items', 1]))).toEqual({
      items: [1, 3],
    })
    expect(expectValue(removeJsonValue({ a: 1, b: 2 }, ['a']))).toEqual({ b: 2 })
  })

  it('deeply duplicates an item and inserts it after the source', () => {
    const nested: JsonValue = [{ data: { tags: ['a'], active: true } }, { data: null }]
    const duplicated = expectValue(duplicateJsonArrayItem(nested, [], 0))

    expect(duplicated).toEqual([
      { data: { tags: ['a'], active: true } },
      { data: { tags: ['a'], active: true } },
      { data: null },
    ])
    if (!Array.isArray(duplicated)) return
    expect(duplicated[1]).not.toBe(duplicated[0])
    expect(cloneJsonValue(duplicated[0] as JsonValue)).toEqual(duplicated[0])

    const editedDuplicate = expectValue(setJsonValue(duplicated, [1, 'data', 'tags', 0], 'b'))
    expect(editedDuplicate).toEqual([
      { data: { tags: ['a'], active: true } },
      { data: { tags: ['b'], active: true } },
      { data: null },
    ])
  })

  it('deeply duplicates properties with unique names', () => {
    const source: JsonValue = {
      profile: { preferences: ['compact'] },
      'profile (copy)': null,
    }
    const result = expectValue(duplicateJsonProperty(source, [], 'profile'))

    expect(result).toEqual({
      profile: { preferences: ['compact'] },
      'profile (copy) 2': { preferences: ['compact'] },
      'profile (copy)': null,
    })
  })

  it('reorders arrays exactly without changing values', () => {
    const first = { name: 'first' }
    const second = { name: 'second' }
    const third = { name: 'third' }
    const source: JsonValue = [first, second, third]

    const moved = expectValue(moveJsonArrayItem(source, [], 2, 0))
    expect(moved).toEqual([third, first, second])
    expect(source).toEqual([first, second, third])
  })

  it('reorders predictable properties without changing their values', () => {
    const source: JsonValue = { first: 1, second: { value: 2 }, third: false }
    const moved = expectValue(moveJsonProperty(source, [], 'third', 0))

    expect(moved).toEqual({ third: false, first: 1, second: { value: 2 } })
    if (moved === null || Array.isArray(moved) || typeof moved !== 'object') return
    expect(Object.keys(moved)).toEqual(['third', 'first', 'second'])
  })

  it('rejects misleading visual reordering for objects with numeric keys', () => {
    expect(moveJsonProperty({ '0': 'zero', name: 'Ada' }, [], 'name', 0)).toMatchObject({
      ok: false,
      error: { code: 'unsupported-order' },
    })
  })

  it('applies the unified operation contract', () => {
    const result = applyJsonOperation(
      { items: [] },
      { kind: 'append-item', arrayPath: ['items'], valueType: 'string' },
    )
    expect(expectValue(result)).toEqual({ items: [''] })
  })

  it('preserves every type after editing and exporting', () => {
    const source: JsonValue = { text: '', number: 0, boolean: false, nullValue: null, array: [] }
    const edited = expectValue(setJsonValue(source, ['text'], 'ok'))
    const editedAgain = expectValue(setJsonValue(edited, ['number'], 42.5))
    const exported = JSON.parse(serializeJson(editedAgain))

    expect(exported).toEqual({ text: 'ok', number: 42.5, boolean: false, nullValue: null, array: [] })
    expect(typeof exported.number).toBe('number')
    expect(typeof exported.boolean).toBe('boolean')
  })

  it('does not add internal metadata to the exported document', () => {
    const source: JsonValue = [{ name: 'A', details: { active: true } }]
    const duplicated = expectValue(duplicateJsonArrayItem(source, [], 0))
    const reordered = expectValue(moveJsonArrayItem(duplicated, [], 1, 0))
    const exported: unknown = JSON.parse(serializeJson(reordered))

    expect(exported).toEqual([
      { name: 'A', details: { active: true } },
      { name: 'A', details: { active: true } },
    ])
    expect(serializeJson(reordered)).not.toMatch(/jsonEditor|internalId|__meta/i)
  })
})

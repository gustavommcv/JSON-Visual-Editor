import { describe, expect, it } from 'vitest'

import {
  analyzeArrayShape,
  getCompatibleCollectionViews,
  getDefaultCollectionView,
  summarizeNestedJsonValue,
} from './analyzer'
import type { JsonValue } from './types'

describe('automatic view selection', () => {
  it('defaults reasonably uniform arrays of objects to a list, with table available', () => {
    const value: JsonValue[] = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B', active: true },
    ]

    expect(analyzeArrayShape(value)).toEqual({
      kind: 'uniform-objects',
      columns: ['id', 'name', 'active'],
    })
    expect(getDefaultCollectionView(value)).toBe('list')
    expect(getCompatibleCollectionViews(value)).toEqual(['table', 'list'])
  })

  it('combines missing properties even when their order varies', () => {
    const value: JsonValue[] = [
      { name: 'A', active: true },
      { active: false, name: 'B', note: 'new' },
      { name: 'C', note: 'old' },
    ]

    expect(analyzeArrayShape(value)).toEqual({
      kind: 'uniform-objects',
      columns: ['name', 'active', 'note'],
    })
  })

  it('summarizes cells containing objects and arrays without relying on their keys', () => {
    expect(summarizeNestedJsonValue({ any: true, another: null })).toBe(
      'Object · 2 properties',
    )
    expect(summarizeNestedJsonValue([{ value: 1 }, false])).toBe('Array · 2 items')
    expect(summarizeNestedJsonValue('text')).toBeNull()
  })

  it('uses a list for simple and empty arrays', () => {
    expect(getDefaultCollectionView(['text', 1, true, null])).toBe('list')
    expect(getDefaultCollectionView([])).toBe('list')
  })

  it('uses a list for mixed, nested, or irregular arrays', () => {
    expect(getDefaultCollectionView([{ id: 1 }, 'text', [true]])).toBe('list')
    expect(getDefaultCollectionView([[1], [2]])).toBe('list')
    expect(getDefaultCollectionView([{ a: 1, b: 2 }, { c: 3 }])).toBe('list')
  })

  it('uses a form for objects, including empty objects', () => {
    expect(getDefaultCollectionView({})).toBe('form')
    expect(getCompatibleCollectionViews({})).toEqual(['form'])
  })
})

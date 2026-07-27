import { describe, expect, it } from 'vitest'

import { getJsonValueAtPath } from './operations'
import { searchJson } from './search'
import { serializeJson } from './exporter'
import type { JsonValue } from './types'

const document: JsonValue = {
  project: {
    name: 'Atlas',
    active: true,
    version: 42,
    'special.config': {
      'full name': 'Visual Editor',
    },
  },
  items: [{ description: 'First item' }, { description: 'Second item' }],
}

describe('searchJson', () => {
  it('searches property names without case sensitivity', () => {
    const results = searchJson(document, 'NAME')

    expect(results.map((result) => result.path)).toContainEqual(['project', 'name'])
    expect(results.some((result) => result.matches.includes('key'))).toBe(true)
  })

  it.each([
    ['string', 'atlas', ['project', 'name']],
    ['number', '42', ['project', 'version']],
    ['boolean', 'true', ['project', 'active']],
  ])('searches a %s value', (_label, query, expectedPath) => {
    expect(searchJson(document, query).map((result) => result.path)).toContainEqual(expectedPath)
  })

  it('searches nested values and properties with special characters', () => {
    expect(searchJson(document, 'visual editor').map((result) => result.path)).toContainEqual([
      'project',
      'special.config',
      'full name',
    ])
    expect(searchJson(document, 'special.config').map((result) => result.path)).toContainEqual([
      'project',
      'special.config',
    ])
  })

  it('searches full paths and produces a navigable destination', () => {
    const [result] = searchJson(document, '$["items"][1]["description"]')

    expect(result?.path).toEqual(['items', 1, 'description'])
    if (!result) throw new Error('Expected result not found')
    expect(getJsonValueAtPath(document, result.path)).toEqual({
      ok: true,
      value: 'Second item',
    })
  })

  it('does not change the document being searched', () => {
    const before = serializeJson(document, 'compact')
    searchJson(document, 'item')

    expect(serializeJson(document, 'compact')).toBe(before)
  })

  it('returns an empty state when there are no matches', () => {
    expect(searchJson(document, 'does not exist')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import {
  getEditedJsonDownloadName,
  getJsonDownloadName,
  prepareJsonExport,
  serializeJson,
} from './exporter'
import type { JsonValue } from './types'

describe('serializeJson', () => {
  it.each<JsonValue>([
    { name: 'Project' },
    [{ id: 1 }, { id: 2 }],
    'text',
    42,
    true,
    null,
    {},
    [],
    { 'full name': 'Ada', 'config.version': 1 },
  ])('preserves values and types through export cycle %#', (value) => {
    expect(JSON.parse(serializeJson(value))).toEqual(value)
  })

  it('formats the document with two spaces by default', () => {
    expect(serializeJson({ active: true })).toBe('{\n  "active": true\n}')
  })

  it('exports compact JSON when requested', () => {
    expect(serializeJson({ active: true }, 'compact')).toBe('{"active":true}')
  })
})

describe('getJsonDownloadName', () => {
  it('preserves names that already end in .json', () => {
    expect(getJsonDownloadName('data.JSON')).toBe('data.JSON')
  })

  it('adds the extension when needed', () => {
    expect(getJsonDownloadName('data')).toBe('data.json')
  })

  it('uses a safe name when the name is empty', () => {
    expect(getJsonDownloadName('  ')).toBe('document.json')
  })
})

describe('final export', () => {
  it('prepares formatted JSON with two spaces', () => {
    expect(prepareJsonExport({ active: true }, 'formatted')).toEqual({
      ok: true,
      contents: '{\n  "active": true\n}',
    })
  })

  it('prepares compact JSON', () => {
    expect(prepareJsonExport({ active: true }, 'compact')).toEqual({
      ok: true,
      contents: '{"active":true}',
    })
  })

  it('suggests an edited name based on the original file', () => {
    expect(getEditedJsonDownloadName('file.json')).toBe('file-edited.json')
    expect(getEditedJsonDownloadName('DATA.JSON')).toBe('DATA-edited.json')
    expect(getEditedJsonDownloadName('  ')).toBe('document-edited.json')
  })

  it('blocks invalid internal states before serialization', () => {
    expect(prepareJsonExport(Number.NaN as JsonValue, 'compact')).toMatchObject({ ok: false })
    expect(prepareJsonExport({ value: undefined } as unknown as JsonValue)).toMatchObject({
      ok: false,
    })
  })

  it('does not add interface, history, or search metadata', () => {
    const value: JsonValue = { id: 1, url: 'https://example.test/image.png', data: [true] }
    const result = prepareJsonExport(value, 'compact')

    expect(result).toEqual({
      ok: true,
      contents: '{"id":1,"url":"https://example.test/image.png","data":[true]}',
    })
    if (!result.ok) return
    expect(result.contents).not.toMatch(/history|selection|search|internal|__meta/i)
  })

  it('preserves user-provided Portuguese content exactly', () => {
    const value: JsonValue = {
      titulo: 'Maquete residencial',
      descricao: 'Projeto criado em Curitiba',
    }

    const result = prepareJsonExport(value, 'compact')
    expect(result).toEqual({
      ok: true,
      contents: '{"titulo":"Maquete residencial","descricao":"Projeto criado em Curitiba"}',
    })
  })
})

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
    { nome: 'Projeto' },
    [{ id: 1 }, { id: 2 }],
    'texto',
    42,
    true,
    null,
    {},
    [],
    { 'nome completo': 'Ada', 'config.versao': 1 },
  ])('preserva valor e tipos no ciclo de exportação %#', (value) => {
    expect(JSON.parse(serializeJson(value))).toEqual(value)
  })

  it('formata o documento com dois espaços por padrão', () => {
    expect(serializeJson({ ativo: true })).toBe('{\n  "ativo": true\n}')
  })

  it('exporta em formato compacto quando solicitado', () => {
    expect(serializeJson({ ativo: true }, 'compact')).toBe('{"ativo":true}')
  })
})

describe('getJsonDownloadName', () => {
  it('preserva nomes que já terminam em .json', () => {
    expect(getJsonDownloadName('dados.JSON')).toBe('dados.JSON')
  })

  it('adiciona a extensão quando necessário', () => {
    expect(getJsonDownloadName('dados')).toBe('dados.json')
  })

  it('usa um nome seguro quando o nome está vazio', () => {
    expect(getJsonDownloadName('  ')).toBe('documento.json')
  })
})

describe('exportação final', () => {
  it('prepara JSON formatado com dois espaços', () => {
    expect(prepareJsonExport({ ativo: true }, 'formatted')).toEqual({
      ok: true,
      contents: '{\n  "ativo": true\n}',
    })
  })

  it('prepara JSON compacto', () => {
    expect(prepareJsonExport({ ativo: true }, 'compact')).toEqual({
      ok: true,
      contents: '{"ativo":true}',
    })
  })

  it('sugere um nome editado baseado no arquivo original', () => {
    expect(getEditedJsonDownloadName('arquivo.json')).toBe('arquivo-editado.json')
    expect(getEditedJsonDownloadName('DADOS.JSON')).toBe('DADOS-editado.json')
    expect(getEditedJsonDownloadName('  ')).toBe('documento-editado.json')
  })

  it('bloqueia estados internos inválidos antes da serialização', () => {
    expect(prepareJsonExport(Number.NaN as JsonValue, 'compact')).toMatchObject({ ok: false })
    expect(prepareJsonExport({ valor: undefined } as unknown as JsonValue)).toMatchObject({
      ok: false,
    })
  })

  it('não acrescenta metadados de interface, histórico ou busca', () => {
    const value: JsonValue = { id: 1, url: 'https://exemplo.test/imagem.png', dados: [true] }
    const result = prepareJsonExport(value, 'compact')

    expect(result).toEqual({
      ok: true,
      contents: '{"id":1,"url":"https://exemplo.test/imagem.png","dados":[true]}',
    })
    if (!result.ok) return
    expect(result.contents).not.toMatch(/history|selection|search|internal|__meta/i)
  })
})

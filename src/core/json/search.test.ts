import { describe, expect, it } from 'vitest'

import { getJsonValueAtPath } from './operations'
import { searchJson } from './search'
import { serializeJson } from './exporter'
import type { JsonValue } from './types'

const document: JsonValue = {
  projeto: {
    nome: 'Atlas',
    ativo: true,
    versao: 42,
    'config.versão': {
      'nome completo': 'Editor Visual',
    },
  },
  itens: [{ descricao: 'Primeiro item' }, { descricao: 'Segundo item' }],
}

describe('searchJson', () => {
  it('busca nomes de propriedades sem diferenciar maiúsculas', () => {
    const results = searchJson(document, 'NOME')

    expect(results.map((result) => result.path)).toContainEqual(['projeto', 'nome'])
    expect(results.some((result) => result.matches.includes('key'))).toBe(true)
  })

  it.each([
    ['string', 'atlas', ['projeto', 'nome']],
    ['número', '42', ['projeto', 'versao']],
    ['booleano', 'verdadeiro', ['projeto', 'ativo']],
  ])('busca um valor %s', (_label, query, expectedPath) => {
    expect(searchJson(document, query).map((result) => result.path)).toContainEqual(expectedPath)
  })

  it('busca valores aninhados e propriedades com caracteres especiais', () => {
    expect(searchJson(document, 'editor visual').map((result) => result.path)).toContainEqual([
      'projeto',
      'config.versão',
      'nome completo',
    ])
    expect(searchJson(document, 'config.versão').map((result) => result.path)).toContainEqual([
      'projeto',
      'config.versão',
    ])
  })

  it('busca caminhos completos e produz um destino navegável', () => {
    const [result] = searchJson(document, '$["itens"][1]["descricao"]')

    expect(result?.path).toEqual(['itens', 1, 'descricao'])
    if (!result) throw new Error('Resultado esperado não encontrado')
    expect(getJsonValueAtPath(document, result.path)).toEqual({
      ok: true,
      value: 'Segundo item',
    })
  })

  it('não altera o documento pesquisado', () => {
    const before = serializeJson(document, 'compact')
    searchJson(document, 'item')

    expect(serializeJson(document, 'compact')).toBe(before)
  })

  it('retorna estado vazio para busca sem correspondências', () => {
    expect(searchJson(document, 'não existe')).toEqual([])
  })
})

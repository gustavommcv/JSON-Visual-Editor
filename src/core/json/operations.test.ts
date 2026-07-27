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

describe('operações JSON por caminho', () => {
  it('acessa e altera objetos aninhados sem modificar a origem', () => {
    const source: JsonValue = { projeto: { nome: 'Antigo', ativo: true } }
    const result = setJsonValue(source, ['projeto', 'nome'], 'Novo')

    expect(expectValue(result)).toEqual({ projeto: { nome: 'Novo', ativo: true } })
    expect(source).toEqual({ projeto: { nome: 'Antigo', ativo: true } })
    expect(getJsonValueAtPath(expectValue(result), ['projeto', 'nome'])).toEqual({
      ok: true,
      value: 'Novo',
    })
  })

  it('altera arrays aninhados por índice', () => {
    const source: JsonValue = { grupos: [[1, 2], [3]] }
    const result = setJsonValue(source, ['grupos', 0, 1], 20)

    expect(expectValue(result)).toEqual({ grupos: [[1, 20], [3]] })
  })

  it('edita a raiz e permite substituí-la', () => {
    expect(expectValue(setJsonValue({ antes: true }, [], 'agora texto'))).toBe('agora texto')
    expect(expectValue(replaceJsonRoot('antes', [1, false, null]))).toEqual([1, false, null])
  })

  it('troca o tipo usando o valor inicial correto', () => {
    const source: JsonValue = { valor: null }

    expect(expectValue(changeJsonValueType(source, ['valor'], 'array'))).toEqual({ valor: [] })
    expect(expectValue(changeJsonValueType(source, ['valor'], 'number'))).toEqual({ valor: 0 })
  })

  it('adiciona conteúdo a objetos e arrays vazios', () => {
    const withProperty = expectValue(addJsonProperty({}, [], 'novo campo', 'boolean'))
    expect(withProperty).toEqual({ 'novo campo': false })

    const withItem = expectValue(appendJsonArrayItem([], [], 'object'))
    expect(withItem).toEqual([{}])
  })

  it('renomeia propriedades preservando a posição e o valor', () => {
    const source: JsonValue = { primeiro: 1, nome: { ativo: true }, ultimo: 3 }
    const result = renameJsonProperty(source, [], 'nome', 'dados')
    const renamed = expectValue(result)

    expect(renamed).toEqual({ primeiro: 1, dados: { ativo: true }, ultimo: 3 })
    expect(renamed).not.toBeNull()
    expect(Array.isArray(renamed)).toBe(false)
    expect(typeof renamed).toBe('object')
    if (renamed === null || Array.isArray(renamed) || typeof renamed !== 'object') return
    expect(Object.keys(renamed)).toEqual(['primeiro', 'dados', 'ultimo'])
  })

  it('impede colisão ao renomear ou adicionar uma chave', () => {
    const source: JsonValue = { nome: 'Ada', ativo: true }

    expect(renameJsonProperty(source, [], 'nome', 'ativo')).toMatchObject({
      ok: false,
      error: { code: 'duplicate-key' },
    })
    expect(addJsonProperty(source, [], 'nome', 'null')).toMatchObject({
      ok: false,
      error: { code: 'duplicate-key' },
    })
    expect(source).toEqual({ nome: 'Ada', ativo: true })
  })

  it('trata pontos, espaços, barras, acentos e símbolos como segmentos literais', () => {
    const source: JsonValue = {
      'config.versão': {
        'nome completo': {
          'rota/principal': { 'ação#1': 'antes' },
        },
      },
    }
    const path = ['config.versão', 'nome completo', 'rota/principal', 'ação#1']
    const result = setJsonValue(source, path, 'depois')

    expect(getJsonValueAtPath(expectValue(result), path)).toEqual({ ok: true, value: 'depois' })
  })

  it('falha de forma explícita ao acessar um caminho inexistente', () => {
    expect(getJsonValueAtPath({ itens: [] }, ['itens', 0])).toMatchObject({
      ok: false,
      error: { code: 'invalid-path' },
    })
    expect(setJsonValue({ dados: {} }, ['dados', 'ausente'], true)).toMatchObject({
      ok: false,
      error: { code: 'invalid-path' },
    })
  })

  it('remove itens e propriedades somente através da operação central', () => {
    expect(expectValue(removeJsonValue({ itens: [1, 2, 3] }, ['itens', 1]))).toEqual({
      itens: [1, 3],
    })
    expect(expectValue(removeJsonValue({ a: 1, b: 2 }, ['a']))).toEqual({ b: 2 })
  })

  it('duplica um item com cópia profunda e o insere logo depois da origem', () => {
    const nested: JsonValue = [{ dados: { tags: ['a'], ativo: true } }, { dados: null }]
    const duplicated = expectValue(duplicateJsonArrayItem(nested, [], 0))

    expect(duplicated).toEqual([
      { dados: { tags: ['a'], ativo: true } },
      { dados: { tags: ['a'], ativo: true } },
      { dados: null },
    ])
    if (!Array.isArray(duplicated)) return
    expect(duplicated[1]).not.toBe(duplicated[0])
    expect(cloneJsonValue(duplicated[0] as JsonValue)).toEqual(duplicated[0])

    const editedDuplicate = expectValue(setJsonValue(duplicated, [1, 'dados', 'tags', 0], 'b'))
    expect(editedDuplicate).toEqual([
      { dados: { tags: ['a'], ativo: true } },
      { dados: { tags: ['b'], ativo: true } },
      { dados: null },
    ])
  })

  it('duplica propriedades com nomes únicos e cópia profunda', () => {
    const source: JsonValue = {
      perfil: { preferencias: ['compacto'] },
      'perfil (cópia)': null,
    }
    const result = expectValue(duplicateJsonProperty(source, [], 'perfil'))

    expect(result).toEqual({
      perfil: { preferencias: ['compacto'] },
      'perfil (cópia) 2': { preferencias: ['compacto'] },
      'perfil (cópia)': null,
    })
  })

  it('reordena arrays exatamente sem alterar valores', () => {
    const first = { nome: 'primeiro' }
    const second = { nome: 'segundo' }
    const third = { nome: 'terceiro' }
    const source: JsonValue = [first, second, third]

    const moved = expectValue(moveJsonArrayItem(source, [], 2, 0))
    expect(moved).toEqual([third, first, second])
    expect(source).toEqual([first, second, third])
  })

  it('reordena propriedades previsíveis sem alterar seus valores', () => {
    const source: JsonValue = { primeiro: 1, segundo: { valor: 2 }, terceiro: false }
    const moved = expectValue(moveJsonProperty(source, [], 'terceiro', 0))

    expect(moved).toEqual({ terceiro: false, primeiro: 1, segundo: { valor: 2 } })
    if (moved === null || Array.isArray(moved) || typeof moved !== 'object') return
    expect(Object.keys(moved)).toEqual(['terceiro', 'primeiro', 'segundo'])
  })

  it('recusa reordenação visual enganosa para objetos com chaves numéricas', () => {
    expect(moveJsonProperty({ '0': 'zero', nome: 'Ada' }, [], 'nome', 0)).toMatchObject({
      ok: false,
      error: { code: 'unsupported-order' },
    })
  })

  it('aplica o contrato unificado de operações', () => {
    const result = applyJsonOperation(
      { itens: [] },
      { kind: 'append-item', arrayPath: ['itens'], valueType: 'string' },
    )
    expect(expectValue(result)).toEqual({ itens: [''] })
  })

  it('preserva todos os tipos após editar e exportar', () => {
    const source: JsonValue = { texto: '', numero: 0, booleano: false, nulo: null, lista: [] }
    const edited = expectValue(setJsonValue(source, ['texto'], 'ok'))
    const editedAgain = expectValue(setJsonValue(edited, ['numero'], 42.5))
    const exported = JSON.parse(serializeJson(editedAgain))

    expect(exported).toEqual({ texto: 'ok', numero: 42.5, booleano: false, nulo: null, lista: [] })
    expect(typeof exported.numero).toBe('number')
    expect(typeof exported.booleano).toBe('boolean')
  })

  it('não adiciona metadados internos ao documento exportado', () => {
    const source: JsonValue = [{ nome: 'A', detalhes: { ativo: true } }]
    const duplicated = expectValue(duplicateJsonArrayItem(source, [], 0))
    const reordered = expectValue(moveJsonArrayItem(duplicated, [], 1, 0))
    const exported: unknown = JSON.parse(serializeJson(reordered))

    expect(exported).toEqual([
      { nome: 'A', detalhes: { ativo: true } },
      { nome: 'A', detalhes: { ativo: true } },
    ])
    expect(serializeJson(reordered)).not.toMatch(/jsonEditor|internalId|__meta/i)
  })
})

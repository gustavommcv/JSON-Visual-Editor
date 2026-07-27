import { describe, expect, it } from 'vitest'

import { parseJson } from './parser'

describe('parseJson', () => {
  it.each([
    ['objeto', '{"nome":"Projeto"}', { nome: 'Projeto' }],
    ['array', '[{"id":1},{"id":2}]', [{ id: 1 }, { id: 2 }]],
    ['texto', '"texto"', 'texto'],
    ['número', '42', 42],
    ['booleano', 'true', true],
    ['nulo', 'null', null],
    ['objeto vazio', '{}', {}],
    ['array vazio', '[]', []],
  ])('importa uma raiz do tipo %s', (_label, source, expected) => {
    expect(parseJson(source)).toEqual({ ok: true, value: expected })
  })

  it('preserva propriedades com espaço e ponto', () => {
    const source = '{"nome completo":"Ada","config.versao":1}'

    expect(parseJson(source)).toEqual({
      ok: true,
      value: { 'nome completo': 'Ada', 'config.versao': 1 },
    })
  })

  it('rejeita arquivo vazio', () => {
    expect(parseJson('  \n\t ')).toMatchObject({
      ok: false,
      error: { code: 'empty-file' },
    })
  })

  it('rejeita JSON malformado', () => {
    expect(parseJson('{"nome":}')).toMatchObject({
      ok: false,
      error: { code: 'invalid-json' },
    })
  })

  it.each(['9007199254740992', '-9007199254740992', '{"id": 1e20}'])(
    'rejeita inteiro fora da faixa segura: %s',
    (source) => {
      expect(parseJson(source)).toMatchObject({
        ok: false,
        error: { code: 'unsafe-integer' },
      })
    },
  )

  it('não confunde dígitos dentro de textos com números inseguros', () => {
    expect(parseJson('"9007199254740992"')).toEqual({
      ok: true,
      value: '9007199254740992',
    })
  })

  it('rejeita números infinitos para o runtime do navegador', () => {
    expect(parseJson('1e400')).toMatchObject({
      ok: false,
      error: { code: 'unsupported-number' },
    })
  })
})

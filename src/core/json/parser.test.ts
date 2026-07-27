import { describe, expect, it } from 'vitest'

import { parseJson } from './parser'

describe('parseJson', () => {
  it.each([
    ['object', '{"name":"Project"}', { name: 'Project' }],
    ['array', '[{"id":1},{"id":2}]', [{ id: 1 }, { id: 2 }]],
    ['string', '"text"', 'text'],
    ['number', '42', 42],
    ['boolean', 'true', true],
    ['null', 'null', null],
    ['empty object', '{}', {}],
    ['empty array', '[]', []],
  ])('imports a %s root', (_label, source, expected) => {
    expect(parseJson(source)).toEqual({ ok: true, value: expected })
  })

  it('preserves properties with spaces and dots', () => {
    const source = '{"full name":"Ada","config.version":1}'

    expect(parseJson(source)).toEqual({
      ok: true,
      value: { 'full name': 'Ada', 'config.version': 1 },
    })
  })

  it('rejects an empty file', () => {
    expect(parseJson('  \n\t ')).toMatchObject({
      ok: false,
      error: { code: 'empty-file' },
    })
  })

  it('rejects malformed JSON with an English error', () => {
    const result = parseJson('{"name":}')
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid-json' },
    })
    if (result.ok) return
    expect(result.error.message).toContain('The selected file is not valid JSON')
  })

  it.each(['9007199254740992', '-9007199254740992', '{"id": 1e20}'])(
    'rejects an integer outside the safe range: %s',
    (source) => {
      expect(parseJson(source)).toMatchObject({
        ok: false,
        error: { code: 'unsafe-integer' },
      })
    },
  )

  it('does not confuse digits inside strings with unsafe numbers', () => {
    expect(parseJson('"9007199254740992"')).toEqual({
      ok: true,
      value: '9007199254740992',
    })
  })

  it('rejects numbers that become infinite in the browser runtime', () => {
    expect(parseJson('1e400')).toMatchObject({
      ok: false,
      error: { code: 'unsupported-number' },
    })
  })

  it('preserves user-provided Portuguese property names and values exactly', () => {
    const source = '{"titulo":"Maquete residencial","descricao":"Projeto criado em Curitiba"}'

    expect(parseJson(source)).toEqual({
      ok: true,
      value: {
        titulo: 'Maquete residencial',
        descricao: 'Projeto criado em Curitiba',
      },
    })
  })
})

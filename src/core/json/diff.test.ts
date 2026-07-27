import { describe, expect, it } from 'vitest'

import { areJsonSnapshotsEqual, areJsonValuesEqual, compareJsonValues } from './diff'
import type { JsonValue } from './types'

describe('comparação estrutural JSON', () => {
  it('compara valores e tipos pelo caminho afetado', () => {
    expect(compareJsonValues({ valor: 1 }, { valor: '1' })).toEqual([
      { kind: 'changed', path: ['valor'], before: 1, after: '1' },
    ])
  })

  it('informa adições e remoções sem reduzir o documento a texto bruto', () => {
    const changes = compareJsonValues(
      { removido: { id: 1 }, mantido: true },
      { adicionado: ['novo'], mantido: true },
    )

    expect(changes).toEqual([
      { kind: 'removed', path: ['removido'], before: { id: 1 } },
      { kind: 'added', path: ['adicionado'], after: ['novo'] },
    ])
  })

  it('detecta uma reordenação pura de array como uma mudança própria', () => {
    const before: JsonValue = { itens: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    const after: JsonValue = { itens: [{ id: 3 }, { id: 1 }, { id: 2 }] }

    expect(compareJsonValues(before, after)).toEqual([
      {
        kind: 'reordered',
        path: ['itens'],
        before: [{ id: 1 }, { id: 2 }, { id: 3 }],
        after: [{ id: 3 }, { id: 1 }, { id: 2 }],
      },
    ])
  })

  it('não trata a ordem das propriedades de objetos como mudança semântica', () => {
    const before: JsonValue = { primeiro: 1, segundo: { a: true, b: false } }
    const after: JsonValue = { segundo: { b: false, a: true }, primeiro: 1 }

    expect(areJsonValuesEqual(before, after)).toBe(true)
    expect(areJsonSnapshotsEqual(before, after)).toBe(false)
    expect(compareJsonValues(before, after)).toEqual([])
  })

  it('mantém caminhos segmentados para propriedades com caracteres especiais', () => {
    expect(compareJsonValues(
      { 'config. versão': { 'rota/principal': false } },
      { 'config. versão': { 'rota/principal': true } },
    )).toEqual([
      {
        kind: 'changed',
        path: ['config. versão', 'rota/principal'],
        before: false,
        after: true,
      },
    ])
  })
})

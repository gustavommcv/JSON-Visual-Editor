import { describe, expect, it } from 'vitest'

import {
  commitJsonHistory,
  createJsonHistory,
  redoJsonHistory,
  undoJsonHistory,
} from './history'
import { applyJsonOperation, type JsonEditorOperation } from './operations'
import type { JsonValue } from './types'

interface OperationCase {
  label: string
  initial: JsonValue
  operation: JsonEditorOperation
  expected: JsonValue
}

const operationCases: OperationCase[] = [
  {
    label: 'edição',
    initial: { nome: 'antes' },
    operation: { kind: 'set-value', path: ['nome'], value: 'depois' },
    expected: { nome: 'depois' },
  },
  {
    label: 'alteração de tipo',
    initial: { valor: null },
    operation: { kind: 'change-type', path: ['valor'], valueType: 'array' },
    expected: { valor: [] },
  },
  {
    label: 'criação de propriedade',
    initial: {},
    operation: { kind: 'add-property', objectPath: [], key: 'ativo', valueType: 'boolean' },
    expected: { ativo: false },
  },
  {
    label: 'criação de item',
    initial: [],
    operation: { kind: 'append-item', arrayPath: [], valueType: 'number' },
    expected: [0],
  },
  {
    label: 'duplicação de item',
    initial: [{ aninhado: ['a'] }],
    operation: { kind: 'duplicate-array-item', arrayPath: [], index: 0 },
    expected: [{ aninhado: ['a'] }, { aninhado: ['a'] }],
  },
  {
    label: 'duplicação de propriedade',
    initial: { perfil: { ativo: true } },
    operation: { kind: 'duplicate-property', objectPath: [], key: 'perfil' },
    expected: { perfil: { ativo: true }, 'perfil (cópia)': { ativo: true } },
  },
  {
    label: 'exclusão',
    initial: { a: 1, b: 2 },
    operation: { kind: 'remove-value', path: ['a'] },
    expected: { b: 2 },
  },
  {
    label: 'renomeação',
    initial: { nome: 'Ada' },
    operation: { kind: 'rename-property', objectPath: [], previousKey: 'nome', nextKey: 'pessoa' },
    expected: { pessoa: 'Ada' },
  },
  {
    label: 'reordenação de array',
    initial: ['a', 'b', 'c'],
    operation: { kind: 'move-array-item', arrayPath: [], fromIndex: 2, toIndex: 0 },
    expected: ['c', 'a', 'b'],
  },
  {
    label: 'reordenação de objeto',
    initial: { a: 1, b: 2 },
    operation: { kind: 'move-property', objectPath: [], key: 'b', toIndex: 0 },
    expected: { b: 2, a: 1 },
  },
  {
    label: 'substituição da raiz',
    initial: { antes: true },
    operation: { kind: 'replace-root', value: ['agora'] },
    expected: ['agora'],
  },
]

describe('histórico de snapshots JSON', () => {
  it.each(operationCases)('desfaz e refaz $label', ({ initial, operation, expected }) => {
    const operationResult = applyJsonOperation(initial, operation)
    expect(operationResult.ok).toBe(true)
    if (!operationResult.ok) return

    const committed = commitJsonHistory(createJsonHistory(initial), operationResult.value)
    expect(committed.present).toEqual(expected)

    const undone = undoJsonHistory(committed)
    expect(undone.present).toEqual(initial)
    expect(undone.future).toHaveLength(1)

    const redone = redoJsonHistory(undone)
    expect(redone.present).toEqual(expected)
  })

  it('descarta a pilha de refazer quando uma nova edição é criada', () => {
    const first = commitJsonHistory(createJsonHistory(0), 1)
    const second = commitJsonHistory(first, 2)
    const undone = undoJsonHistory(second)
    const branched = commitJsonHistory(undone, 10)

    expect(branched.present).toBe(10)
    expect(branched.future).toEqual([])
    expect(redoJsonHistory(branched)).toBe(branched)
  })

  it('limita o consumo da pilha e mantém os snapshots mais recentes', () => {
    let history = createJsonHistory(0, 3)
    for (let value = 1; value <= 5; value += 1) {
      history = commitJsonHistory(history, value)
    }

    expect(history.past).toEqual([2, 3, 4])
    history = undoJsonHistory(history)
    history = undoJsonHistory(history)
    history = undoJsonHistory(history)
    expect(history.present).toBe(2)
    expect(undoJsonHistory(history)).toBe(history)
  })

  it('agrupa digitação contínua no mesmo campo em uma única etapa', () => {
    let history = createJsonHistory({ texto: '' })
    history = commitJsonHistory(history, { texto: 'a' }, { groupKey: 'text:["texto"]', timestamp: 0 })
    history = commitJsonHistory(history, { texto: 'ab' }, { groupKey: 'text:["texto"]', timestamp: 200 })
    history = commitJsonHistory(history, { texto: 'abc' }, { groupKey: 'text:["texto"]', timestamp: 500 })

    expect(history.past).toHaveLength(1)
    expect(undoJsonHistory(history).present).toEqual({ texto: '' })

    const expired = commitJsonHistory(history, { texto: 'abcd' }, {
      groupKey: 'text:["texto"]',
      timestamp: 2_000,
    })
    expect(expired.past).toHaveLength(2)
  })

  it('restaura o original por snapshot completo e permite desfazer a restauração', () => {
    const original: JsonValue = { dados: [{ nome: 'A' }], ativo: true }
    const edited: JsonValue = { dados: [{ nome: 'B' }, { nome: 'C' }], ativo: false }
    const history = commitJsonHistory(createJsonHistory(original), edited)
    const restored = commitJsonHistory(history, original)

    expect(restored.present).toEqual(original)
    expect(undoJsonHistory(restored).present).toEqual(edited)
  })
})

import { describe, expect, it } from 'vitest'

import {
  analyzeArrayShape,
  getCompatibleCollectionViews,
  getDefaultCollectionView,
  summarizeNestedJsonValue,
} from './analyzer'
import type { JsonValue } from './types'

describe('seleção automática de visualização', () => {
  it('usa tabela para arrays de objetos razoavelmente uniformes', () => {
    const value: JsonValue[] = [
      { id: 1, nome: 'A' },
      { id: 2, nome: 'B', ativo: true },
    ]

    expect(analyzeArrayShape(value)).toEqual({
      kind: 'uniform-objects',
      columns: ['id', 'nome', 'ativo'],
    })
    expect(getDefaultCollectionView(value)).toBe('table')
    expect(getCompatibleCollectionViews(value)).toEqual(['table', 'list', 'tree'])
  })

  it('une propriedades ausentes mesmo quando as ordens variam', () => {
    const value: JsonValue[] = [
      { nome: 'A', ativo: true },
      { ativo: false, nome: 'B', nota: 'novo' },
      { nome: 'C', nota: 'antigo' },
    ]

    expect(analyzeArrayShape(value)).toEqual({
      kind: 'uniform-objects',
      columns: ['nome', 'ativo', 'nota'],
    })
  })

  it('resume células contendo objetos e arrays sem depender de suas chaves', () => {
    expect(summarizeNestedJsonValue({ qualquer: true, outra: null })).toBe(
      'Objeto · 2 propriedades',
    )
    expect(summarizeNestedJsonValue([{ valor: 1 }, false])).toBe('Array · 2 itens')
    expect(summarizeNestedJsonValue('texto')).toBeNull()
  })

  it('usa lista para arrays simples e vazios', () => {
    expect(getDefaultCollectionView(['texto', 1, true, null])).toBe('list')
    expect(getDefaultCollectionView([])).toBe('list')
  })

  it('usa árvore para arrays mistos, aninhados ou irregulares', () => {
    expect(getDefaultCollectionView([{ id: 1 }, 'texto', [true]])).toBe('tree')
    expect(getDefaultCollectionView([[1], [2]])).toBe('tree')
    expect(getDefaultCollectionView([{ a: 1, b: 2 }, { c: 3 }])).toBe('tree')
  })

  it('usa formulário em objetos, inclusive vazios', () => {
    expect(getDefaultCollectionView({})).toBe('form')
    expect(getCompatibleCollectionViews({})).toEqual(['form', 'tree'])
  })
})

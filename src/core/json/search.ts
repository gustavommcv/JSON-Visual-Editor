import { formatJsonPath } from './path'
import type { JsonPath, JsonRootKind, JsonValue } from './types'

export type JsonSearchMatchKind = 'key' | 'value' | 'path'

export interface JsonSearchResult {
  path: JsonPath
  pathLabel: string
  preview: string
  valueKind: JsonRootKind
  matches: JsonSearchMatchKind[]
}

export interface JsonSearchOptions {
  maxResults?: number
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('pt-BR')
}

function getValueKind(value: JsonValue): JsonRootKind {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as Exclude<JsonRootKind, 'array' | 'null'>
}

function searchablePrimitive(value: JsonValue): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') {
    return value ? 'true verdadeiro' : 'false falso'
  }
  return null
}

function previewJsonValue(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `Array com ${value.length} ${value.length === 1 ? 'item' : 'itens'}`
  }

  if (value !== null && typeof value === 'object') {
    const count = Object.keys(value).length
    return `Objeto com ${count} ${count === 1 ? 'propriedade' : 'propriedades'}`
  }

  if (typeof value === 'string') {
    return value.length > 90 ? `${value.slice(0, 87)}…` : value
  }

  return value === null ? 'null' : String(value)
}

export function searchJson(
  root: JsonValue,
  query: string,
  options: JsonSearchOptions = {},
): JsonSearchResult[] {
  const normalizedQuery = normalizeSearchText(query.trim())
  if (normalizedQuery.length === 0) return []

  const maxResults = options.maxResults ?? 250
  const results: JsonSearchResult[] = []

  function visit(value: JsonValue, path: JsonPath, propertyKey?: string): void {
    if (results.length >= maxResults) return

    const matches: JsonSearchMatchKind[] = []
    const pathLabel = formatJsonPath(path)

    if (propertyKey !== undefined && normalizeSearchText(propertyKey).includes(normalizedQuery)) {
      matches.push('key')
    }

    const primitive = searchablePrimitive(value)
    if (primitive !== null && normalizeSearchText(primitive).includes(normalizedQuery)) {
      matches.push('value')
    }

    if (normalizeSearchText(pathLabel).includes(normalizedQuery)) {
      matches.push('path')
    }

    if (matches.length > 0) {
      results.push({
        path: [...path],
        pathLabel,
        preview: previewJsonValue(value),
        valueKind: getValueKind(value),
        matches,
      })
    }

    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, [...path, index]))
      return
    }

    if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => visit(child, [...path, key], key))
    }
  }

  visit(root, [])
  return results
}

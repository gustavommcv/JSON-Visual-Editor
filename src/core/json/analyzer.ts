import type { JsonObject, JsonRootKind, JsonValue } from './types'

export type JsonCollectionView = 'form' | 'table' | 'list'

export interface JsonArrayShape {
  kind: 'uniform-objects' | 'simple' | 'irregular'
  columns: string[]
}

export interface JsonRootSummary {
  kind: JsonRootKind
  label: string
  detail: string
}

export function getRootKind(value: JsonValue): JsonRootKind {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as Exclude<JsonRootKind, 'array' | 'null'>
}

export function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function analyzeArrayShape(value: JsonValue[]): JsonArrayShape {
  if (value.length === 0 || value.every((item) => !Array.isArray(item) && !isJsonObject(item))) {
    return { kind: 'simple', columns: [] }
  }

  if (value.every(isJsonObject)) {
    const columns = [...new Set(value.flatMap((item) => Object.keys(item)))]
    const isReasonableWidth = columns.length <= 16
    const rowsAreSimilar =
      columns.length === 0 ||
      value.every((item) => Object.keys(item).length / columns.length >= 0.5)

    if (isReasonableWidth && rowsAreSimilar) {
      return { kind: 'uniform-objects', columns }
    }
  }

  return { kind: 'irregular', columns: [] }
}

export function summarizeNestedJsonValue(value: JsonValue): string | null {
  if (Array.isArray(value)) {
    return `Array · ${value.length} ${value.length === 1 ? 'item' : 'items'}`
  }

  if (isJsonObject(value)) {
    const propertyCount = Object.keys(value).length
    return `Object · ${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`
  }

  return null
}

export function getDefaultCollectionView(value: JsonObject | JsonValue[]): JsonCollectionView {
  if (!Array.isArray(value)) return 'form'

  const shape = analyzeArrayShape(value)
  if (shape.kind === 'uniform-objects') return 'table'
  return 'list'
}

export function getCompatibleCollectionViews(
  value: JsonObject | JsonValue[],
): JsonCollectionView[] {
  if (!Array.isArray(value)) return ['form']

  const shape = analyzeArrayShape(value)
  if (shape.kind === 'uniform-objects') return ['table', 'list']
  return ['list']
}

export function analyzeRoot(value: JsonValue): JsonRootSummary {
  const kind = getRootKind(value)

  if (kind === 'object') {
    const propertyCount = Object.keys(value as Record<string, JsonValue>).length
    return {
      kind,
      label: 'Object',
      detail: `${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`,
    }
  }

  if (kind === 'array') {
    const itemCount = (value as JsonValue[]).length
    return {
      kind,
      label: 'Array',
      detail: `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
    }
  }

  const labels: Record<Exclude<JsonRootKind, 'object' | 'array'>, string> = {
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    null: 'Null',
  }

  return {
    kind,
    label: labels[kind],
    detail: 'Primitive value at the root',
  }
}

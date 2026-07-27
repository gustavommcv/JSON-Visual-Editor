import type { JsonValue } from './types'

export type JsonFormatting = 'formatted' | 'compact'

export type JsonExportPreparation =
  | { ok: true; contents: string }
  | { ok: false; error: string }

function validateJsonValue(value: unknown, ancestors: Set<object>): string | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      return 'The document contains a number that cannot be exported safely.'
    }
    return null
  }
  if (typeof value !== 'object') return 'The current state contains a value that is not valid JSON.'
  if (ancestors.has(value)) return 'The current state contains a circular reference.'

  ancestors.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        ancestors.delete(value)
        return 'The current state contains an empty position in an array.'
      }
      const error = validateJsonValue(value[index], ancestors)
      if (error) {
        ancestors.delete(value)
        return error
      }
    }
  } else {
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) {
      ancestors.delete(value)
      return 'The current state contains an object that cannot be represented as JSON.'
    }
    for (const child of Object.values(value)) {
      const error = validateJsonValue(child, ancestors)
      if (error) {
        ancestors.delete(value)
        return error
      }
    }
  }
  ancestors.delete(value)
  return null
}

export function getJsonExportError(value: unknown): string | null {
  return validateJsonValue(value, new Set<object>())
}

export function serializeJson(
  value: JsonValue,
  formatting: JsonFormatting = 'formatted',
): string {
  return JSON.stringify(value, null, formatting === 'formatted' ? 2 : 0)
}

export function prepareJsonExport(
  value: JsonValue,
  formatting: JsonFormatting = 'formatted',
): JsonExportPreparation {
  const error = getJsonExportError(value)
  if (error) return { ok: false, error }
  return { ok: true, contents: serializeJson(value, formatting) }
}

export function getJsonDownloadName(fileName: string): string {
  const trimmedName = fileName.trim()
  if (trimmedName.length === 0) return 'document.json'
  return trimmedName.toLowerCase().endsWith('.json') ? trimmedName : `${trimmedName}.json`
}

export function getEditedJsonDownloadName(fileName: string): string {
  const trimmedName = fileName.trim()
  const baseName = trimmedName.replace(/\.json$/i, '').trim()
  return `${baseName || 'document'}-edited.json`
}

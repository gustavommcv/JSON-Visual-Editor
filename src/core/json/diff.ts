import type { JsonObject, JsonPath, JsonValue } from './types'

export type JsonChangeKind = 'added' | 'removed' | 'changed' | 'reordered'

export type JsonChange =
  | { kind: 'added'; path: JsonPath; after: JsonValue }
  | { kind: 'removed'; path: JsonPath; before: JsonValue }
  | { kind: 'changed' | 'reordered'; path: JsonPath; before: JsonValue; after: JsonValue }

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function areJsonValuesEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((value, index) => {
      const other = right[index]
      return other !== undefined && areJsonValuesEqual(value, other)
    })
  }

  if (!isJsonObject(left) || !isJsonObject(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every((key) => {
    const rightValue = right[key]
    return Object.prototype.hasOwnProperty.call(right, key) &&
      rightValue !== undefined &&
      areJsonValuesEqual(left[key] as JsonValue, rightValue)
  })
}

export function areJsonSnapshotsEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => {
      const other = right[index]
      return other !== undefined && areJsonSnapshotsEqual(value, other)
    })
  }
  if (!isJsonObject(left) || !isJsonObject(right)) return false

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => {
    const rightKey = rightKeys[index]
    if (key !== rightKey) return false
    const rightValue = right[key]
    return rightValue !== undefined && areJsonSnapshotsEqual(left[key] as JsonValue, rightValue)
  })
}

function stableFingerprint(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableFingerprint).join(',')}]`
  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableFingerprint(value[key] as JsonValue)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function isPureArrayReorder(before: JsonValue[], after: JsonValue[]): boolean {
  if (before.length !== after.length || before.length < 2) return false

  const counts = new Map<string, number>()
  for (const item of before) {
    const fingerprint = stableFingerprint(item)
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1)
  }
  for (const item of after) {
    const fingerprint = stableFingerprint(item)
    const count = counts.get(fingerprint) ?? 0
    if (count === 0) return false
    if (count === 1) counts.delete(fingerprint)
    else counts.set(fingerprint, count - 1)
  }
  return counts.size === 0
}

function collectChanges(
  before: JsonValue,
  after: JsonValue,
  path: JsonPath,
  changes: JsonChange[],
): void {
  if (areJsonValuesEqual(before, after)) return

  if (Array.isArray(before) && Array.isArray(after)) {
    if (isPureArrayReorder(before, after)) {
      changes.push({ kind: 'reordered', path, before, after })
      return
    }

    const sharedLength = Math.min(before.length, after.length)
    for (let index = 0; index < sharedLength; index += 1) {
      collectChanges(before[index] as JsonValue, after[index] as JsonValue, [...path, index], changes)
    }
    for (let index = sharedLength; index < before.length; index += 1) {
      changes.push({ kind: 'removed', path: [...path, index], before: before[index] as JsonValue })
    }
    for (let index = sharedLength; index < after.length; index += 1) {
      changes.push({ kind: 'added', path: [...path, index], after: after[index] as JsonValue })
    }
    return
  }

  if (isJsonObject(before) && isJsonObject(after)) {
    const beforeKeys = Object.keys(before)
    const afterKeys = Object.keys(after)

    for (const key of beforeKeys) {
      if (!Object.prototype.hasOwnProperty.call(after, key)) {
        changes.push({ kind: 'removed', path: [...path, key], before: before[key] as JsonValue })
      }
    }
    for (const key of afterKeys) {
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        changes.push({ kind: 'added', path: [...path, key], after: after[key] as JsonValue })
      } else {
        collectChanges(before[key] as JsonValue, after[key] as JsonValue, [...path, key], changes)
      }
    }
    return
  }

  changes.push({ kind: 'changed', path, before, after })
}

export function compareJsonValues(before: JsonValue, after: JsonValue): JsonChange[] {
  const changes: JsonChange[] = []
  collectChanges(before, after, [], changes)
  return changes
}

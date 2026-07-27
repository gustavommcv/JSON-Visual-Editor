import type { JsonPath, JsonPathSegment } from './types'

export function isJsonPath(value: unknown): value is JsonPath {
  return (
    Array.isArray(value) &&
    value.every(
      (segment: unknown) =>
        typeof segment === 'string' ||
        (typeof segment === 'number' && Number.isInteger(segment) && segment >= 0),
    )
  )
}

export function formatJsonPath(path: JsonPath): string {
  return path.reduce<string>((label, segment) => {
    if (typeof segment === 'number') return `${label}[${segment}]`
    return `${label}[${JSON.stringify(segment)}]`
  }, '$')
}

export function appendJsonPath(path: JsonPath, segment: JsonPathSegment): JsonPath {
  return [...path, segment]
}

export function areJsonPathsEqual(left: JsonPath, right: JsonPath): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

export function isJsonPathPrefix(prefix: JsonPath, path: JsonPath): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => segment === path[index])
}

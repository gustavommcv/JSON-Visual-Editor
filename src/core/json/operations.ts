import type { JsonObject, JsonPath, JsonRootKind, JsonValue } from './types'

export type JsonOperationErrorCode =
  | 'invalid-path'
  | 'invalid-container'
  | 'duplicate-key'
  | 'missing-key'
  | 'invalid-number'
  | 'cannot-remove-root'
  | 'invalid-index'
  | 'unsupported-order'

export interface JsonOperationError {
  code: JsonOperationErrorCode
  message: string
}

export type JsonOperationResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: JsonOperationError }

export type JsonAccessResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: JsonOperationError }

export type JsonEditorOperation =
  | { kind: 'set-value'; path: JsonPath; value: JsonValue }
  | { kind: 'replace-root'; value: JsonValue }
  | { kind: 'change-type'; path: JsonPath; valueType: JsonRootKind }
  | {
      kind: 'rename-property'
      objectPath: JsonPath
      previousKey: string
      nextKey: string
    }
  | { kind: 'add-property'; objectPath: JsonPath; key: string; valueType: JsonRootKind }
  | { kind: 'append-item'; arrayPath: JsonPath; valueType: JsonRootKind }
  | { kind: 'duplicate-array-item'; arrayPath: JsonPath; index: number }
  | { kind: 'duplicate-property'; objectPath: JsonPath; key: string }
  | { kind: 'move-array-item'; arrayPath: JsonPath; fromIndex: number; toIndex: number }
  | { kind: 'move-property'; objectPath: JsonPath; key: string; toIndex: number }
  | { kind: 'remove-value'; path: JsonPath }

function hasOwn(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isArrayIndexPropertyName(key: string): boolean {
  const number = Number(key)
  return (
    Number.isInteger(number) &&
    number >= 0 &&
    number < 4_294_967_295 &&
    String(number) === key
  )
}

export function canReorderJsonObject(object: JsonObject): boolean {
  return Object.keys(object).every((key) => !isArrayIndexPropertyName(key))
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]),
    ) as JsonObject
  }
  return value
}

function operationError(
  code: JsonOperationErrorCode,
  message: string,
): JsonOperationResult {
  return { ok: false, error: { code, message } }
}

function validateNumbers(value: JsonValue): JsonOperationError | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      return {
        code: 'invalid-number',
        message: "Use a finite number within JavaScript's safe range.",
      }
    }
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const error = validateNumbers(item)
      if (error) return error
    }
    return null
  }

  if (isJsonObject(value)) {
    for (const item of Object.values(value)) {
      const error = validateNumbers(item)
      if (error) return error
    }
  }

  return null
}

export function getJsonValueAtPath(root: JsonValue, path: JsonPath): JsonAccessResult {
  let current = root

  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return {
          ok: false,
          error: {
            code: 'invalid-path',
            message: `Index ${segment} does not exist at the given path.`,
          },
        }
      }
      const nextValue = current[segment]
      if (nextValue === undefined) {
        return {
          ok: false,
          error: { code: 'invalid-path', message: 'The given path does not exist.' },
        }
      }
      current = nextValue
      continue
    }

    if (!isJsonObject(current) || !hasOwn(current, segment)) {
      return {
        ok: false,
        error: {
          code: 'invalid-path',
          message: `Property “${segment}” does not exist at the given path.`,
        },
      }
    }
    const nextValue = current[segment]
    if (nextValue === undefined) {
      return {
        ok: false,
        error: { code: 'invalid-path', message: 'The given path does not exist.' },
      }
    }
    current = nextValue
  }

  return { ok: true, value: current }
}

function replaceAtPath(
  current: JsonValue,
  path: JsonPath,
  position: number,
  replacement: JsonValue,
): JsonOperationResult {
  if (position === path.length) return { ok: true, value: replacement }

  const segment = path[position]
  if (segment === undefined) return { ok: true, value: replacement }

  if (typeof segment === 'number') {
    if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
      return operationError('invalid-path', `Index ${segment} does not exist at the given path.`)
    }

    const child = current[segment]
    if (child === undefined) {
      return operationError('invalid-path', 'The given path does not exist.')
    }

    const childResult = replaceAtPath(child, path, position + 1, replacement)
    if (!childResult.ok) return childResult

    const copy = [...current]
    copy[segment] = childResult.value
    return { ok: true, value: copy }
  }

  if (!isJsonObject(current) || !hasOwn(current, segment)) {
    return operationError(
      'invalid-path',
      `Property “${segment}” does not exist at the given path.`,
    )
  }

  const child = current[segment]
  if (child === undefined) {
    return operationError('invalid-path', 'The given path does not exist.')
  }

  const childResult = replaceAtPath(child, path, position + 1, replacement)
  if (!childResult.ok) return childResult

  return { ok: true, value: { ...current, [segment]: childResult.value } }
}

export function replaceJsonRoot(_root: JsonValue, value: JsonValue): JsonOperationResult {
  const numberError = validateNumbers(value)
  if (numberError) return { ok: false, error: numberError }
  return { ok: true, value }
}

export function setJsonValue(
  root: JsonValue,
  path: JsonPath,
  value: JsonValue,
): JsonOperationResult {
  const numberError = validateNumbers(value)
  if (numberError) return { ok: false, error: numberError }
  return replaceAtPath(root, path, 0, value)
}

export function createJsonValue(valueType: JsonRootKind): JsonValue {
  const defaults: Record<JsonRootKind, JsonValue> = {
    object: {},
    array: [],
    string: '',
    number: 0,
    boolean: false,
    null: null,
  }
  return defaults[valueType]
}

export function changeJsonValueType(
  root: JsonValue,
  path: JsonPath,
  valueType: JsonRootKind,
): JsonOperationResult {
  return setJsonValue(root, path, createJsonValue(valueType))
}

export function renameJsonProperty(
  root: JsonValue,
  objectPath: JsonPath,
  previousKey: string,
  nextKey: string,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, objectPath)
  if (!access.ok) return access

  if (!isJsonObject(access.value)) {
    return operationError('invalid-container', 'Properties can only be renamed inside an object.')
  }

  if (!hasOwn(access.value, previousKey)) {
    return operationError('missing-key', `Property “${previousKey}” does not exist.`)
  }

  if (previousKey === nextKey) return { ok: true, value: root }

  if (hasOwn(access.value, nextKey)) {
    return operationError(
      'duplicate-key',
      `Property “${nextKey}” already exists. Choose another name.`,
    )
  }

  const renamed = Object.fromEntries(
    Object.entries(access.value).map(([key, value]) => [
      key === previousKey ? nextKey : key,
      value,
    ]),
  ) as JsonObject

  return setJsonValue(root, objectPath, renamed)
}

export function addJsonProperty(
  root: JsonValue,
  objectPath: JsonPath,
  key: string,
  valueType: JsonRootKind,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, objectPath)
  if (!access.ok) return access

  if (!isJsonObject(access.value)) {
    return operationError('invalid-container', 'Properties can only be added to objects.')
  }

  if (hasOwn(access.value, key)) {
    return operationError('duplicate-key', `Property “${key}” already exists.`)
  }

  return setJsonValue(root, objectPath, {
    ...access.value,
    [key]: createJsonValue(valueType),
  })
}

export function appendJsonArrayItem(
  root: JsonValue,
  arrayPath: JsonPath,
  valueType: JsonRootKind,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, arrayPath)
  if (!access.ok) return access

  if (!Array.isArray(access.value)) {
    return operationError('invalid-container', 'Items can only be added to arrays.')
  }

  return setJsonValue(root, arrayPath, [...access.value, createJsonValue(valueType)])
}

export function duplicateJsonArrayItem(
  root: JsonValue,
  arrayPath: JsonPath,
  index: number,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, arrayPath)
  if (!access.ok) return access

  if (!Array.isArray(access.value)) {
    return operationError('invalid-container', 'Items can only be duplicated in arrays.')
  }

  const item = access.value[index]
  if (!Number.isInteger(index) || index < 0 || item === undefined) {
    return operationError('invalid-index', `Item ${index + 1} does not exist.`)
  }

  const copy = [...access.value]
  copy.splice(index + 1, 0, cloneJsonValue(item))
  return setJsonValue(root, arrayPath, copy)
}

export function createUniquePropertyName(object: JsonObject, sourceKey: string): string {
  const baseName = `${sourceKey} (copy)`
  if (!hasOwn(object, baseName)) return baseName

  let suffix = 2
  while (hasOwn(object, `${baseName} ${suffix}`)) suffix += 1
  return `${baseName} ${suffix}`
}

export function duplicateJsonProperty(
  root: JsonValue,
  objectPath: JsonPath,
  key: string,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, objectPath)
  if (!access.ok) return access

  if (!isJsonObject(access.value)) {
    return operationError('invalid-container', 'Properties can only be duplicated in objects.')
  }

  const sourceValue = access.value[key]
  if (!hasOwn(access.value, key) || sourceValue === undefined) {
    return operationError('missing-key', `Property “${key}” does not exist.`)
  }

  const duplicateKey = createUniquePropertyName(access.value, key)
  const entries = Object.entries(access.value)
  const sourceIndex = entries.findIndex(([entryKey]) => entryKey === key)
  entries.splice(sourceIndex + 1, 0, [duplicateKey, cloneJsonValue(sourceValue)])

  return setJsonValue(root, objectPath, Object.fromEntries(entries) as JsonObject)
}

export function moveJsonArrayItem(
  root: JsonValue,
  arrayPath: JsonPath,
  fromIndex: number,
  toIndex: number,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, arrayPath)
  if (!access.ok) return access

  if (!Array.isArray(access.value)) {
    return operationError('invalid-container', 'Items can only be reordered in arrays.')
  }

  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= access.value.length ||
    toIndex >= access.value.length
  ) {
    return operationError('invalid-index', 'The given position does not exist in the array.')
  }

  if (fromIndex === toIndex) return { ok: true, value: root }

  const copy = [...access.value]
  const [item] = copy.splice(fromIndex, 1)
  if (item === undefined) {
    return operationError('invalid-index', 'The given item does not exist in the array.')
  }
  copy.splice(toIndex, 0, item)
  return setJsonValue(root, arrayPath, copy)
}

export function moveJsonProperty(
  root: JsonValue,
  objectPath: JsonPath,
  key: string,
  toIndex: number,
): JsonOperationResult {
  const access = getJsonValueAtPath(root, objectPath)
  if (!access.ok) return access

  if (!isJsonObject(access.value)) {
    return operationError('invalid-container', 'Properties can only be reordered in objects.')
  }

  if (!canReorderJsonObject(access.value)) {
    return operationError(
      'unsupported-order',
      'This object contains numeric keys whose display order is controlled by JavaScript.',
    )
  }

  const entries = Object.entries(access.value)
  const fromIndex = entries.findIndex(([entryKey]) => entryKey === key)
  if (fromIndex < 0) {
    return operationError('missing-key', `Property “${key}” does not exist.`)
  }

  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= entries.length) {
    return operationError('invalid-index', 'The given position does not exist in the object.')
  }

  if (fromIndex === toIndex) return { ok: true, value: root }

  const [entry] = entries.splice(fromIndex, 1)
  if (entry === undefined) {
    return operationError('missing-key', `Property “${key}” does not exist.`)
  }
  entries.splice(toIndex, 0, entry)
  return setJsonValue(root, objectPath, Object.fromEntries(entries) as JsonObject)
}

export function removeJsonValue(root: JsonValue, path: JsonPath): JsonOperationResult {
  if (path.length === 0) {
    return operationError(
      'cannot-remove-root',
      'The root cannot be removed. Change its type or value instead.',
    )
  }

  const parentPath = path.slice(0, -1)
  const segment = path[path.length - 1]
  const access = getJsonValueAtPath(root, parentPath)
  if (!access.ok) return access
  if (segment === undefined) {
    return operationError('invalid-path', 'The given path does not exist.')
  }

  if (typeof segment === 'number') {
    if (!Array.isArray(access.value) || segment < 0 || segment >= access.value.length) {
      return operationError('invalid-path', `Index ${segment} does not exist.`)
    }
    const copy = [...access.value]
    copy.splice(segment, 1)
    return setJsonValue(root, parentPath, copy)
  }

  if (!isJsonObject(access.value) || !hasOwn(access.value, segment)) {
    return operationError('invalid-path', `Property “${segment}” does not exist.`)
  }

  const copy: JsonObject = { ...access.value }
  delete copy[segment]
  return setJsonValue(root, parentPath, copy)
}

export function applyJsonOperation(
  root: JsonValue,
  operation: JsonEditorOperation,
): JsonOperationResult {
  switch (operation.kind) {
    case 'set-value':
      return setJsonValue(root, operation.path, operation.value)
    case 'replace-root':
      return replaceJsonRoot(root, operation.value)
    case 'change-type':
      return changeJsonValueType(root, operation.path, operation.valueType)
    case 'rename-property':
      return renameJsonProperty(
        root,
        operation.objectPath,
        operation.previousKey,
        operation.nextKey,
      )
    case 'add-property':
      return addJsonProperty(root, operation.objectPath, operation.key, operation.valueType)
    case 'append-item':
      return appendJsonArrayItem(root, operation.arrayPath, operation.valueType)
    case 'duplicate-array-item':
      return duplicateJsonArrayItem(root, operation.arrayPath, operation.index)
    case 'duplicate-property':
      return duplicateJsonProperty(root, operation.objectPath, operation.key)
    case 'move-array-item':
      return moveJsonArrayItem(
        root,
        operation.arrayPath,
        operation.fromIndex,
        operation.toIndex,
      )
    case 'move-property':
      return moveJsonProperty(root, operation.objectPath, operation.key, operation.toIndex)
    case 'remove-value':
      return removeJsonValue(root, operation.path)
  }
}

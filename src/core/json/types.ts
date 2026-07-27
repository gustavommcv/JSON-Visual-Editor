export type JsonPrimitive = string | number | boolean | null

export type JsonObject = { [key: string]: JsonValue }

export type JsonArray = JsonValue[]

export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export type JsonPathSegment = string | number

export type JsonPath = JsonPathSegment[]

export type JsonRootKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export interface LoadedJsonDocument {
  fileName: string
  original: JsonValue
  current: JsonValue
}

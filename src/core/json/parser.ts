import type { JsonValue } from './types'

export type JsonParseErrorCode =
  | 'empty-file'
  | 'invalid-json'
  | 'unsafe-integer'
  | 'unsupported-number'

export interface JsonParseError {
  code: JsonParseErrorCode
  message: string
}

export type JsonParseResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: JsonParseError }

const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/

function findNumberLiterals(source: string): string[] {
  const literals: string[] = []
  let index = 0
  let insideString = false
  let escaped = false

  while (index < source.length) {
    const character = source[index]

    if (insideString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        insideString = false
      }
      index += 1
      continue
    }

    if (character === '"') {
      insideString = true
      index += 1
      continue
    }

    if (character === '-' || (character !== undefined && /\d/.test(character))) {
      const match = source.slice(index).match(JSON_NUMBER)
      if (match?.[0]) {
        literals.push(match[0])
        index += match[0].length
        continue
      }
    }

    index += 1
  }

  return literals
}

function validateNumberLiterals(source: string): JsonParseError | null {
  for (const literal of findNumberLiterals(source)) {
    const value = Number(literal)

    if (!Number.isFinite(value)) {
      return {
        code: 'unsupported-number',
        message: `The number ${literal} is outside the range supported by this browser.`,
      }
    }

    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      return {
        code: 'unsafe-integer',
        message: `The integer ${literal} exceeds JavaScript's safe range and cannot be imported without risking a loss of precision.`,
      }
    }
  }

  return null
}

function invalidJsonMessage(error: unknown): string {
  if (!(error instanceof SyntaxError)) {
    return 'The selected file is not valid JSON.'
  }

  const detail = error.message.replace(/^JSON\.parse:\s*/i, '')
  return `The selected file is not valid JSON. ${detail}`
}

export function parseJson(source: string): JsonParseResult {
  if (source.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: 'empty-file',
        message: 'The file is empty. Choose a JSON file that contains data.',
      },
    }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(source)
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: 'invalid-json',
        message: invalidJsonMessage(error),
      },
    }
  }

  const numberError = validateNumberLiterals(source)
  if (numberError) {
    return { ok: false, error: numberError }
  }

  return { ok: true, value: parsed as JsonValue }
}

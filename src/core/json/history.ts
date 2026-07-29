import { cloneJsonValue } from './operations'
import type { JsonValue } from './types'

export const DEFAULT_HISTORY_LIMIT = 50
export const DEFAULT_TYPING_GROUP_WINDOW_MS = 750

export interface JsonHistoryGrouping {
  key: string
  lastChangeAt: number
}

export interface JsonHistoryState {
  past: JsonValue[]
  present: JsonValue
  future: JsonValue[]
  limit: number
  grouping: JsonHistoryGrouping | null
}

export interface JsonHistoryCommitOptions {
  groupKey?: string
  timestamp?: number
  groupWindowMs?: number
}

export function createJsonHistory(
  initialValue: JsonValue,
  limit = DEFAULT_HISTORY_LIMIT,
): JsonHistoryState {
  return {
    past: [],
    present: cloneJsonValue(initialValue),
    future: [],
    limit: Math.max(1, Math.floor(limit)),
    grouping: null,
  }
}

export function commitJsonHistory(
  state: JsonHistoryState,
  nextValue: JsonValue,
  options: JsonHistoryCommitOptions = {},
): JsonHistoryState {
  const timestamp = options.timestamp ?? Date.now()
  const groupWindowMs = options.groupWindowMs ?? DEFAULT_TYPING_GROUP_WINDOW_MS
  const groupKey = options.groupKey
  const continuesGroup =
    groupKey !== undefined &&
    state.grouping?.key === groupKey &&
    timestamp - state.grouping.lastChangeAt <= groupWindowMs

  const past = continuesGroup ? state.past : [...state.past, state.present].slice(-state.limit)

  return {
    ...state,
    past,
    // Editor operations are immutable, so retaining their snapshot keeps
    // unchanged branches shared across history entries. Besides avoiding a
    // full-document clone, this lets equality/diff computations stop at
    // unchanged subtrees instead of walking the whole document per edit.
    present: nextValue,
    future: [],
    grouping: groupKey ? { key: groupKey, lastChangeAt: timestamp } : null,
  }
}

export function undoJsonHistory(state: JsonHistoryState): JsonHistoryState {
  const previous = state.past[state.past.length - 1]
  if (previous === undefined) return state

  return {
    ...state,
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, state.limit),
    grouping: null,
  }
}

export function redoJsonHistory(state: JsonHistoryState): JsonHistoryState {
  const next = state.future[0]
  if (next === undefined) return state

  return {
    ...state,
    past: [...state.past, state.present].slice(-state.limit),
    present: next,
    future: state.future.slice(1),
    grouping: null,
  }
}

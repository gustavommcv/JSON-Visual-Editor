import { getPersistedSessionByteSize, type PersistedSession } from './sessionStorage'

const textEncoder = new TextEncoder()

/**
 * Fast worker-side size measurement for ordinary documents, with the same
 * iterative safety net used by storage for JSON deeper than JSON.stringify
 * can process without overflowing its call stack.
 */
export function measurePersistedSessionByteSize(record: PersistedSession): number {
  try {
    return textEncoder.encode(JSON.stringify(record)).byteLength
  } catch {
    return getPersistedSessionByteSize(record)
  }
}

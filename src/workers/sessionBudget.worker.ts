/// <reference lib="webworker" />

import { getPersistedSessionByteSize, type PersistedSession } from '@/core/json/sessionStorage'

export interface SessionBudgetWorkerRequest {
  requestId: number
  record: PersistedSession
}

export type SessionBudgetWorkerResponse =
  | { requestId: number; ok: true; byteSize: number }
  | { requestId: number; ok: false; message: string }

self.addEventListener('message', (event: MessageEvent<SessionBudgetWorkerRequest>) => {
  const { requestId, record } = event.data
  try {
    const response: SessionBudgetWorkerResponse = {
      requestId,
      ok: true,
      byteSize: getPersistedSessionByteSize(record),
    }
    self.postMessage(response)
  } catch (error) {
    const response: SessionBudgetWorkerResponse = {
      requestId,
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to measure the recovery snapshot.',
    }
    self.postMessage(response)
  }
})

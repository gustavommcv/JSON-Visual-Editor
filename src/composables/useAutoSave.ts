import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

import type { JsonFormatting } from '@/core/json/exporter'
import type { JsonHistoryState } from '@/core/json/history'
import {
  deserializeSession,
  getSessionPreview,
  serializeSession,
  type RestoredSession,
  type SessionPreview,
} from '@/core/json/sessionStorage'
import type { JsonValue, LoadedJsonDocument } from '@/core/json/types'

import type { RestoreSessionInput } from './useJsonDocument'

const DB_NAME = 'json-visual-editor'
const DB_VERSION = 1
const STORE_NAME = 'session'
const RECORD_KEY = 'current'

const SAVE_DEBOUNCE_MS = 1500
const BROADCAST_CHANNEL_NAME = 'json-visual-editor-session'
const TAB_HEARTBEAT_MS = 4000
const TAB_STALE_MS = 10_000

type SessionBroadcastMessage = { type: 'editing' | 'closing'; tabId: string }

function isSessionBroadcastMessage(data: unknown): data is SessionBroadcastMessage {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as { type?: unknown; tabId?: unknown }
  return (
    (candidate.type === 'editing' || candidate.type === 'closing') &&
    typeof candidate.tabId === 'string'
  )
}

function createTabId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to open the session database.'))
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open the session database.'))
    request.onblocked = () => reject(new Error('The session database is blocked by another tab.'))
  })
}

export interface UseAutoSaveParams {
  document: Ref<LoadedJsonDocument | null>
  history: Ref<JsonHistoryState | null>
  lastExported: Ref<JsonValue | undefined>
  restoreSession: (input: RestoreSessionInput) => void
  restoreOriginal: () => boolean
  downloadDocument: (formatting: JsonFormatting) => boolean
}

/**
 * Persists the in-progress editing session to IndexedDB so it can survive an
 * accidental tab close or crash, and offers to resume it on the next visit.
 * Every storage operation is best-effort: if IndexedDB is unavailable the
 * feature silently degrades to in-memory-only editing (no user-facing error),
 * and if a write fails later (e.g. quota exceeded) the user is warned once
 * and editing continues without further interruption.
 */
export function useAutoSave(params: UseAutoSaveParams) {
  const { document, history, lastExported } = params

  const pendingResume = ref<SessionPreview | null>(null)
  const otherTabEditing = ref(false)
  const storageWarning = ref(false)

  const tabId = createTabId()
  let dbPromise: Promise<IDBDatabase> | null = null
  let storageAvailable = true
  let restorableSession: RestoredSession | null = null
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let channel: BroadcastChannel | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  let staleCheckTimer: ReturnType<typeof setInterval> | undefined
  let lastOtherTabHeartbeatAt = 0

  function getDatabase(): Promise<IDBDatabase> {
    dbPromise ??= openDatabase()
    return dbPromise
  }

  async function readStoredRecord(): Promise<unknown> {
    const db = await getDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to read the saved session.'))
    })
  }

  async function writeStoredRecord(record: unknown): Promise<void> {
    const db = await getDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record, RECORD_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save the session.'))
      tx.onabort = () => reject(tx.error ?? new Error('Saving the session was aborted.'))
    })
  }

  async function deleteStoredRecord(): Promise<void> {
    const db = await getDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(RECORD_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Failed to clear the saved session.'))
      tx.onabort = () => reject(tx.error ?? new Error('Clearing the session was aborted.'))
    })
  }

  function cancelPendingSave(): void {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
  }

  function announceEditing(): void {
    channel?.postMessage({ type: 'editing', tabId } satisfies SessionBroadcastMessage)
  }

  async function saveNow(): Promise<void> {
    if (!storageAvailable || !document.value || !history.value) return

    const record = serializeSession({
      fileName: document.value.fileName,
      original: document.value.original,
      current: document.value.current,
      lastExported: lastExported.value,
      history: history.value,
    })

    try {
      await writeStoredRecord(record)
    } catch {
      // A write failure (e.g. quota exceeded) is treated as terminal for the
      // rest of the session: stop attempting further saves rather than
      // retrying and failing repeatedly, and surface exactly one warning.
      // Setting storageAvailable false makes this catch block unreachable
      // again, so this naturally only fires once.
      storageAvailable = false
      storageWarning.value = true
    }
  }

  function scheduleSave(): void {
    cancelPendingSave()
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void saveNow()
    }, SAVE_DEBOUNCE_MS)
  }

  async function clearStoredSession(): Promise<void> {
    cancelPendingSave()
    if (!storageAvailable) return
    try {
      await deleteStoredRecord()
    } catch {
      // If cleanup itself fails there is nothing actionable to do; the
      // stale record will simply be overwritten by the next successful save.
    }
  }

  // Set right before a change that intentionally clears storage (restoring
  // the original), so the watcher below — which the same change also
  // triggers — doesn't turn around and reschedule a save that undoes it.
  let suppressNextSchedule = false

  watch([document, history], () => {
    if (!document.value || !history.value) {
      cancelPendingSave()
      return
    }
    if (suppressNextSchedule) {
      suppressNextSchedule = false
      return
    }
    scheduleSave()
    announceEditing()
  })

  function handleChannelMessage(event: MessageEvent<unknown>): void {
    if (!isSessionBroadcastMessage(event.data) || event.data.tabId === tabId) return
    if (event.data.type === 'editing') {
      lastOtherTabHeartbeatAt = Date.now()
      otherTabEditing.value = true
    } else {
      otherTabEditing.value = false
    }
  }

  function checkOtherTabStaleness(): void {
    if (otherTabEditing.value && Date.now() - lastOtherTabHeartbeatAt > TAB_STALE_MS) {
      otherTabEditing.value = false
    }
  }

  function handleBeforeUnload(): void {
    if (saveTimer !== undefined) {
      cancelPendingSave()
      void saveNow()
    }
    channel?.postMessage({ type: 'closing', tabId } satisfies SessionBroadcastMessage)
  }

  onMounted(() => {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      channel.addEventListener('message', handleChannelMessage)
    } catch {
      channel = null
    }
    heartbeatTimer = setInterval(() => {
      if (document.value) announceEditing()
    }, TAB_HEARTBEAT_MS)
    staleCheckTimer = setInterval(checkOtherTabStaleness, TAB_HEARTBEAT_MS)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
    if (staleCheckTimer !== undefined) clearInterval(staleCheckTimer)
    cancelPendingSave()
    channel?.postMessage({ type: 'closing', tabId } satisfies SessionBroadcastMessage)
    channel?.close()
  })

  async function checkForExistingSession(): Promise<void> {
    try {
      const raw = await readStoredRecord()
      if (raw === undefined) return

      const result = deserializeSession(raw)
      if (!result.ok) {
        await clearStoredSession()
        return
      }

      restorableSession = result.value
      pendingResume.value = getSessionPreview(result.value)
    } catch {
      storageAvailable = false
    }
  }

  void checkForExistingSession()

  function resumeSession(): void {
    if (!restorableSession) return
    params.restoreSession({
      fileName: restorableSession.fileName,
      original: restorableSession.original,
      current: restorableSession.current,
      lastExported: restorableSession.lastExported,
      history: restorableSession.history,
    })
    restorableSession = null
    pendingResume.value = null
  }

  function discardSession(): void {
    restorableSession = null
    pendingResume.value = null
    void clearStoredSession()
  }

  function restoreOriginal(): boolean {
    suppressNextSchedule = true
    const restored = params.restoreOriginal()
    if (restored) {
      void clearStoredSession()
    } else {
      suppressNextSchedule = false
    }
    return restored
  }

  function downloadDocument(formatting: JsonFormatting): boolean {
    const succeeded = params.downloadDocument(formatting)
    if (succeeded) void clearStoredSession()
    return succeeded
  }

  return {
    pendingResume,
    otherTabEditing,
    storageWarning,
    resumeSession,
    discardSession,
    restoreOriginal,
    downloadDocument,
  }
}

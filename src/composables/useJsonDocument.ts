import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import { analyzeRoot } from '@/core/json/analyzer'
import { areJsonSnapshotsEqual, compareJsonValues } from '@/core/json/diff'
import { getEditedJsonDownloadName, getJsonExportError, type JsonFormatting } from '@/core/json/exporter'
import {
  commitJsonHistory,
  createJsonHistory,
  redoJsonHistory,
  undoJsonHistory,
  type JsonHistoryState,
} from '@/core/json/history'
import {
  applyJsonOperation,
  getJsonValueAtPath,
  type JsonEditorOperation,
} from '@/core/json/operations'
import { parseJson } from '@/core/json/parser'
import type { JsonValue, LoadedJsonDocument } from '@/core/json/types'
import { downloadJson } from '@/features/export/downloadJson'

export interface RestoreSessionInput {
  fileName: string
  original: JsonValue
  current: JsonValue
  lastExported: JsonValue | undefined
  history: JsonHistoryState
}

const JSON_FILE_EXTENSION = /\.json$/i

export function useJsonDocument() {
  const document = shallowRef<LoadedJsonDocument | null>(null)
  const errorMessage = ref<string | null>(null)
  const isImporting = ref(false)
  const operationError = ref<string | null>(null)
  const history = shallowRef<JsonHistoryState | null>(null)
  const lastExported = shallowRef<JsonValue>()
  /** Monotonic signal emitted once for each committed document edit. */
  const editVersion = ref(0)

  const rootSummary = computed(() =>
    document.value ? analyzeRoot(document.value.current) : null,
  )
  const changes = computed(() =>
    document.value ? compareJsonValues(document.value.original, document.value.current) : [],
  )
  const changeCount = computed(() => changes.value.length)
  const canUndo = computed(() => (history.value?.past.length ?? 0) > 0)
  const canRedo = computed(() => (history.value?.future.length ?? 0) > 0)
  const canRestore = computed(() =>
    document.value
      ? !areJsonSnapshotsEqual(document.value.current, document.value.original)
      : false,
  )
  const hasUnexportedChanges = computed(() => {
    if (!document.value || lastExported.value === undefined) return false
    return !areJsonSnapshotsEqual(document.value.current, lastExported.value)
  })
  const exportError = computed(() =>
    document.value ? getJsonExportError(document.value.current) : 'No document has been loaded.',
  )
  const canExport = computed(() => exportError.value === null)
  const suggestedFileName = computed(() =>
    document.value ? getEditedJsonDownloadName(document.value.fileName) : 'document-edited.json',
  )

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!hasUnexportedChanges.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))

  function syncCurrentFromHistory(): void {
    if (!document.value || !history.value) return
    document.value = { ...document.value, current: history.value.present }
    operationError.value = null
  }

  function markEditCommitted(): void {
    editVersion.value += 1
  }

  function getTypingGroupKey(operation: JsonEditorOperation, current: JsonValue): string | undefined {
    if (operation.kind !== 'set-value' || typeof operation.value !== 'string') return undefined
    const access = getJsonValueAtPath(current, operation.path)
    if (!access.ok || typeof access.value !== 'string') return undefined
    return `text:${JSON.stringify(operation.path)}`
  }

  async function importFile(file: File): Promise<boolean> {
    if (isImporting.value) return false

    errorMessage.value = null

    if (!JSON_FILE_EXTENSION.test(file.name)) {
      errorMessage.value = 'Choose a file with the .json extension.'
      return false
    }

    isImporting.value = true

    try {
      const source = await file.text()
      const result = parseJson(source)

      if (!result.ok) {
        errorMessage.value = result.error.message
        return false
      }

      const initialHistory = createJsonHistory(result.value)
      const initialSnapshot = initialHistory.present
      document.value = {
        fileName: file.name,
        original: initialSnapshot,
        current: initialSnapshot,
      }
      history.value = initialHistory
      lastExported.value = initialSnapshot
      operationError.value = null
      return true
    } catch {
      errorMessage.value = 'The file could not be read. Try choosing it again.'
      return false
    } finally {
      isImporting.value = false
    }
  }

  function clearDocument(): void {
    document.value = null
    errorMessage.value = null
    operationError.value = null
    history.value = null
    lastExported.value = undefined
  }

  function clearError(): void {
    errorMessage.value = null
  }

  function clearOperationError(): void {
    operationError.value = null
  }

  function applyEditorOperation(operation: JsonEditorOperation): boolean {
    if (!document.value) return false

    const current = document.value.current
    const result = applyJsonOperation(current, operation)
    if (!result.ok) {
      operationError.value = result.error.message
      return false
    }

    if (history.value && result.value !== current) {
      const groupKey = getTypingGroupKey(operation, current)
      history.value = commitJsonHistory(
        history.value,
        result.value,
        groupKey ? { groupKey } : {},
      )
      syncCurrentFromHistory()
      markEditCommitted()
    }
    operationError.value = null
    return true
  }

  function undoDocument(): void {
    if (!history.value || !canUndo.value) return
    history.value = undoJsonHistory(history.value)
    syncCurrentFromHistory()
    markEditCommitted()
  }

  function redoDocument(): void {
    if (!history.value || !canRedo.value) return
    history.value = redoJsonHistory(history.value)
    syncCurrentFromHistory()
    markEditCommitted()
  }

  function restoreOriginal(): boolean {
    if (!document.value || !history.value) return false
    if (!canRestore.value) return false
    history.value = commitJsonHistory(history.value, document.value.original)
    syncCurrentFromHistory()
    markEditCommitted()
    return true
  }

  function restoreSession(input: RestoreSessionInput): void {
    document.value = {
      fileName: input.fileName,
      original: input.original,
      current: input.current,
    }
    history.value = input.history
    lastExported.value = input.lastExported
    errorMessage.value = null
    operationError.value = null
  }

  function downloadDocument(formatting: JsonFormatting): boolean {
    if (!document.value) return false
    const result = downloadJson(document.value.current, document.value.fileName, formatting)
    if (!result.ok) {
      operationError.value = result.error
      return false
    }
    lastExported.value = document.value.current
    operationError.value = null
    return true
  }

  return {
    document,
    history,
    editVersion,
    lastExported,
    errorMessage,
    isImporting,
    operationError,
    rootSummary,
    changes,
    changeCount,
    canUndo,
    canRedo,
    canRestore,
    hasUnexportedChanges,
    canExport,
    exportError,
    suggestedFileName,
    importFile,
    clearDocument,
    clearError,
    clearOperationError,
    applyEditorOperation,
    undoDocument,
    redoDocument,
    restoreOriginal,
    restoreSession,
    downloadDocument,
  }
}

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { JsonRootSummary } from '@/core/json/analyzer'
import type { JsonChange } from '@/core/json/diff'
import type { JsonFormatting } from '@/core/json/exporter'
import type { JsonEditorOperation } from '@/core/json/operations'
import { isJsonPath } from '@/core/json/path'
import type { JsonSearchResult } from '@/core/json/search'
import type { JsonPath, JsonValue } from '@/core/json/types'
import JsonComparisonPanel from '@/features/comparison/JsonComparisonPanel.vue'
import JsonExportPanel from '@/features/export/JsonExportPanel.vue'
import ImportedDocument from '@/features/import/ImportedDocument.vue'
import JsonSearchPanel from '@/features/search/JsonSearchPanel.vue'
import ConfirmAction from './ConfirmAction.vue'
import JsonValueEditor from './JsonValueEditor.vue'
import PathBreadcrumb from './PathBreadcrumb.vue'
import { useSearchHighlight } from './useSearchHighlight'

const props = defineProps<{
  fileName: string
  summary: JsonRootSummary
  value: JsonValue
  operationError: string | null
  changes: JsonChange[]
  changeCount: number
  canUndo: boolean
  canRedo: boolean
  canRestore: boolean
  hasUnexportedChanges: boolean
  canExport: boolean
  exportError: string | null
  suggestedFileName: string
}>()

const emit = defineEmits<{
  remove: []
  download: [formatting: JsonFormatting]
  operation: [operation: JsonEditorOperation]
  clearError: []
  undo: []
  redo: []
  restore: []
}>()

const activePath = ref<JsonPath>([])
const comparisonOpen = ref(false)
const exportOpen = ref(false)
const restoreConfirmationOpen = ref(false)

const {
  highlightedSearchResultPath,
  selectSearchResult,
  handleFocusInteraction,
  handlePointerInteraction,
  clearHighlight,
} = useSearchHighlight()

function pathFromEventTarget(target: EventTarget | null): JsonPath | null {
  if (!(target instanceof Element)) return null

  const editor = target.closest<HTMLElement>('[data-json-path]')
  const serializedPath = editor?.dataset.jsonPath
  if (!serializedPath) return null

  try {
    const parsed: unknown = JSON.parse(serializedPath)
    return isJsonPath(parsed) ? parsed : null
  } catch {
    return null
  }
}

function handleWorkspaceFocus(event: FocusEvent): void {
  const path = pathFromEventTarget(event.target)
  if (!path) return
  activePath.value = path
  handleFocusInteraction()
}

async function navigateToPath(path: JsonPath): Promise<void> {
  activePath.value = [...path]
  await selectSearchResult(path)
}

function navigateToResult(result: JsonSearchResult): Promise<void> {
  return navigateToPath(result.path)
}

function navigateToChange(change: JsonChange): void {
  comparisonOpen.value = false
  const targetPath = change.kind === 'removed' ? change.path.slice(0, -1) : change.path
  void navigateToPath(targetPath)
}

function confirmRestore(): void {
  restoreConfirmationOpen.value = false
  emit('restore')
  activePath.value = []
  clearHighlight()
}

function requestDownload(formatting: JsonFormatting): void {
  if (!props.canExport) return
  emit('download', formatting)
  exportOpen.value = false
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)
  )
}

function handleHistoryShortcut(event: KeyboardEvent): void {
  if (isTextEditingTarget(event.target) || event.altKey || (!event.ctrlKey && !event.metaKey)) return

  const key = event.key.toLowerCase()
  const requestsRedo = key === 'y' || (key === 'z' && event.shiftKey)
  const requestsUndo = key === 'z' && !event.shiftKey

  if (requestsUndo && props.canUndo) {
    event.preventDefault()
    emit('undo')
  } else if (requestsRedo && props.canRedo) {
    event.preventDefault()
    emit('redo')
  }
}

onMounted(() => window.addEventListener('keydown', handleHistoryShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleHistoryShortcut))
</script>

<template>
  <ImportedDocument
    :file-name="fileName"
    :summary="summary"
    :has-unexported-changes="hasUnexportedChanges"
    @remove="emit('remove')"
    @download="exportOpen = true"
  >
    <div class="editor-shell">
      <div class="history-toolbar" aria-label="History and comparison">
        <div class="history-toolbar__group">
          <button
            class="button button--quiet"
            type="button"
            :disabled="!canUndo"
            title="Undo (Ctrl/Cmd + Z)"
            @click="emit('undo')"
          >
            ↶ Undo
          </button>
          <button
            class="button button--quiet"
            type="button"
            :disabled="!canRedo"
            title="Redo (Ctrl + Y or Cmd + Shift + Z)"
            @click="emit('redo')"
          >
            ↷ Redo
          </button>
          <button
            class="button button--quiet"
            type="button"
            :disabled="!canRestore"
            @click="restoreConfirmationOpen = true"
          >
            Restore original
          </button>
        </div>
        <div class="history-toolbar__group">
          <button class="button button--quiet" type="button" @click="comparisonOpen = true">
            Compare changes <span class="button-count">{{ changeCount }}</span>
          </button>
          <button class="button button--primary" type="button" @click="exportOpen = true">
            Download JSON
          </button>
        </div>
      </div>

      <div class="editor-shell__toolbar">
        <PathBreadcrumb :path="activePath" />
        <span
          class="autosave-note"
          :class="{ 'autosave-note--dirty': hasUnexportedChanges }"
          role="status"
        >
          <span aria-hidden="true">●</span>
          {{ hasUnexportedChanges ? 'Unexported changes' : 'Current version exported' }}
        </span>
      </div>

      <JsonSearchPanel :value="value" @navigate="navigateToResult" />

      <div v-if="operationError" class="editor-error" role="alert">
        <span>{{ operationError }}</span>
        <button type="button" aria-label="Close error" @click="emit('clearError')">×</button>
      </div>

      <div
        class="editor-workspace"
        @focusin="handleWorkspaceFocus"
        @pointerdown.capture="handlePointerInteraction"
      >
        <JsonValueEditor
          :value="value"
          :path="[]"
          :depth="0"
          :highlighted-path="highlightedSearchResultPath"
          :image-previews="true"
          @operation="emit('operation', $event)"
        />
      </div>
    </div>

    <JsonComparisonPanel
      v-if="comparisonOpen"
      :changes="changes"
      @close="comparisonOpen = false"
      @navigate="navigateToChange"
    />

    <JsonExportPanel
      v-if="exportOpen"
      :file-name="suggestedFileName"
      :change-count="changeCount"
      :can-export="canExport"
      :export-error="exportError"
      @close="exportOpen = false"
      @download="requestDownload"
    />

    <ConfirmAction
      v-if="restoreConfirmationOpen"
      title="Restore the original document?"
      description="The imported document will replace the current version. You can still undo this action from the history."
      confirm-label="Restore original"
      :path="[]"
      @cancel="restoreConfirmationOpen = false"
      @confirm="confirmRestore"
    />
  </ImportedDocument>
</template>

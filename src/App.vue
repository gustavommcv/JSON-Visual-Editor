<script setup lang="ts">
import JsonDocumentEditor from '@/features/editor/JsonDocumentEditor.vue'
import JsonDropzone from '@/features/import/JsonDropzone.vue'
import { useJsonDocument } from '@/composables/useJsonDocument'

const {
  document,
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
  downloadDocument,
} = useJsonDocument()
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#main-content" aria-label="JSON Visual Editor — skip to content">
        <span class="brand__mark" aria-hidden="true">{ }</span>
        <span>JSON <strong>Visual Editor</strong></span>
      </a>
      <span class="local-pill"><span aria-hidden="true"></span> 100% in your browser</span>
    </header>

    <main id="main-content" class="main-content">
      <section v-if="!document" class="hero" aria-labelledby="page-title">
        <div class="hero__copy">
          <p class="eyebrow">Your JSON, without the syntax</p>
          <h1 id="page-title">Understand your data.<br /><em>Visually.</em></h1>
          <p class="hero__intro">
            Open any JSON file and edit your data in a simpler, clearer, and safer way — no coding
            knowledge required.
          </p>

          <div class="privacy-note">
            <span class="privacy-note__icon" aria-hidden="true">⌁</span>
            <div>
              <strong>Your data stays with you</strong>
              <p>Your file stays in your browser and is never sent to a server.</p>
            </div>
          </div>
        </div>

        <div class="hero__upload">
          <JsonDropzone :busy="isImporting" @file-selected="importFile" />
          <div v-if="errorMessage" class="error-message" role="alert" tabindex="-1">
            <div>
              <strong>Could not import the file</strong>
              <p>{{ errorMessage }}</p>
            </div>
            <button type="button" aria-label="Close error message" @click="clearError">×</button>
          </div>
        </div>
      </section>

      <section v-else class="document-view" aria-labelledby="loaded-title">
        <div class="document-view__heading">
          <p class="eyebrow">Visual editor</p>
          <h1 id="loaded-title">Edit the structure, not the syntax.</h1>
          <p>Each field below represents a real value in your JSON document.</p>
        </div>

        <JsonDocumentEditor
          v-if="rootSummary"
          :file-name="document.fileName"
          :summary="rootSummary"
          :value="document.current"
          :operation-error="operationError"
          :changes="changes"
          :change-count="changeCount"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :can-restore="canRestore"
          :has-unexported-changes="hasUnexportedChanges"
          :can-export="canExport"
          :export-error="exportError"
          :suggested-file-name="suggestedFileName"
          @remove="clearDocument"
          @download="downloadDocument"
          @operation="applyEditorOperation"
          @clear-error="clearOperationError"
          @undo="undoDocument"
          @redo="redoDocument"
          @restore="restoreOriginal"
        />
      </section>
    </main>

    <footer class="site-footer">
      <p>Built to make structured data easier to understand.</p>
      <p>No upload · No account · No tracking</p>
    </footer>
  </div>
</template>

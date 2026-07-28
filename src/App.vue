<script setup lang="ts">
import JsonDocumentEditor from '@/features/editor/JsonDocumentEditor.vue'
import JsonDropzone from '@/features/import/JsonDropzone.vue'
import { useJsonDocument } from '@/composables/useJsonDocument'
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme } = useTheme()

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
      <div class="site-header__start">
        <a class="brand" href="#main-content" aria-label="JSON Visual Editor — skip to content">
          <span class="brand__mark" aria-hidden="true">{ }</span>
          <span>JSON <strong>Visual Editor</strong></span>
        </a>
        <button
          v-if="document"
          class="theme-toggle"
          type="button"
          :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          :aria-pressed="theme === 'dark'"
          @click="toggleTheme"
        >
          <svg
            v-if="theme === 'dark'"
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
          </svg>
          <svg
            v-else
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            />
          </svg>
        </button>
      </div>
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
            <span class="privacy-note__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
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

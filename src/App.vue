<script setup lang="ts">
import { computed } from 'vue'

import AutoSaveIndicator from '@/components/AutoSaveIndicator.vue'
import JsonMark from '@/components/JsonMark.vue'
import JsonDocumentEditor from '@/features/editor/JsonDocumentEditor.vue'
import JsonDropzone from '@/features/import/JsonDropzone.vue'
import ResumeSessionPrompt from '@/features/import/ResumeSessionPrompt.vue'
import { useAutoSave, type AutoSaveFailureKind } from '@/composables/useAutoSave'
import { useJsonDocument } from '@/composables/useJsonDocument'
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme } = useTheme()

const {
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
  restoreOriginal: restoreOriginalDocument,
  restoreSession,
  downloadDocument: downloadDocumentFile,
} = useJsonDocument()

const {
  recoverableSessions,
  quarantinedSessions,
  otherTabEditing,
  sessionConflict,
  autoSaveStatus,
  isSavePending,
  isSaving,
  lastSaveSucceeded,
  lastSaveFailed,
  hasSessionSaved,
  resumeSession,
  discardSession,
  discardQuarantinedSession,
  dismissRecoverablePrompt,
  restoreOriginal,
  downloadDocument,
} = useAutoSave({
  document,
  history,
  editVersion,
  lastExported,
  restoreSession,
  restoreOriginal: restoreOriginalDocument,
  downloadDocument: downloadDocumentFile,
})

const AUTO_SAVE_STATUS_MESSAGE: Record<AutoSaveFailureKind, string> = {
  unavailable: "Auto-save isn't available in this browser session. Your edits stay in this tab until you export them.",
  blocked: 'Auto-save is temporarily blocked, possibly by this document being open in another tab. Your edits are safe for now.',
  'quota-exceeded': "Your browser's storage is full, so auto-save is paused for this session. Export your work soon so you don't lose it.",
  'read-failure': "Auto-save couldn't check for a previous session, but you can keep working normally.",
  'write-failure': "Auto-save couldn't save your latest changes. It will keep trying as you continue editing.",
  'too-large': 'This document is too large to auto-save in this browser. Export your work to be safe.',
  transient: 'Auto-save hit a temporary problem. It will keep trying as you continue editing.',
}

const autoSaveFailureMessage = computed(() => {
  if (sessionConflict.value) {
    return 'A newer version of this session was saved from another tab, so auto-save is paused here.'
  }
  return autoSaveStatus.value
    ? AUTO_SAVE_STATUS_MESSAGE[autoSaveStatus.value.kind]
    : 'Your latest changes could not be saved locally. Try exporting the document.'
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--with-auto-save': document && hasUnexportedChanges }">
    <ResumeSessionPrompt
      v-if="recoverableSessions.length > 0 || quarantinedSessions.length > 0"
      :recoverable-sessions="recoverableSessions"
      :quarantined-sessions="quarantinedSessions"
      @resume="resumeSession"
      @discard="discardSession"
      @discard-quarantined="discardQuarantinedSession"
      @dismiss="dismissRecoverablePrompt"
    />

    <header class="site-header">
      <div class="site-header__start">
        <a class="brand" href="#main-content" aria-label="JSON Visual Editor — skip to content">
          <JsonMark class="brand__mark" />
          <span>JSON <strong>Visual Editor</strong></span>
        </a>
        <button
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
      <div class="site-header__end">
        <span class="local-pill"><span aria-hidden="true"></span> 100% in your browser</span>
        <a
          class="github-link"
          href="https://github.com/gustavommcv/JSON-Visual-Editor"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub (opens in a new tab)"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
        </a>
      </div>
    </header>

    <main id="main-content" class="main-content">
      <div v-if="otherTabEditing || sessionConflict || autoSaveStatus" class="session-notices">
        <p v-if="sessionConflict" class="session-notice" role="status">
          This session was also saved from another tab with a newer version. To avoid overwriting
          their changes, auto-save is paused here — your edits in this tab are still safe until you
          close or reload it.
        </p>
        <p v-else-if="otherTabEditing" class="session-notice" role="status">
          This document may be open in another tab. Changes are not merged; if both tabs try to
          save the same revision, auto-save pauses in the tab that loses the conflict.
        </p>
        <p v-if="autoSaveStatus" class="session-notice" role="status">
          {{ AUTO_SAVE_STATUS_MESSAGE[autoSaveStatus.kind] }}
        </p>
      </div>

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

    <AutoSaveIndicator
      v-if="document && hasUnexportedChanges"
      :is-pending="isSavePending"
      :is-saving="isSaving"
      :last-save-succeeded="lastSaveSucceeded"
      :last-save-failed="lastSaveFailed || sessionConflict"
      :has-session-saved="hasSessionSaved"
      :failure-message="autoSaveFailureMessage"
    />

    <footer class="site-footer">
      <p>Built to make structured data easier to understand.</p>
      <div class="site-footer__end">
        <p>No upload · No account · No tracking</p>
        <p>
          Open source ·
          <a href="https://github.com/gustavommcv/JSON-Visual-Editor" target="_blank" rel="noopener noreferrer"
            >View on GitHub</a
          >
          ·
          <a
            href="https://github.com/gustavommcv/JSON-Visual-Editor/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            >GPL-3.0</a
          >
        </p>
      </div>
    </footer>
  </div>
</template>

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
      <a class="brand" href="#main-content" aria-label="JSON Visual Editor — ir ao conteúdo">
        <span class="brand__mark" aria-hidden="true">{ }</span>
        <span>JSON <strong>Visual Editor</strong></span>
      </a>
      <span class="local-pill"><span aria-hidden="true"></span> 100% no navegador</span>
    </header>

    <main id="main-content" class="main-content">
      <section v-if="!document" class="hero" aria-labelledby="page-title">
        <div class="hero__copy">
          <p class="eyebrow">Seu JSON, sem a sintaxe</p>
          <h1 id="page-title">Entenda seus dados.<br /><em>Visualmente.</em></h1>
          <p class="hero__intro">
            Abra qualquer arquivo JSON e prepare seus dados para uma edição mais simples, clara e
            segura — sem precisar conhecer código.
          </p>

          <div class="privacy-note">
            <span class="privacy-note__icon" aria-hidden="true">⌁</span>
            <div>
              <strong>Seus dados ficam com você</strong>
              <p>O arquivo é processado neste navegador e nunca é enviado para um servidor.</p>
            </div>
          </div>
        </div>

        <div class="hero__upload">
          <JsonDropzone :busy="isImporting" @file-selected="importFile" />
          <div v-if="errorMessage" class="error-message" role="alert" tabindex="-1">
            <div>
              <strong>Não foi possível importar</strong>
              <p>{{ errorMessage }}</p>
            </div>
            <button type="button" aria-label="Fechar mensagem de erro" @click="clearError">×</button>
          </div>
        </div>
      </section>

      <section v-else class="document-view" aria-labelledby="loaded-title">
        <div class="document-view__heading">
          <p class="eyebrow">Editor visual</p>
          <h1 id="loaded-title">Edite a estrutura, não a sintaxe.</h1>
          <p>Cada campo abaixo representa um valor real do seu documento JSON.</p>
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
      <p>Feito para tornar dados estruturados mais humanos.</p>
      <p>Sem upload · Sem conta · Sem rastreamento</p>
    </footer>
  </div>
</template>

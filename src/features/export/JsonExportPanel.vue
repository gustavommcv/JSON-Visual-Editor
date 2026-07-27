<script setup lang="ts">
import { ref, useId } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import type { JsonFormatting } from '@/core/json/exporter'

defineProps<{
  fileName: string
  changeCount: number
  canExport: boolean
  exportError: string | null
}>()

const emit = defineEmits<{
  close: []
  download: [formatting: JsonFormatting]
}>()

const titleId = useId()
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
const formatting = ref<JsonFormatting>('formatted')
const { trapFocus } = useDialogFocus(dialog, closeButton)
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <section
        ref="dialog"
        class="export-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <header>
          <div>
            <p class="eyebrow">Download local</p>
            <h2 :id="titleId">Exportar JSON</h2>
          </div>
          <button
            ref="closeButton"
            class="icon-button"
            type="button"
            aria-label="Fechar exportação"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <dl class="export-summary">
          <div>
            <dt>Arquivo sugerido</dt>
            <dd><code>{{ fileName }}</code></dd>
          </div>
          <div>
            <dt>Comparação com o original</dt>
            <dd>{{ changeCount }} {{ changeCount === 1 ? 'mudança' : 'mudanças' }}</dd>
          </div>
        </dl>

        <fieldset class="format-options">
          <legend>Formato do arquivo</legend>
          <label>
            <input v-model="formatting" type="radio" value="formatted" />
            <span><strong>Formatado</strong><small>Recuo de dois espaços, fácil de ler.</small></span>
          </label>
          <label>
            <input v-model="formatting" type="radio" value="compact" />
            <span><strong>Compacto</strong><small>Sem espaços extras, arquivo menor.</small></span>
          </label>
        </fieldset>

        <p v-if="exportError" class="export-blocked" role="alert">{{ exportError }}</p>
        <p class="export-privacy">O arquivo contém somente o JSON atual. O documento e o histórico permanecem nesta aba após o download.</p>

        <div class="export-dialog__actions">
          <button class="button button--quiet" type="button" @click="emit('close')">Cancelar</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="!canExport"
            @click="emit('download', formatting)"
          >
            Baixar JSON
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

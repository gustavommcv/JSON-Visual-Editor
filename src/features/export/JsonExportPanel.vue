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
            <p class="eyebrow">Local download</p>
            <h2 :id="titleId">Download JSON</h2>
          </div>
          <button
            ref="closeButton"
            class="icon-button"
            type="button"
            aria-label="Close download dialog"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <dl class="export-summary">
          <div>
            <dt>Suggested file name</dt>
            <dd><code>{{ fileName }}</code></dd>
          </div>
          <div>
            <dt>Changes from the original</dt>
            <dd>{{ changeCount }} {{ changeCount === 1 ? 'change' : 'changes' }}</dd>
          </div>
        </dl>

        <fieldset class="format-options">
          <legend>File format</legend>
          <label>
            <input v-model="formatting" type="radio" value="formatted" />
            <span><strong>Formatted</strong><small>Two-space indentation for easy reading.</small></span>
          </label>
          <label>
            <input v-model="formatting" type="radio" value="compact" />
            <span><strong>Compact</strong><small>No extra spaces for a smaller file.</small></span>
          </label>
        </fieldset>

        <p v-if="exportError" class="export-blocked" role="alert">{{ exportError }}</p>
        <p class="export-privacy">The file contains only the current JSON. Your document and history stay in this tab after the download.</p>

        <div class="export-dialog__actions">
          <button class="button button--quiet" type="button" @click="emit('close')">Cancel</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="!canExport"
            @click="emit('download', formatting)"
          >
            Download JSON
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

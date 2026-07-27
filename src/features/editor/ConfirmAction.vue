<script setup lang="ts">
import { ref, useId } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import { formatJsonPath } from '@/core/json/path'
import type { JsonPath } from '@/core/json/types'

defineProps<{
  title: string
  description: string
  path: JsonPath
  confirmLabel: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const titleId = useId()
const cancelButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
const { trapFocus } = useDialogFocus(dialog, cancelButton)
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
      <section
        ref="dialog"
        class="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <span class="confirmation-dialog__mark" aria-hidden="true">!</span>
        <div>
          <h2 :id="titleId">{{ title }}</h2>
          <p>{{ description }}</p>
          <div class="affected-path">
            <span>Affected path</span>
            <code>{{ formatJsonPath(path) }}</code>
          </div>
        </div>
        <div class="confirmation-dialog__actions">
          <button ref="cancelButton" class="button button--quiet" type="button" @click="emit('cancel')">
            Cancel
          </button>
          <button class="button button--danger" type="button" @click="emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

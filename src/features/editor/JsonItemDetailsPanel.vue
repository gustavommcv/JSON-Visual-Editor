<script setup lang="ts">
import { ref, useId } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import { formatJsonPath } from '@/core/json/path'
import type { JsonPath } from '@/core/json/types'

defineProps<{
  itemNumber: number
  path: JsonPath
}>()

const emit = defineEmits<{
  close: []
}>()

const titleId = useId()
const closeButton = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { trapFocus } = useDialogFocus(panel, closeButton)
</script>

<template>
  <Teleport to="body">
    <div class="details-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <aside
        ref="panel"
        class="details-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <header class="details-panel__header">
          <div>
            <p>Detalhes do item</p>
            <h2 :id="titleId">Item {{ itemNumber }}</h2>
            <code>{{ formatJsonPath(path) }}</code>
          </div>
          <button
            ref="closeButton"
            class="icon-button details-panel__close"
            type="button"
            aria-label="Fechar painel de detalhes"
            @click="emit('close')"
          >
            ×
          </button>
        </header>
        <div class="details-panel__body">
          <slot></slot>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

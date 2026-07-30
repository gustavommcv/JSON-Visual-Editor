<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import { formatJsonPath } from '@/core/json/path'
import type { JsonPath } from '@/core/json/types'

const props = defineProps<{
  itemNumber: number
  path: JsonPath
  inspectionTitle?: string | null
  inspectionPath?: JsonPath | null
}>()

const emit = defineEmits<{
  back: []
  close: []
}>()

const titleId = useId()
const closeButton = ref<HTMLButtonElement | null>(null)
const backButton = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { trapFocus } = useDialogFocus(panel, closeButton)

watch(
  () => props.inspectionTitle,
  (inspectionTitle) => {
    if (inspectionTitle) void nextTick(() => backButton.value?.focus())
  },
)

function dismissCurrentView(): void {
  if (props.inspectionTitle) emit('back')
  else emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="details-backdrop" @click.self="dismissCurrentView" @keydown.esc.stop="dismissCurrentView">
      <aside
        ref="panel"
        class="details-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <header class="details-panel__header">
          <div v-if="inspectionTitle">
            <button
              ref="backButton"
              class="mini-button details-panel__back"
              type="button"
              @click="emit('back')"
            >← Back to item details</button>
            <p>Contextual inspector</p>
            <h2 :id="titleId">{{ inspectionTitle }}</h2>
            <code>{{ formatJsonPath(inspectionPath ?? path) }}</code>
          </div>
          <div v-else>
            <p>Item details</p>
            <h2 :id="titleId">Item {{ itemNumber }}</h2>
            <code>{{ formatJsonPath(path) }}</code>
          </div>
          <button
            ref="closeButton"
            class="icon-button details-panel__close"
            type="button"
            :aria-label="inspectionTitle ? 'Close inspector' : 'Close item details'"
            @click="dismissCurrentView"
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

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isPending: boolean
  isSaving: boolean
  lastSaveSucceeded: boolean
  lastSaveFailed: boolean
  hasSessionSaved: boolean
  failureMessage: string
}>()

const state = computed(() => {
  if (props.lastSaveFailed) return 'failed'
  if (props.isSaving) return 'saving'
  if (props.lastSaveSucceeded) return 'saved'
  if (props.isPending) return 'pending'
  if (props.hasSessionSaved) return 'local'
  return 'ready'
})

const stateLabel = computed(() => {
  switch (state.value) {
    case 'failed': return 'Not saved'
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'pending': return 'Auto-save pending'
    case 'local': return 'Auto-saved locally'
    default: return 'Auto-save ready'
  }
})
</script>

<template>
  <aside class="auto-save-indicator" aria-label="Document save status">
    <span class="auto-save-indicator__dirty">
      <span aria-hidden="true">●</span>
      Unexported changes
    </span>
    <span class="auto-save-indicator__divider" aria-hidden="true"></span>

    <span
      v-if="state === 'failed'"
      class="auto-save-indicator__state auto-save-indicator__state--failed"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-describedby="auto-save-failure-tooltip"
      tabindex="0"
    >
      <span class="auto-save-indicator__icon" aria-hidden="true">!</span>
      {{ stateLabel }}
      <span id="auto-save-failure-tooltip" class="auto-save-indicator__tooltip" role="tooltip">
        {{ failureMessage }}
      </span>
    </span>

    <Transition v-else name="save-state" mode="out-in">
      <span
        :key="state"
        class="auto-save-indicator__state"
        :class="`auto-save-indicator__state--${state}`"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span v-if="state === 'saving'" class="auto-save-indicator__spinner" aria-hidden="true"></span>
        <span v-else class="auto-save-indicator__icon" aria-hidden="true">
          {{ state === 'saved' || state === 'local' ? '✓' : '·' }}
        </span>
        {{ stateLabel }}
      </span>
    </Transition>
  </aside>
</template>

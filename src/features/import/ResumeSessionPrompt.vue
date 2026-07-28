<script setup lang="ts">
import { ref, useId } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import type { SessionPreview } from '@/core/json/sessionStorage'

defineProps<{
  preview: SessionPreview
}>()

const emit = defineEmits<{
  resume: []
  discard: []
}>()

const titleId = useId()
const resumeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
// Resume is the safe, non-destructive default — matches ConfirmAction.vue's
// convention of focusing whichever action doesn't lose data.
const { trapFocus } = useDialogFocus(dialog, resumeButton)

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
]

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatRelativeTime(savedAt: number): string {
  const diffMs = savedAt - Date.now()
  if (Math.abs(diffMs) < 45_000) return 'just now'

  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffMs) >= ms) return relativeTimeFormatter.format(Math.round(diffMs / ms), unit)
  }
  return relativeTimeFormatter.format(Math.round(diffMs / 60_000), 'minute')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`
}
</script>

<template>
  <Teleport to="body">
    <!-- Deliberately no backdrop-click / Escape dismissal: unlike
         ConfirmAction.vue, the two choices here aren't safe-vs-destructive
         in the same way, so we require an explicit Resume or Discard. -->
    <div class="modal-backdrop">
      <section
        ref="dialog"
        class="resume-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <span class="resume-dialog__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </span>
        <div>
          <h2 :id="titleId">Resume previous session?</h2>
          <p>
            You have edits from a previous visit that were saved automatically in this browser.
            Resume to keep working on them, or discard to start fresh.
          </p>
          <dl class="resume-dialog__details">
            <div>
              <dt>File</dt>
              <dd>{{ preview.fileName }}</dd>
            </div>
            <div>
              <dt>Last saved</dt>
              <dd>{{ formatRelativeTime(preview.savedAt) }}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{{ formatSize(preview.approxSizeBytes) }}</dd>
            </div>
          </dl>
        </div>
        <div class="resume-dialog__actions">
          <button class="button button--quiet" type="button" @click="emit('discard')">Discard</button>
          <button
            ref="resumeButton"
            class="button button--primary"
            type="button"
            @click="emit('resume')"
          >
            Resume
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type ComponentPublicInstance } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import type { QuarantinedSessionInfo, SessionPreview } from '@/core/json/sessionStorage'

const props = defineProps<{
  recoverableSessions: SessionPreview[]
  quarantinedSessions: QuarantinedSessionInfo[]
}>()

const emit = defineEmits<{
  resume: [sessionId: string]
  discard: [sessionId: string]
  discardQuarantined: [sessionId: string]
  dismiss: []
}>()

const titleId = useId()
const dialog = ref<HTMLElement | null>(null)
const firstResumeButton = ref<HTMLButtonElement | null>(null)
function setFirstResumeButtonRef(index: number, el: Element | ComponentPublicInstance | null): void {
  if (index === 0) firstResumeButton.value = el as HTMLButtonElement | null
}
// Resume is the safe, non-destructive default — matches ConfirmAction.vue's
// convention of focusing whichever action doesn't lose data. Falls back to
// the dialog's own focusable content when there's nothing to resume (only
// quarantined sessions), since useDialogFocus already handles a null target.
const { trapFocus } = useDialogFocus(dialog, firstResumeButton)

const hasRecoverable = computed(() => props.recoverableSessions.length > 0)
const hasQuarantined = computed(() => props.quarantinedSessions.length > 0)

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

function recoverableActionLabel(action: 'Resume' | 'Discard', session: SessionPreview, index: number): string {
  return `${action} saved session ${index + 1} of ${props.recoverableSessions.length} for ${session.fileName}, saved ${formatRelativeTime(session.savedAt)}`
}

function quarantinedActionLabel(session: QuarantinedSessionInfo, index: number): string {
  const saved = session.savedAt === null ? 'at an unknown time' : `saved ${formatRelativeTime(session.savedAt)}`
  return `Discard incompatible saved session ${index + 1} of ${props.quarantinedSessions.length} for ${session.fileName ?? 'an unknown file'}, ${saved}`
}

watch(
  () => [
    ...props.recoverableSessions.map((session) => session.sessionId),
    ...props.quarantinedSessions.map((session) => session.sessionId),
  ],
  async () => {
    await nextTick()
    const container = dialog.value
    if (!container || container.contains(document.activeElement)) return
    firstResumeButton.value?.focus()
    if (!container.contains(document.activeElement)) {
      container.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <!-- Deliberately no backdrop-click / Escape dismissal: unlike
         ConfirmAction.vue, the choices here aren't safe-vs-destructive in
         the same way, so each session needs an explicit Resume or Discard.
         "Not now" below leaves storage untouched and closes the dialog. -->
    <div class="modal-backdrop">
      <section
        ref="dialog"
        class="resume-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <div class="resume-dialog__heading">
          <span class="resume-dialog__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </span>
          <div>
            <h2 :id="titleId">{{ hasRecoverable ? 'Resume a previous session?' : 'Saved sessions found' }}</h2>
            <p v-if="hasRecoverable">
              Edits from a previous visit were saved automatically in this browser. Resume one to
              keep working on it, or discard it to start fresh.
            </p>
          </div>
        </div>

        <ul v-if="hasRecoverable" class="resume-session-list" aria-label="Recoverable sessions">
          <li v-for="(session, index) in recoverableSessions" :key="session.sessionId" class="resume-session-item">
            <dl class="resume-session-item__details">
              <div>
                <dt>File</dt>
                <dd>{{ session.fileName }}</dd>
              </div>
              <div>
                <dt>Last saved</dt>
                <dd>{{ formatRelativeTime(session.savedAt) }}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{{ formatSize(session.approxSizeBytes) }}</dd>
              </div>
            </dl>
            <div class="resume-session-item__actions">
              <button
                class="button button--quiet"
                type="button"
                :aria-label="recoverableActionLabel('Discard', session, index)"
                @click="emit('discard', session.sessionId)"
              >
                Discard
              </button>
              <button
                :ref="(el) => setFirstResumeButtonRef(index, el)"
                class="button button--primary"
                type="button"
                :aria-label="recoverableActionLabel('Resume', session, index)"
                @click="emit('resume', session.sessionId)"
              >
                Resume
              </button>
            </div>
          </li>
        </ul>

        <div v-if="hasQuarantined" class="resume-dialog__quarantine">
          <p class="resume-dialog__quarantine-note">
            {{
              hasRecoverable
                ? 'These sessions were saved by a newer version of the app and can’t be opened here.'
                : 'One or more sessions were saved by a newer version of this app and can’t be opened here. You can discard them.'
            }}
          </p>
          <ul class="resume-session-list resume-session-list--quarantine" aria-label="Sessions from a newer app version">
            <li v-for="(session, index) in quarantinedSessions" :key="session.sessionId" class="resume-session-item">
              <dl class="resume-session-item__details">
                <div>
                  <dt>File</dt>
                  <dd>{{ session.fileName ?? 'Unknown file' }}</dd>
                </div>
                <div v-if="session.savedAt !== null">
                  <dt>Last saved</dt>
                  <dd>{{ formatRelativeTime(session.savedAt) }}</dd>
                </div>
              </dl>
              <div class="resume-session-item__actions">
                <button
                  class="button button--quiet"
                  type="button"
                  :aria-label="quarantinedActionLabel(session, index)"
                  @click="emit('discardQuarantined', session.sessionId)"
                >
                  Discard
                </button>
              </div>
            </li>
          </ul>
        </div>

        <div class="resume-dialog__actions">
          <button class="button button--quiet" type="button" @click="emit('dismiss')">Not now</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

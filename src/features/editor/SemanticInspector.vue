<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { formatJsonPath } from '@/core/json/path'
import type { JsonSemanticValue } from '@/core/json/semantic'
import type { JsonPath, JsonPrimitive } from '@/core/json/types'

const props = defineProps<{
  semantic: JsonSemanticValue
  rawValue: JsonPrimitive
  path: JsonPath
}>()

const emit = defineEmits<{ close: [] }>()
const mediaRequested = ref(false)
const mediaFailed = ref(false)
const copyState = ref<string | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const inspector = ref<HTMLElement | null>(null)
const isCompactViewport = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null
let compactViewportQuery: MediaQueryList | null = null

const pathLabel = computed(() => formatJsonPath(props.path))
const rawText = computed(() => props.rawValue === null ? 'null' : String(props.rawValue))
const rawType = computed(() => props.rawValue === null ? 'null' : typeof props.rawValue)
const embeddedPreview = computed(() =>
  props.semantic.embeddedValue === undefined
    ? null
    : JSON.stringify(props.semantic.embeddedValue, null, 2),
)
const shouldShowMedia = computed(() =>
  props.semantic.mediaKind === 'data' || mediaRequested.value,
)

watch(
  () => props.path,
  () => {
    mediaRequested.value = false
    mediaFailed.value = false
  },
  { deep: true },
)

async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copyState.value = `${label} copied`
  } catch {
    copyState.value = 'Copy was blocked by the browser'
  }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copyState.value = null }, 2_000)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !isCompactViewport.value || !inspector.value) return

  const focusable = [...inspector.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.offsetParent !== null)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function updateCompactViewport(event: MediaQueryListEvent | MediaQueryList): void {
  isCompactViewport.value = event.matches
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  compactViewportQuery = window.matchMedia('(max-width: 880px)')
  updateCompactViewport(compactViewportQuery)
  compactViewportQuery.addEventListener('change', updateCompactViewport)
  void nextTick(() => closeButton.value?.focus())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  compactViewportQuery?.removeEventListener('change', updateCompactViewport)
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<template>
  <div class="inspector-backdrop" aria-hidden="true" @click="emit('close')"></div>
  <aside
    ref="inspector"
    class="semantic-inspector"
    :role="isCompactViewport ? 'dialog' : 'complementary'"
    :aria-modal="isCompactViewport ? 'true' : undefined"
    aria-labelledby="semantic-inspector-title"
  >
    <header class="semantic-inspector__header">
      <div>
        <p class="eyebrow">Contextual inspector</p>
        <h2 id="semantic-inspector-title">{{ semantic.label }}</h2>
      </div>
      <button ref="closeButton" class="icon-button" type="button" aria-label="Close inspector" @click="emit('close')">×</button>
    </header>

    <div class="semantic-inspector__body">
      <section class="inspector-section inspector-section--summary">
        <span class="type-badge">{{ rawType }}</span>
        <strong>{{ semantic.summary }}</strong>
        <code :title="pathLabel">{{ pathLabel }}</code>
      </section>

      <section
        v-if="semantic.kind === 'color'"
        class="color-preview"
        :style="{ backgroundColor: String(rawValue) }"
        aria-label="Color preview"
      ></section>

      <section v-if="semantic.mediaSource" class="media-preview" aria-label="Media preview">
        <template v-if="shouldShowMedia && !mediaFailed">
          <img
            v-if="semantic.kind === 'image' || semantic.kind === 'animated-image'"
            :src="semantic.mediaSource"
            alt="Preview of the media represented by this JSON value"
            decoding="async"
            referrerpolicy="no-referrer"
            @error="mediaFailed = true"
          />
          <video
            v-else-if="semantic.kind === 'video'"
            :src="semantic.mediaSource"
            controls
            preload="metadata"
            referrerpolicy="no-referrer"
            @error="mediaFailed = true"
          >Video preview is not supported by this browser.</video>
        </template>
        <div v-else-if="mediaFailed" class="media-preview__message" role="status">
          <strong>Preview unavailable</strong>
          <p>The value is unchanged. The remote host may block previews or the media may be unavailable.</p>
          <button class="mini-button" type="button" @click="mediaFailed = false">Try again</button>
        </div>
        <div v-else class="media-preview__message">
          <strong>Remote preview is paused</strong>
          <p>Loading it will contact {{ semantic.details.find((detail) => detail.label === 'Host')?.value ?? 'the remote host' }} directly.</p>
          <button class="mini-button mini-button--primary" type="button" @click="mediaRequested = true">Load preview</button>
        </div>
      </section>

      <section v-if="embeddedPreview" class="inspector-section">
        <div class="inspector-section__heading">
          <h3>Parsed preview</h3>
          <button class="mini-button" type="button" @click="copy(embeddedPreview, 'Formatted JSON')">Copy</button>
        </div>
        <pre>{{ embeddedPreview }}</pre>
      </section>

      <section v-if="semantic.kind === 'long-text'" class="inspector-section">
        <h3>Readable text</h3>
        <p class="long-text-preview">{{ rawText }}</p>
      </section>

      <section class="inspector-section">
        <h3>Properties</h3>
        <dl class="inspector-details">
          <div v-for="detail in semantic.details" :key="detail.label">
            <dt>{{ detail.label }}</dt>
            <dd>{{ detail.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="inspector-section">
        <div class="inspector-section__heading">
          <h3>Raw value</h3>
          <button class="mini-button" type="button" @click="copy(rawText, 'Value')">Copy</button>
        </div>
        <pre class="raw-value-preview">{{ rawText }}</pre>
      </section>

      <div class="semantic-inspector__actions">
        <a
          v-if="semantic.safeHref"
          class="button button--primary"
          :href="semantic.safeHref"
          target="_blank"
          rel="noopener noreferrer"
          referrerpolicy="no-referrer"
        >{{ semantic.kind === 'email' ? 'Compose email' : 'Open safely' }} ↗</a>
      </div>
      <p v-if="copyState" class="copy-status" role="status">{{ copyState }}</p>
    </div>
  </aside>
</template>

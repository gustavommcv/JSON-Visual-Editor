<script setup lang="ts">
import { computed } from 'vue'

import { detectJsonSemanticValue, type JsonSemanticValue } from '@/core/json/semantic'
import type { JsonPath, JsonPrimitive } from '@/core/json/types'
import type { SemanticInspectionRequest } from './contextualSurface'

const props = withDefaults(
  defineProps<{
    value: JsonPrimitive
    path: JsonPath
    compact?: boolean
  }>(),
  { compact: false },
)

const emit = defineEmits<{
  inspect: [request: SemanticInspectionRequest]
}>()

const semantic = computed(() => detectJsonSemanticValue(props.value))
const icons: Record<JsonSemanticValue['kind'], string> = {
  date: '◷',
  'date-time': '◷',
  timestamp: '◷',
  url: '↗',
  image: '▧',
  'animated-image': '▧',
  video: '▶',
  color: '●',
  email: '@',
  uuid: '#',
  'long-text': '¶',
  'embedded-json': '{ }',
  'git-url': '⌘',
}

function inspect(event: MouseEvent): void {
  if (!semantic.value || !(event.currentTarget instanceof HTMLElement)) return
  emit('inspect', {
    semantic: semantic.value,
    rawValue: props.value,
    path: [...props.path],
    trigger: event.currentTarget,
  })
}
</script>

<template>
  <button
    v-if="semantic"
    class="semantic-badge"
    :class="{ 'semantic-badge--compact': compact, 'semantic-badge--color': semantic.kind === 'color' }"
    type="button"
    :title="`Inspect ${semantic.label.toLocaleLowerCase()}`"
    :aria-label="`Inspect ${semantic.label.toLocaleLowerCase()} at this path: ${semantic.summary}`"
    @click="inspect"
  >
    <span
      class="semantic-badge__icon"
      :style="semantic.kind === 'color' ? { color: String(value) } : undefined"
      aria-hidden="true"
    >{{ icons[semantic.kind] }}</span>
    <span>{{ semantic.label }}</span>
    <small v-if="!compact">{{ semantic.summary }}</small>
  </button>
</template>

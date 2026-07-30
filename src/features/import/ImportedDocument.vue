<script setup lang="ts">
import JsonMark from '@/components/JsonMark.vue'
import type { JsonRootSummary } from '@/core/json/analyzer'

defineProps<{
  fileName: string
  summary: JsonRootSummary
  hasUnexportedChanges: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <section class="document-card document-card--editor" aria-labelledby="document-title">
    <header class="document-toolbar">
      <JsonMark class="file-mark" />
      <div class="document-card__name">
        <p class="eyebrow">Imported document</p>
        <h2 id="document-title">{{ fileName }}</h2>
        <p>{{ summary.label }} · {{ summary.detail }} · Local only</p>
      </div>
      <div class="document-toolbar__actions">
        <span class="status-badge" :class="{ 'status-badge--dirty': hasUnexportedChanges }">
          <span aria-hidden="true">{{ hasUnexportedChanges ? '•' : '✓' }}</span>
          {{ hasUnexportedChanges ? 'Unexported changes' : 'File ready' }}
        </span>
        <button class="button button--quiet" type="button" @click="emit('remove')">Remove file</button>
      </div>
    </header>

    <slot></slot>

  </section>
</template>

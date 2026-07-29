<script setup lang="ts">
import type { JsonRootSummary } from '@/core/json/analyzer'

defineProps<{
  fileName: string
  summary: JsonRootSummary
  hasUnexportedChanges: boolean
}>()

const emit = defineEmits<{
  remove: []
  download: []
}>()
</script>

<template>
  <section class="document-card document-card--editor" aria-labelledby="document-title">
    <div class="document-card__topline">
      <span class="status-badge" :class="{ 'status-badge--dirty': hasUnexportedChanges }">
        <span aria-hidden="true">{{ hasUnexportedChanges ? '•' : '✓' }}</span>
        {{ hasUnexportedChanges ? 'Unexported changes' : 'File ready' }}
      </span>
      <button class="button button--quiet" type="button" @click="emit('remove')">
        Remove file
      </button>
    </div>

    <div class="document-card__identity">
      <div class="file-mark" aria-hidden="true">{ }</div>
      <div class="document-card__name">
        <p class="eyebrow">Imported document</p>
        <h2 id="document-title">{{ fileName }}</h2>
      </div>
    </div>

    <dl class="summary-grid">
      <div>
        <dt>Detected root</dt>
        <dd>{{ summary.label }}</dd>
      </div>
      <div>
        <dt>Contents</dt>
        <dd>{{ summary.detail }}</dd>
      </div>
      <div>
        <dt>Processing</dt>
        <dd>Local only</dd>
      </div>
    </dl>

    <div class="stage-note">
      <span class="stage-note__number">05</span>
      <div>
        <strong>Recursive editor ready</strong>
        <p>Edit values and structures below. Your edits stay in this browser and are saved locally as you go.</p>
      </div>
    </div>

    <slot></slot>

    <div class="document-card__actions">
      <button class="button button--primary" type="button" @click="emit('download')">
        Download JSON
      </button>
      <p>The download includes your current changes and preserves JSON types.</p>
    </div>
  </section>
</template>

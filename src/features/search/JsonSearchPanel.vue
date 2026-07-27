<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { searchJson, type JsonSearchResult } from '@/core/json/search'
import type { JsonValue } from '@/core/json/types'

const props = defineProps<{
  value: JsonValue
}>()

const emit = defineEmits<{
  navigate: [result: JsonSearchResult]
}>()

const query = ref('')
const debouncedQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const results = computed(() => searchJson(props.value, debouncedQuery.value))
const hasQuery = computed(() => query.value.trim().length > 0)
const isPending = computed(
  () => hasQuery.value && query.value.trim() !== debouncedQuery.value.trim(),
)

watch(query, (nextQuery) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = nextQuery
  }, 180)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function clearSearch(): void {
  query.value = ''
  debouncedQuery.value = ''
  if (debounceTimer) clearTimeout(debounceTimer)
}

function matchLabel(match: JsonSearchResult['matches'][number]): string {
  const labels = { key: 'Property', value: 'Value', path: 'Path' }
  return labels[match]
}
</script>

<template>
<section class="json-search" aria-label="Search the document" @keydown.esc="clearSearch">
  <div class="json-search__field">
    <span aria-hidden="true">⌕</span>
    <label>
      <span class="visually-hidden">Search properties, values, or paths</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search property, value, or path…"
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <span v-if="isPending" class="json-search__pending" role="status">Searching…</span>
    <button
      v-else-if="hasQuery"
      class="icon-button"
      type="button"
      aria-label="Clear search"
      @click="clearSearch"
    >×</button>
  </div>

  <div v-if="hasQuery && !isPending" class="search-results" aria-live="polite">
    <div class="search-results__summary">
      <strong>{{ results.length }} {{ results.length === 1 ? 'result' : 'results' }}</strong>
      <span>Local search that does not change your data</span>
    </div>

    <ol v-if="results.length > 0">
      <li v-for="(result, index) in results" :key="`${result.pathLabel}-${index}`">
        <button type="button" @click="emit('navigate', result)">
          <span class="search-result__topline">
            <code>{{ result.pathLabel }}</code>
            <span class="search-result__matches">
              <small v-for="match in result.matches" :key="match">{{ matchLabel(match) }}</small>
            </span>
          </span>
          <span class="search-result__preview">{{ result.preview }}</span>
        </button>
      </li>
    </ol>

    <div v-else class="search-empty">
      <span aria-hidden="true">⌕</span>
      <strong>No results found</strong>
      <p>Try another property name, value, or part of a path.</p>
    </div>
  </div>
</section>
</template>

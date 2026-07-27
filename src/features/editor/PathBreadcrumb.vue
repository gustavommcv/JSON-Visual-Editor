<script setup lang="ts">
import { computed } from 'vue'

import { formatJsonPath } from '@/core/json/path'
import type { JsonPath } from '@/core/json/types'

const props = defineProps<{
  path: JsonPath
}>()

const fullPath = computed(() => formatJsonPath(props.path))
</script>

<template>
  <nav class="path-breadcrumb" aria-label="Current path" :title="fullPath">
    <span class="path-breadcrumb__label">Path</span>
    <ol>
      <li><span>$</span></li>
      <li v-for="(segment, index) in path" :key="index">
        <span aria-hidden="true">›</span>
        <code>{{ typeof segment === 'number' ? `[${segment}]` : segment }}</code>
      </li>
    </ol>
  </nav>
</template>

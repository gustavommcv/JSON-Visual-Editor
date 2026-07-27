<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { detectImageCandidate, getImagePreviewState } from '@/core/json/image'

const props = defineProps<{
  value: string
}>()

const hasFailed = ref(false)
const candidate = computed(() => detectImageCandidate(props.value))
const previewState = computed(() => getImagePreviewState(props.value, hasFailed.value))

watch(
  () => props.value,
  () => {
    hasFailed.value = false
  },
)
</script>

<template>
  <figure v-if="candidate" class="image-preview">
    <div class="image-preview__frame">
      <img
        v-if="previewState === 'ready'"
        :src="candidate.source"
        alt="Preview of the image in this field"
        loading="lazy"
        decoding="async"
        :referrerpolicy="candidate.referrerPolicy ?? undefined"
        @error="hasFailed = true"
      />
      <div v-else class="image-preview__fallback" role="status">
        <span aria-hidden="true">×</span>
        <strong>The image could not be loaded</strong>
        <p>The value is unchanged and can still be edited.</p>
      </div>
    </div>
    <figcaption>
      <div>
        <span class="type-badge">Possible image</span>
        <p v-if="candidate.kind === 'remote'">
          The preview requests this image directly from its server without sending your JSON.
        </p>
        <p v-else>The preview only uses the data embedded in this value.</p>
      </div>
      <a
        :href="candidate.source"
        target="_blank"
        rel="noopener noreferrer"
        :referrerpolicy="candidate.referrerPolicy ?? undefined"
      >Open image safely</a>
    </figcaption>
  </figure>
</template>

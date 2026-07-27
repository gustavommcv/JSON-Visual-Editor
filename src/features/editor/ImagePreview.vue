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
        alt="Pré-visualização do valor deste campo"
        loading="lazy"
        decoding="async"
        :referrerpolicy="candidate.referrerPolicy ?? undefined"
        @error="hasFailed = true"
      />
      <div v-else class="image-preview__fallback" role="status">
        <span aria-hidden="true">×</span>
        <strong>Não foi possível carregar a imagem</strong>
        <p>O valor permanece inalterado e pode continuar sendo editado.</p>
      </div>
    </div>
    <figcaption>
      <div>
        <span class="type-badge">Imagem possível</span>
        <p v-if="candidate.kind === 'remote'">
          A prévia faz uma requisição direta ao servidor desta imagem, sem enviar o JSON.
        </p>
        <p v-else>A prévia usa somente o conteúdo incorporado neste valor.</p>
      </div>
      <a
        :href="candidate.source"
        target="_blank"
        rel="noopener noreferrer"
        :referrerpolicy="candidate.referrerPolicy ?? undefined"
      >Abrir imagem com segurança</a>
    </figcaption>
  </figure>
</template>

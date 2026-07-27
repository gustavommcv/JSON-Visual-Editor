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
        {{ hasUnexportedChanges ? 'Alterações não exportadas' : 'Arquivo pronto' }}
      </span>
      <button class="button button--quiet" type="button" @click="emit('remove')">
        Remover arquivo
      </button>
    </div>

    <div class="document-card__identity">
      <div class="file-mark" aria-hidden="true">{ }</div>
      <div class="document-card__name">
        <p class="eyebrow">Documento importado</p>
        <h2 id="document-title">{{ fileName }}</h2>
      </div>
    </div>

    <dl class="summary-grid">
      <div>
        <dt>Raiz detectada</dt>
        <dd>{{ summary.label }}</dd>
      </div>
      <div>
        <dt>Conteúdo</dt>
        <dd>{{ summary.detail }}</dd>
      </div>
      <div>
        <dt>Processamento</dt>
        <dd>Somente local</dd>
      </div>
    </dl>

    <div class="stage-note">
      <span class="stage-note__number">05</span>
      <div>
        <strong>Editor recursivo ativo</strong>
        <p>Edite valores e estruturas abaixo. Tudo continua somente nesta aba.</p>
      </div>
    </div>

    <slot></slot>

    <div class="document-card__actions">
      <button class="button button--primary" type="button" @click="emit('download')">
        Configurar download
      </button>
      <p>O download inclui as alterações atuais e preserva os tipos JSON.</p>
    </div>
  </section>
</template>

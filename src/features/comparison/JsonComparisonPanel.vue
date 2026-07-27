<script setup lang="ts">
import { ref, useId } from 'vue'

import { useDialogFocus } from '@/composables/useDialogFocus'
import type { JsonChange, JsonChangeKind } from '@/core/json/diff'
import { serializeJson } from '@/core/json/exporter'
import { formatJsonPath } from '@/core/json/path'
import type { JsonValue } from '@/core/json/types'

defineProps<{
  changes: JsonChange[]
}>()

const emit = defineEmits<{
  close: []
  navigate: [change: JsonChange]
}>()

const titleId = useId()
const closeButton = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { trapFocus } = useDialogFocus(panel, closeButton)
const labels: Record<JsonChangeKind, string> = {
  added: 'Adicionado',
  removed: 'Removido',
  changed: 'Alterado',
  reordered: 'Reordenado',
}

function preview(value: JsonValue): string {
  const serialized = serializeJson(value, 'compact')
  return serialized.length > 600 ? `${serialized.slice(0, 597)}…` : serialized
}

function beforeValue(change: JsonChange): JsonValue | undefined {
  return change.kind === 'added' ? undefined : change.before
}

function afterValue(change: JsonChange): JsonValue | undefined {
  return change.kind === 'removed' ? undefined : change.after
}

</script>

<template>
  <Teleport to="body">
    <div class="details-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <section
        ref="panel"
        class="details-panel comparison-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.tab="trapFocus"
      >
        <header class="details-panel__header">
          <div>
            <p>Original × atual</p>
            <h2 :id="titleId">Comparação estrutural</h2>
            <code>{{ changes.length }} {{ changes.length === 1 ? 'mudança' : 'mudanças' }}</code>
          </div>
          <button
            ref="closeButton"
            class="details-panel__close icon-button"
            type="button"
            aria-label="Fechar comparação"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="details-panel__body">
          <div v-if="changes.length === 0" class="comparison-empty" role="status">
            <span aria-hidden="true">✓</span>
            <strong>Nenhuma diferença estrutural</strong>
            <p>O documento atual é semanticamente igual ao original.</p>
          </div>

          <ol v-else class="change-list">
            <li v-for="(change, index) in changes" :key="`${change.kind}-${formatJsonPath(change.path)}-${index}`">
              <div class="change-list__heading">
                <span class="change-kind" :class="`change-kind--${change.kind}`">
                  {{ labels[change.kind] }}
                </span>
                <code>{{ formatJsonPath(change.path) }}</code>
              </div>

              <div class="change-values">
                <div>
                  <span>Antes</span>
                  <pre v-if="beforeValue(change) !== undefined">{{ preview(beforeValue(change) as JsonValue) }}</pre>
                  <em v-else>Não existia</em>
                </div>
                <div>
                  <span>Agora</span>
                  <pre v-if="afterValue(change) !== undefined">{{ preview(afterValue(change) as JsonValue) }}</pre>
                  <em v-else>Não existe</em>
                </div>
              </div>

              <button class="button button--quiet" type="button" @click="emit('navigate', change)">
                Ir para o editor
              </button>
            </li>
          </ol>
        </div>
      </section>
    </div>
  </Teleport>
</template>

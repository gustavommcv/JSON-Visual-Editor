<script setup lang="ts">
import { computed } from 'vue'

import { summarizeNestedJsonValue } from '@/core/json/analyzer'
import type { JsonEditorOperation } from '@/core/json/operations'
import type { JsonPath, JsonPrimitive, JsonRootKind, JsonValue } from '@/core/json/types'
import JsonPrimitiveEditor from './JsonPrimitiveEditor.vue'
import type { SemanticInspectionRequest } from './contextualSurface'

const props = defineProps<{
  value: JsonValue
  path: JsonPath
  label: string
  highlighted: boolean
}>()

const emit = defineEmits<{
  operation: [operation: JsonEditorOperation]
  openDetails: []
  inspectSemantic: [request: SemanticInspectionRequest]
}>()

const nestedSummary = computed(() => summarizeNestedJsonValue(props.value))
const pathData = computed(() => JSON.stringify(props.path))
const primitiveValue = computed(
  () => props.value as Exclude<JsonPrimitive, null>,
)

function setValue(value: string | number | boolean): void {
  emit('operation', { kind: 'set-value', path: props.path, value })
}

function changeType(valueType: JsonRootKind): void {
  emit('operation', { kind: 'change-type', path: props.path, valueType })
}

function onNullTypeChange(event: Event): void {
  changeType((event.target as HTMLSelectElement).value as JsonRootKind)
}
</script>

<template>
  <div
    class="json-table-cell"
    :class="{ 'is-search-highlight': highlighted }"
    :data-json-path="pathData"
    tabindex="-1"
  >
    <button
      v-if="nestedSummary"
      class="nested-cell-summary"
      type="button"
      :aria-label="`${label}: ${nestedSummary}. Open item details`"
      @click="emit('openDetails')"
    >
      <span aria-hidden="true">{{ Array.isArray(value) ? '[ ]' : '{ }' }}</span>
      <strong>{{ nestedSummary }}</strong>
      <small>Open item</small>
    </button>

    <div v-else-if="value === null" class="table-null-cell">
      <code>null</code>
      <label>
        <span class="visually-hidden">Change the type of {{ label }}</span>
        <select value="null" @change="onNullTypeChange">
          <option value="null">Null</option>
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
        </select>
      </label>
    </div>

    <JsonPrimitiveEditor
      v-else
      :value="primitiveValue"
      :label="label"
      :path="path"
      compact
      @set-value="setValue"
      @change-type="changeType"
      @inspect-semantic="emit('inspectSemantic', $event)"
    />
  </div>
</template>

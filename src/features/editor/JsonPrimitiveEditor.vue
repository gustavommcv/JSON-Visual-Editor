<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { JsonPath, JsonPrimitive, JsonRootKind } from '@/core/json/types'
import SemanticBadge, { type SemanticInspectionRequest } from './SemanticBadge.vue'

const props = withDefaults(
  defineProps<{
    value: Exclude<JsonPrimitive, null>
    label: string
    path: JsonPath
    compact?: boolean
  }>(),
  { compact: false },
)

const emit = defineEmits<{
  setValue: [value: Exclude<JsonPrimitive, null>]
  changeType: [valueType: JsonRootKind]
  inspectSemantic: [request: SemanticInspectionRequest]
}>()

const numberError = ref<string | null>(null)

watch(
  () => props.value,
  () => {
    numberError.value = null
  },
)
const valueType = computed<'string' | 'number' | 'boolean'>(
  () => typeof props.value as 'string' | 'number' | 'boolean',
)

function onStringInput(event: Event): void {
  emit('setValue', (event.target as HTMLTextAreaElement).value)
}

function onNumberChange(event: Event): void {
  const rawValue = (event.target as HTMLInputElement).value
  const number = Number(rawValue)

  if (
    rawValue.trim() === '' ||
    !Number.isFinite(number) ||
    (Number.isInteger(number) && !Number.isSafeInteger(number))
  ) {
    numberError.value = 'Enter a valid number within the safe range.'
    return
  }

  numberError.value = null
  emit('setValue', number)
}

function onBooleanChange(event: Event): void {
  emit('setValue', (event.target as HTMLInputElement).checked)
}

function onTypeChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  emit('changeType', select.value as JsonRootKind)
  select.value = valueType.value
}
</script>

<template>
  <div class="primitive-editor" :class="`primitive-editor--${valueType}`">
    <label v-if="valueType === 'string'" class="primitive-editor__field">
      <span class="visually-hidden">{{ label }}</span>
      <textarea
        :value="value as string"
        :rows="(value as string).length > 80 || (value as string).includes('\n') ? 4 : 1"
        @input="onStringInput"
      ></textarea>
    </label>

    <label v-else-if="valueType === 'number'" class="primitive-editor__field">
      <span class="visually-hidden">{{ label }}</span>
      <input type="number" step="any" :value="value" @change="onNumberChange" />
      <span v-if="numberError" class="field-error" role="alert">{{ numberError }}</span>
    </label>

    <label v-else class="boolean-control">
      <input
        type="checkbox"
        role="switch"
        :checked="value as boolean"
        :aria-checked="value as boolean"
        @change="onBooleanChange"
      />
      <span class="boolean-control__track" aria-hidden="true"><span></span></span>
      <span>{{ value ? 'True' : 'False' }}</span>
    </label>

    <label class="type-control">
      <span>Type</span>
      <select :value="valueType" :aria-label="`Change the type of ${label}`" @change="onTypeChange">
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="null">Null</option>
        <option value="object">Object</option>
        <option value="array">Array</option>
      </select>
    </label>

    <SemanticBadge
      :value="value"
      :path="path"
      :compact="compact"
      @inspect="emit('inspectSemantic', $event)"
    />
  </div>
</template>

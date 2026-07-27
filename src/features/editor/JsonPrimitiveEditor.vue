<script setup lang="ts">
import { computed, ref } from 'vue'

import type { JsonPrimitive, JsonRootKind } from '@/core/json/types'
import ImagePreview from './ImagePreview.vue'

const props = withDefaults(
  defineProps<{
    value: Exclude<JsonPrimitive, null>
    label: string
    showImagePreview?: boolean
  }>(),
  { showImagePreview: false },
)

const emit = defineEmits<{
  setValue: [value: Exclude<JsonPrimitive, null>]
  changeType: [valueType: JsonRootKind]
}>()

const numberError = ref<string | null>(null)
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
    numberError.value = 'Informe um número válido dentro da faixa segura.'
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
      <span>{{ value ? 'Verdadeiro' : 'Falso' }}</span>
    </label>

    <label class="type-control">
      <span>Tipo</span>
      <select :value="valueType" :aria-label="`Alterar tipo de ${label}`" @change="onTypeChange">
        <option value="string">Texto</option>
        <option value="number">Número</option>
        <option value="boolean">Booleano</option>
        <option value="null">Nulo</option>
        <option value="object">Objeto</option>
        <option value="array">Array</option>
      </select>
    </label>

    <ImagePreview
      v-if="showImagePreview && valueType === 'string'"
      :value="value as string"
    />
  </div>
</template>

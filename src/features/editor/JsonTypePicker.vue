<script setup lang="ts">
import { ref } from 'vue'

import type { JsonRootKind } from '@/core/json/types'

withDefaults(
  defineProps<{
    label?: string
    confirmLabel?: string
    showCancel?: boolean
  }>(),
  {
    label: 'New value type',
    confirmLabel: 'Create',
    showCancel: true,
  },
)

const emit = defineEmits<{
  select: [valueType: JsonRootKind]
  cancel: []
}>()

const selectedType = ref<JsonRootKind>('string')
</script>

<template>
  <form class="type-picker" @submit.prevent="emit('select', selectedType)">
    <label>
      <span>{{ label }}</span>
      <select v-model="selectedType">
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="null">Null</option>
        <option value="object">Object</option>
        <option value="array">Array</option>
      </select>
    </label>
    <div class="type-picker__actions">
      <button class="mini-button mini-button--primary" type="submit">{{ confirmLabel }}</button>
      <button v-if="showCancel" class="mini-button" type="button" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>

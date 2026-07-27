<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  busy: boolean
}>()

const emit = defineEmits<{
  fileSelected: [file: File]
}>()

const input = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
let dragDepth = 0

function openFilePicker(): void {
  input.value?.click()
}

function selectFirstFile(files: FileList | null): void {
  const file = files?.item(0)
  if (file) emit('fileSelected', file)
}

function onInputChange(event: Event): void {
  const target = event.target as HTMLInputElement
  selectFirstFile(target.files)
  target.value = ''
}

function onDragEnter(): void {
  dragDepth += 1
  isDragging.value = true
}

function onDragLeave(): void {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}

function onDrop(event: DragEvent): void {
  dragDepth = 0
  isDragging.value = false
  selectFirstFile(event.dataTransfer?.files ?? null)
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--active': isDragging, 'dropzone--busy': busy }"
    role="button"
    tabindex="0"
    :aria-busy="busy"
    aria-label="Choose or drop a JSON file"
    @click="openFilePicker"
    @keydown.enter.prevent="openFilePicker"
    @keydown.space.prevent="openFilePicker"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <input
      ref="input"
      class="visually-hidden"
      type="file"
      accept=".json,application/json"
      :disabled="busy"
      @change="onInputChange"
    />

    <div class="dropzone__symbol" aria-hidden="true">
      <span>{</span>
      <span class="dropzone__arrow">↓</span>
      <span>}</span>
    </div>
    <p class="dropzone__title">
      {{ busy ? 'Reading your file…' : isDragging ? 'Drop the file here' : 'Drag your JSON file here' }}
    </p>
    <p class="dropzone__hint">or <span>choose a JSON file</span></p>
    <p class="dropzone__format">One .json file at a time</p>
  </div>
</template>

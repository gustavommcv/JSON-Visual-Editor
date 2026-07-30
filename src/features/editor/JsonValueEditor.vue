<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import {
  analyzeArrayShape,
  getCompatibleCollectionViews,
  getDefaultCollectionView,
  getRootKind,
  isJsonObject,
  type JsonCollectionView,
} from '@/core/json/analyzer'
import {
  canReorderJsonObject,
  createJsonValue,
  type JsonEditorOperation,
} from '@/core/json/operations'
import {
  appendJsonPath,
  areJsonPathsEqual,
  isJsonPathPrefix,
} from '@/core/json/path'
import type {
  JsonObject,
  JsonPath,
  JsonPrimitive,
  JsonRootKind,
  JsonValue,
} from '@/core/json/types'
import ConfirmAction from './ConfirmAction.vue'
import {
  closeItemDetailsSurface,
  getItemDetailsIndex,
  getItemDetailsInspection,
  inspectItemDetailsSurface,
  openItemDetailsSurface,
  returnToItemDetails as returnToItemDetailsState,
  type ItemDetailsSurfaceState,
  type SemanticInspectionRequest,
} from './contextualSurface'
import JsonItemDetailsPanel from './JsonItemDetailsPanel.vue'
import JsonPrimitiveEditor from './JsonPrimitiveEditor.vue'
import JsonTableCell from './JsonTableCell.vue'
import JsonTypePicker from './JsonTypePicker.vue'
import SemanticInspector from './SemanticInspector.vue'

defineOptions({ name: 'JsonValueEditor' })

const props = withDefaults(
  defineProps<{
    value: JsonValue
    path: JsonPath
    depth: number
    highlightedPath?: JsonPath | null
    imagePreviews?: boolean
  }>(),
  {
    highlightedPath: null,
    imagePreviews: false,
  },
)

const emit = defineEmits<{
  operation: [operation: JsonEditorOperation]
  inspectSemantic: [request: SemanticInspectionRequest]
  contextualSurfaceOpen: []
}>()

interface PendingConfirmation {
  title: string
  description: string
  confirmLabel: string
  path: JsonPath
  operation: JsonEditorOperation
}

const addingValue = ref(false)
const replacingRoot = ref(false)
const newPropertyKey = ref('')
const newPropertyType = ref<JsonRootKind>('string')
const missingCell = ref<string | null>(null)
const expanded = ref(props.depth < 2)
const bodyMounted = ref(props.depth < 2)
const itemDetailsSurface = shallowRef<ItemDetailsSurfaceState>(closeItemDetailsSurface())
const pendingConfirmation = shallowRef<PendingConfirmation | null>(null)

const valueKind = computed(() => getRootKind(props.value))
const isCollection = computed(() => Array.isArray(props.value) || isJsonObject(props.value))
const objectValue = computed(() => (isJsonObject(props.value) ? props.value : null))
const arrayValue = computed(() => (Array.isArray(props.value) ? props.value : null))
const objectEntries = computed(() => Object.entries(objectValue.value ?? {}))
const objectCanReorder = computed(() =>
  objectValue.value ? canReorderJsonObject(objectValue.value) : false,
)
const arrayShape = computed(() => analyzeArrayShape(arrayValue.value ?? []))
const compatibleViews = computed<JsonCollectionView[]>(() =>
  isCollection.value
    ? getCompatibleCollectionViews(props.value as JsonObject | JsonValue[])
    : [],
)
const viewMode = ref<JsonCollectionView>(
  isCollection.value
    ? getDefaultCollectionView(props.value as JsonObject | JsonValue[])
    : 'form',
)
const pathData = computed(() => JSON.stringify(props.path))
const itemCount = computed(() =>
  arrayValue.value ? arrayValue.value.length : objectEntries.value.length,
)
const selectedItemIndex = computed(() => getItemDetailsIndex(itemDetailsSurface.value))
const itemDetailsInspection = computed(() => getItemDetailsInspection(itemDetailsSurface.value))
const selectedItem = computed<JsonObject | null>(() => {
  if (selectedItemIndex.value === null || !arrayValue.value) return null
  const item = arrayValue.value[selectedItemIndex.value]
  return item !== undefined && isJsonObject(item) ? item : null
})
const isHighlighted = computed(() =>
  props.highlightedPath
    ? areJsonPathsEqual(props.path, props.highlightedPath)
    : false,
)
const primitiveValue = computed(
  () => props.value as Exclude<JsonPrimitive, null>,
)

watch(
  compatibleViews,
  (views) => {
    if (!views.includes(viewMode.value) && isCollection.value) {
      viewMode.value = getDefaultCollectionView(props.value as JsonObject | JsonValue[])
    }
  },
  { deep: true },
)

watch(valueKind, () => {
  closeItemDetails()
  if (isCollection.value) {
    viewMode.value = getDefaultCollectionView(props.value as JsonObject | JsonValue[])
  }
})

watch(
  () => arrayValue.value?.length,
  (length) => {
    if (
      selectedItemIndex.value !== null &&
      (length === undefined || selectedItemIndex.value >= length)
    ) {
      closeItemDetails()
    }
  },
)

watch(
  () => props.highlightedPath,
  (targetPath) => {
    if (!targetPath || !isJsonPathPrefix(props.path, targetPath)) return
    expanded.value = true
    bodyMounted.value = true

    if (
      viewMode.value === 'table' &&
      arrayValue.value &&
      targetPath.length > props.path.length + 2
    ) {
      const rowIndex = targetPath[props.path.length]
      const row = typeof rowIndex === 'number' ? arrayValue.value[rowIndex] : undefined
      if (typeof rowIndex === 'number' && row !== undefined && isJsonObject(row)) {
        openItemDetails(rowIndex)
      }
    }
  },
  { deep: true },
)

function childPath(segment: string | number): JsonPath {
  return appendJsonPath(props.path, segment)
}

function handleCollectionToggle(event: Event): void {
  const open = (event.target as HTMLDetailsElement).open
  expanded.value = open
  if (open) bodyMounted.value = true
}

function pathDataFor(path: JsonPath): string {
  return JSON.stringify(path)
}

function isPathHighlighted(path: JsonPath): boolean {
  return props.highlightedPath ? areJsonPathsEqual(path, props.highlightedPath) : false
}

function forwardOperation(operation: JsonEditorOperation): void {
  emit('operation', operation)
}

function forwardSemanticInspection(request: SemanticInspectionRequest): void {
  emit('inspectSemantic', request)
}

function openItemDetails(itemIndex: number): void {
  emit('contextualSurfaceOpen')
  itemDetailsSurface.value = openItemDetailsSurface(itemIndex)
}

function closeItemDetails(): void {
  itemDetailsSurface.value = closeItemDetailsSurface()
}

function inspectFromItemDetails(request: SemanticInspectionRequest): void {
  itemDetailsSurface.value = inspectItemDetailsSurface(itemDetailsSurface.value, request)
}

function returnToItemDetails(): void {
  const trigger = itemDetailsInspection.value?.trigger ?? null
  itemDetailsSurface.value = returnToItemDetailsState(itemDetailsSurface.value)
  void nextTick(() => {
    if (trigger?.isConnected) trigger.focus()
  })
}

function setValue(value: JsonValue): void {
  emit('operation', { kind: 'set-value', path: props.path, value })
}

function requestTypeChange(valueType: JsonRootKind): void {
  if (props.value === null) {
    emit('operation', { kind: 'change-type', path: props.path, valueType })
    return
  }

  pendingConfirmation.value = {
    title: 'Change this value type?',
    description: 'The current content will be replaced with the default value for the new type.',
    confirmLabel: 'Change type',
    path: props.path,
    operation: { kind: 'change-type', path: props.path, valueType },
  }
}

function onCollectionTypeChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  requestTypeChange(select.value as JsonRootKind)
  select.value = valueKind.value
}

function requestRootReplacement(valueType: JsonRootKind): void {
  replacingRoot.value = false
  pendingConfirmation.value = {
    title: 'Replace the entire document?',
    description: 'The current root and every value inside it will be replaced.',
    confirmLabel: 'Replace root',
    path: [],
    operation: { kind: 'replace-root', value: createJsonValue(valueType) },
  }
}

function renameProperty(event: Event, previousKey: string): void {
  const input = event.target as HTMLInputElement
  const nextKey = input.value
  if (nextKey === previousKey) return

  emit('operation', {
    kind: 'rename-property',
    objectPath: props.path,
    previousKey,
    nextKey,
  })
  queueMicrotask(() => {
    if (input.isConnected) input.value = previousKey
  })
}

function addProperty(): void {
  emit('operation', {
    kind: 'add-property',
    objectPath: props.path,
    key: newPropertyKey.value,
    valueType: newPropertyType.value,
  })
  newPropertyKey.value = ''
}

function appendItem(valueType: JsonRootKind): void {
  emit('operation', { kind: 'append-item', arrayPath: props.path, valueType })
  addingValue.value = false
}

function duplicateProperty(key: string): void {
  emit('operation', { kind: 'duplicate-property', objectPath: props.path, key })
}

function duplicateArrayItem(index: number): void {
  emit('operation', { kind: 'duplicate-array-item', arrayPath: props.path, index })
}

function moveProperty(key: string, toIndex: number): void {
  emit('operation', { kind: 'move-property', objectPath: props.path, key, toIndex })
}

function moveArrayItem(fromIndex: number, toIndex: number): void {
  closeItemDetails()
  emit('operation', { kind: 'move-array-item', arrayPath: props.path, fromIndex, toIndex })
}

function requestRemove(path: JsonPath, description: string): void {
  pendingConfirmation.value = {
    title: 'Delete this content?',
    description,
    confirmLabel: 'Delete',
    path,
    operation: { kind: 'remove-value', path },
  }
}

function confirmPendingOperation(): void {
  if (!pendingConfirmation.value) return
  const operation = pendingConfirmation.value.operation
  if (operation.kind === 'remove-value') closeItemDetails()
  emit('operation', operation)
  pendingConfirmation.value = null
}

function handleTableCellOperation(operation: JsonEditorOperation, currentValue: JsonValue): void {
  if (operation.kind === 'change-type' && currentValue !== null) {
    pendingConfirmation.value = {
      title: 'Change this cell type?',
      description: 'The current cell value will be replaced with the default value for the new type.',
      confirmLabel: 'Change type',
      path: operation.path,
      operation,
    }
    return
  }
  emit('operation', operation)
}

function missingCellId(rowIndex: number, column: string): string {
  return JSON.stringify([rowIndex, column])
}

function addMissingCell(rowIndex: number, column: string, valueType: JsonRootKind): void {
  emit('operation', {
    kind: 'add-property',
    objectPath: childPath(rowIndex),
    key: column,
    valueType,
  })
  missingCell.value = null
}

function hasProperty(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function viewLabel(view: JsonCollectionView): string {
  const labels: Record<JsonCollectionView, string> = {
    form: 'Form',
    table: 'Table',
    list: 'Cards',
  }
  return labels[view]
}
</script>

<template>
  <div
    class="json-value-editor"
    :class="[
      `json-value-editor--${valueKind}`,
      { 'json-value-editor--root': depth === 0, 'is-search-highlight': isHighlighted },
    ]"
    :data-json-path="pathData"
    tabindex="-1"
  >
    <div v-if="depth === 0" class="root-replacement">
      <span>Document root</span>
      <button
        v-if="!replacingRoot"
        class="mini-button"
        type="button"
        @click="replacingRoot = true"
      >
        Replace root
      </button>
      <JsonTypePicker
        v-else
        label="New root type"
        confirm-label="Continue"
        @select="requestRootReplacement"
        @cancel="replacingRoot = false"
      />
    </div>

    <JsonPrimitiveEditor
      v-if="value !== null && !isCollection"
      :value="primitiveValue"
      :label="path.length === 0 ? 'root value' : String(path[path.length - 1])"
      :path="path"
      @set-value="setValue"
      @change-type="requestTypeChange"
      @inspect-semantic="forwardSemanticInspection"
    />

    <div v-else-if="value === null" class="null-editor">
      <div>
        <span class="type-badge">null</span>
        <strong>Null value</strong>
        <p>Choose a type to replace this value.</p>
      </div>
      <JsonTypePicker
        label="New type"
        confirm-label="Replace"
        :show-cancel="false"
        @select="requestTypeChange"
      />
    </div>

    <details
      v-else
      class="collection-editor"
      :open="depth === 0 || expanded"
      @toggle="handleCollectionToggle"
    >
      <summary>
        <span class="collapse-indicator" aria-hidden="true">›</span>
        <span class="type-badge">{{ valueKind }}</span>
        <strong>{{ valueKind === 'array' ? 'Array' : 'Object' }}</strong>
        <span>{{ itemCount }} {{ itemCount === 1 ? 'item' : 'items' }}</span>
      </summary>

      <div v-if="depth === 0 || bodyMounted" class="collection-editor__body">
        <div class="collection-toolbar">
          <div v-if="compatibleViews.length > 1" class="view-switcher" aria-label="View">
            <button
              v-for="view in compatibleViews"
              :key="view"
              type="button"
              :class="{ 'is-active': viewMode === view }"
              :aria-pressed="viewMode === view"
              @click="viewMode = view"
            >
              {{ viewLabel(view) }}
            </button>
          </div>
          <label class="type-control type-control--collection">
            <span>Type</span>
            <select
              :value="valueKind"
              aria-label="Change this value type"
              @change="onCollectionTypeChange"
            >
              <option value="object">Object</option>
              <option value="array">Array</option>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="null">Null</option>
            </select>
          </label>
        </div>

        <template v-if="objectValue">
          <p v-if="!objectCanReorder && objectEntries.length > 1" class="order-note">
            Numeric keys follow the order defined by JavaScript and cannot be moved visually.
          </p>

          <div v-if="objectEntries.length === 0" class="empty-collection">
            <span aria-hidden="true">{ }</span>
            <strong>Empty object</strong>
            <p>Add the first property and choose its value type.</p>
          </div>

          <div
            v-else
            class="object-fields"
          >
            <section
              v-for="([key, childValue], index) in objectEntries"
              :key="key"
              v-memo="[
                childValue,
                index,
                index === objectEntries.length - 1,
                objectCanReorder,
                highlightedPath,
                imagePreviews,
              ]"
              class="property-field"
              :class="{ 'is-search-highlight': isPathHighlighted(childPath(key)) }"
              :data-json-path="pathDataFor(childPath(key))"
              tabindex="-1"
            >
              <div class="property-field__heading">
                <label>
                  <span class="visually-hidden">Property name</span>
                  <input
                    class="property-key"
                    :value="key"
                    :aria-label="`Rename property ${key}`"
                    @change="renameProperty($event, key)"
                  />
                </label>
                <span class="property-index">{{ index + 1 }}</span>
                <div class="item-actions" aria-label="Property actions">
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!objectCanReorder || index === 0"
                    :aria-label="`Move property ${key} up`"
                    title="Move up"
                    @click="moveProperty(key, index - 1)"
                  >↑</button>
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!objectCanReorder || index === objectEntries.length - 1"
                    :aria-label="`Move property ${key} down`"
                    title="Move down"
                    @click="moveProperty(key, index + 1)"
                  >↓</button>
                  <button
                    class="icon-button"
                    type="button"
                    :aria-label="`Duplicate property ${key}`"
                    title="Duplicate property"
                    @click="duplicateProperty(key)"
                  >⧉</button>
                  <button
                    class="icon-button"
                    type="button"
                    :aria-label="`Delete property ${key}`"
                    title="Delete property"
                    @click="requestRemove(childPath(key), `Property “${key}” and all of its content will be deleted.`)"
                  >×</button>
                </div>
              </div>
              <JsonValueEditor
                :value="childValue"
                :path="childPath(key)"
                :depth="depth + 1"
                :highlighted-path="highlightedPath"
                :image-previews="imagePreviews"
                @operation="forwardOperation"
                @inspect-semantic="forwardSemanticInspection"
                @contextual-surface-open="emit('contextualSurfaceOpen')"
              />
            </section>
          </div>

          <div class="add-control">
            <button
              v-if="!addingValue"
              class="mini-button mini-button--add"
              type="button"
              @click="addingValue = true"
            >
              + Add property
            </button>
            <form v-else class="add-property-form" @submit.prevent="addProperty">
              <label>
                <span>Property name</span>
                <input v-model="newPropertyKey" />
              </label>
              <label>
                <span>Value type</span>
                <select v-model="newPropertyType">
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="null">Null</option>
                  <option value="object">Object</option>
                  <option value="array">Array</option>
                </select>
              </label>
              <button class="mini-button mini-button--primary" type="submit">Add</button>
              <button class="mini-button" type="button" @click="addingValue = false">Cancel</button>
            </form>
          </div>
        </template>

        <template v-else-if="arrayValue">
          <div v-if="arrayValue.length === 0" class="empty-collection">
            <span aria-hidden="true">[ ]</span>
            <strong>Empty array</strong>
            <p>Add the first item and choose its type.</p>
          </div>

          <template v-else-if="viewMode === 'table'">
            <div class="table-scroll" tabindex="0" aria-label="Editable table; scroll horizontally when needed">
              <table class="json-table">
                <caption class="visually-hidden">Array of objects in an editable table</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th v-for="column in arrayShape.columns" :key="column" scope="col">
                      {{ column }}
                    </th>
                    <th v-if="arrayShape.columns.length === 0" scope="col">Contents</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in arrayValue"
                    :key="rowIndex"
                    v-memo="[
                      row,
                      rowIndex,
                      rowIndex === arrayValue.length - 1,
                      highlightedPath,
                      imagePreviews,
                      missingCell,
                    ]"
                    :data-json-path="pathDataFor(childPath(rowIndex))"
                    :class="{ 'is-search-highlight': isPathHighlighted(childPath(rowIndex)) }"
                    tabindex="-1"
                  >
                    <th scope="row">{{ rowIndex + 1 }}</th>
                    <td v-for="column in arrayShape.columns" :key="column">
                      <JsonTableCell
                        v-if="isJsonObject(row) && hasProperty(row, column)"
                        :value="row[column] as JsonValue"
                        :path="[...childPath(rowIndex), column]"
                        :label="`Item ${rowIndex + 1}, ${column}`"
                        :highlighted="isPathHighlighted([...childPath(rowIndex), column])"
                        @operation="handleTableCellOperation($event, row[column] as JsonValue)"
                        @open-details="openItemDetails(rowIndex)"
                        @inspect-semantic="forwardSemanticInspection"
                      />
                      <div v-else class="missing-cell">
                        <span v-if="missingCell !== missingCellId(rowIndex, column)">Missing</span>
                        <button
                          v-if="missingCell !== missingCellId(rowIndex, column)"
                          class="mini-button"
                          type="button"
                          :aria-label="`Create property ${column} in item ${rowIndex + 1}`"
                          @click="missingCell = missingCellId(rowIndex, column)"
                        >+ Create</button>
                        <JsonTypePicker
                          v-else
                          label="Cell type"
                          @select="addMissingCell(rowIndex, column, $event)"
                          @cancel="missingCell = null"
                        />
                      </div>
                    </td>
                    <td v-if="arrayShape.columns.length === 0" class="empty-row-cell">
                      Object with no properties
                    </td>
                    <td class="table-actions">
                      <div class="item-actions item-actions--table">
                        <button class="icon-button" type="button" :disabled="rowIndex === 0" :aria-label="`Move item ${rowIndex + 1} up`" title="Move up" @click="moveArrayItem(rowIndex, rowIndex - 1)">↑</button>
                        <button class="icon-button" type="button" :disabled="rowIndex === arrayValue.length - 1" :aria-label="`Move item ${rowIndex + 1} down`" title="Move down" @click="moveArrayItem(rowIndex, rowIndex + 1)">↓</button>
                        <button class="icon-button" type="button" :aria-label="`Duplicate item ${rowIndex + 1}`" title="Duplicate item" @click="duplicateArrayItem(rowIndex)">⧉</button>
                        <button class="icon-button" type="button" :aria-label="`Open details for item ${rowIndex + 1}`" title="Open details" @click="openItemDetails(rowIndex)">…</button>
                        <button class="icon-button" type="button" :aria-label="`Delete item ${rowIndex + 1}`" title="Delete item" @click="requestRemove(childPath(rowIndex), `Item ${rowIndex + 1} and all of its content will be deleted.`)">×</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="table-cards" aria-label="Table items as cards">
              <article
                v-for="(row, rowIndex) in arrayValue"
                :key="rowIndex"
                v-memo="[
                  row,
                  rowIndex,
                  rowIndex === arrayValue.length - 1,
                  highlightedPath,
                  imagePreviews,
                  missingCell,
                ]"
                class="table-card"
                :class="{ 'is-search-highlight': isPathHighlighted(childPath(rowIndex)) }"
                :data-json-path="pathDataFor(childPath(rowIndex))"
                tabindex="-1"
              >
                <header>
                  <strong>Item {{ rowIndex + 1 }}</strong>
                  <button
                    class="mini-button"
                    type="button"
                    :aria-label="`Open details for item ${rowIndex + 1}`"
                    @click="openItemDetails(rowIndex)"
                  >
                    Open details
                  </button>
                </header>
                <dl v-if="isJsonObject(row)">
                  <div v-for="column in arrayShape.columns" :key="column">
                    <dt>{{ column }}</dt>
                    <dd v-if="hasProperty(row, column)">
                      <JsonTableCell
                        :value="row[column] as JsonValue"
                        :path="[...childPath(rowIndex), column]"
                        :label="`Item ${rowIndex + 1}, ${column}`"
                        :highlighted="isPathHighlighted([...childPath(rowIndex), column])"
                        @operation="handleTableCellOperation($event, row[column] as JsonValue)"
                        @open-details="openItemDetails(rowIndex)"
                        @inspect-semantic="forwardSemanticInspection"
                      />
                    </dd>
                    <dd v-else class="missing-cell">
                      <span v-if="missingCell !== missingCellId(rowIndex, column)">Missing</span>
                      <button
                        v-if="missingCell !== missingCellId(rowIndex, column)"
                        class="mini-button"
                        type="button"
                        :aria-label="`Create property ${column} in item ${rowIndex + 1}`"
                        @click="missingCell = missingCellId(rowIndex, column)"
                      >+ Create</button>
                      <JsonTypePicker
                        v-else
                        label="Cell type"
                        @select="addMissingCell(rowIndex, column, $event)"
                        @cancel="missingCell = null"
                      />
                    </dd>
                  </div>
                </dl>
                <div class="item-actions">
                  <button class="mini-button" type="button" :disabled="rowIndex === 0" :aria-label="`Move item ${rowIndex + 1} up`" @click="moveArrayItem(rowIndex, rowIndex - 1)">↑ Move up</button>
                  <button class="mini-button" type="button" :disabled="rowIndex === arrayValue.length - 1" :aria-label="`Move item ${rowIndex + 1} down`" @click="moveArrayItem(rowIndex, rowIndex + 1)">↓ Move down</button>
                  <button class="mini-button" type="button" :aria-label="`Duplicate item ${rowIndex + 1}`" @click="duplicateArrayItem(rowIndex)">⧉ Duplicate</button>
                  <button class="mini-button mini-button--danger" type="button" :aria-label="`Delete item ${rowIndex + 1}`" @click="requestRemove(childPath(rowIndex), `Item ${rowIndex + 1} and all of its content will be deleted.`)">Delete</button>
                </div>
              </article>
            </div>
          </template>

          <ol
            v-else
            class="array-items"
          >
            <!--
              FLAGGED, NOT FIXED: :key="index" means deleting/reordering an earlier
              item reuses this child JsonValueEditor for a different array element,
              so its local state (expanded, viewMode, selectedItemIndex, ...) can be
              displayed against the wrong item (e.g. an item that was never expanded
              can render as expanded). A watch(() => props.value, resetLocalState)
              would fix the symptom but also fires on the user's own edits to nested
              content within the *same* item (any nested edit produces a new object
              reference along the whole ancestor chain), collapsing/resetting the
              section out from under someone actively typing inside it - a worse
              regression. A correct fix needs stable per-item identity, which JSON
              arrays don't have and this app deliberately avoids synthesizing.
            -->
            <li
              v-for="(childValue, index) in arrayValue"
              :key="index"
              v-memo="[
                childValue,
                index,
                index === arrayValue.length - 1,
                highlightedPath,
                imagePreviews,
              ]"
              class="array-item"
              :class="{ 'is-search-highlight': isPathHighlighted(childPath(index)) }"
              :data-json-path="pathDataFor(childPath(index))"
              tabindex="-1"
            >
              <div class="array-item__heading">
                <span>Item {{ index + 1 }}</span>
                <div class="item-actions">
                  <button class="icon-button" type="button" :disabled="index === 0" :aria-label="`Move item ${index + 1} up`" title="Move up" @click="moveArrayItem(index, index - 1)">↑</button>
                  <button class="icon-button" type="button" :disabled="index === arrayValue.length - 1" :aria-label="`Move item ${index + 1} down`" title="Move down" @click="moveArrayItem(index, index + 1)">↓</button>
                  <button class="icon-button" type="button" :aria-label="`Duplicate item ${index + 1}`" title="Duplicate item" @click="duplicateArrayItem(index)">⧉</button>
                  <button class="icon-button" type="button" :aria-label="`Delete item ${index + 1}`" title="Delete item" @click="requestRemove(childPath(index), `Item ${index + 1} and all of its content will be deleted.`)">×</button>
                </div>
              </div>
              <JsonValueEditor
                :value="childValue"
                :path="childPath(index)"
                :depth="depth + 1"
                :highlighted-path="highlightedPath"
                :image-previews="imagePreviews"
                @operation="forwardOperation"
                @inspect-semantic="forwardSemanticInspection"
                @contextual-surface-open="emit('contextualSurfaceOpen')"
              />
            </li>
          </ol>

          <div class="add-control">
            <button
              v-if="!addingValue"
              class="mini-button mini-button--add"
              type="button"
              @click="addingValue = true"
            >
              + Add item
            </button>
            <JsonTypePicker
              v-else
              label="New item type"
              @select="appendItem"
              @cancel="addingValue = false"
            />
          </div>
        </template>
      </div>
    </details>

    <JsonItemDetailsPanel
      v-if="selectedItem && selectedItemIndex !== null"
      :item-number="selectedItemIndex + 1"
      :path="childPath(selectedItemIndex)"
      :inspection-title="itemDetailsInspection?.semantic.label ?? null"
      :inspection-path="itemDetailsInspection?.path ?? null"
      @back="returnToItemDetails"
      @close="closeItemDetails"
    >
      <div v-show="!itemDetailsInspection">
        <div class="detail-panel-actions">
          <button class="mini-button" type="button" :disabled="selectedItemIndex === 0" @click="moveArrayItem(selectedItemIndex, selectedItemIndex - 1)">↑ Move up</button>
          <button class="mini-button" type="button" :disabled="selectedItemIndex === (arrayValue?.length ?? 0) - 1" @click="moveArrayItem(selectedItemIndex, selectedItemIndex + 1)">↓ Move down</button>
          <button class="mini-button" type="button" @click="duplicateArrayItem(selectedItemIndex)">⧉ Duplicate</button>
          <button class="mini-button mini-button--danger" type="button" @click="requestRemove(childPath(selectedItemIndex), `Item ${selectedItemIndex + 1} and all of its content will be deleted.`)">Delete</button>
        </div>
        <JsonValueEditor
          :value="selectedItem"
          :path="childPath(selectedItemIndex)"
          :depth="1"
          :highlighted-path="highlightedPath"
          :image-previews="true"
          @operation="forwardOperation"
          @inspect-semantic="inspectFromItemDetails"
          @contextual-surface-open="emit('contextualSurfaceOpen')"
        />
      </div>
      <SemanticInspector
        v-if="itemDetailsInspection"
        embedded
        :semantic="itemDetailsInspection.semantic"
        :raw-value="itemDetailsInspection.rawValue"
        :path="itemDetailsInspection.path"
      />
    </JsonItemDetailsPanel>

    <ConfirmAction
      v-if="pendingConfirmation"
      :title="pendingConfirmation.title"
      :description="pendingConfirmation.description"
      :confirm-label="pendingConfirmation.confirmLabel"
      :path="pendingConfirmation.path"
      @confirm="confirmPendingOperation"
      @cancel="pendingConfirmation = null"
    />
  </div>
</template>

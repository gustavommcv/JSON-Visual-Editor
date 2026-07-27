<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

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
import JsonItemDetailsPanel from './JsonItemDetailsPanel.vue'
import JsonPrimitiveEditor from './JsonPrimitiveEditor.vue'
import JsonTableCell from './JsonTableCell.vue'
import JsonTypePicker from './JsonTypePicker.vue'

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
const selectedItemIndex = ref<number | null>(null)
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
  selectedItemIndex.value = null
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
      selectedItemIndex.value = null
    }
  },
)

watch(
  () => props.highlightedPath,
  (targetPath) => {
    if (!targetPath || !isJsonPathPrefix(props.path, targetPath)) return
    expanded.value = true

    if (
      viewMode.value === 'table' &&
      arrayValue.value &&
      targetPath.length > props.path.length + 2
    ) {
      const rowIndex = targetPath[props.path.length]
      const row = typeof rowIndex === 'number' ? arrayValue.value[rowIndex] : undefined
      if (typeof rowIndex === 'number' && row !== undefined && isJsonObject(row)) {
        selectedItemIndex.value = rowIndex
      }
    }
  },
  { deep: true },
)

function childPath(segment: string | number): JsonPath {
  return appendJsonPath(props.path, segment)
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

function setValue(value: JsonValue): void {
  emit('operation', { kind: 'set-value', path: props.path, value })
}

function requestTypeChange(valueType: JsonRootKind): void {
  if (props.value === null) {
    emit('operation', { kind: 'change-type', path: props.path, valueType })
    return
  }

  pendingConfirmation.value = {
    title: 'Alterar o tipo deste valor?',
    description: 'O conteúdo atual será substituído pelo valor inicial do novo tipo.',
    confirmLabel: 'Alterar tipo',
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
    title: 'Substituir todo o documento?',
    description: 'A raiz atual e todos os valores abaixo dela serão substituídos.',
    confirmLabel: 'Substituir raiz',
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
  selectedItemIndex.value = null
  emit('operation', { kind: 'move-array-item', arrayPath: props.path, fromIndex, toIndex })
}

function requestRemove(path: JsonPath, description: string): void {
  pendingConfirmation.value = {
    title: 'Excluir este conteúdo?',
    description,
    confirmLabel: 'Excluir',
    path,
    operation: { kind: 'remove-value', path },
  }
}

function confirmPendingOperation(): void {
  if (!pendingConfirmation.value) return
  const operation = pendingConfirmation.value.operation
  if (operation.kind === 'remove-value') selectedItemIndex.value = null
  emit('operation', operation)
  pendingConfirmation.value = null
}

function handleTableCellOperation(operation: JsonEditorOperation, currentValue: JsonValue): void {
  if (operation.kind === 'change-type' && currentValue !== null) {
    pendingConfirmation.value = {
      title: 'Alterar o tipo desta célula?',
      description: 'O valor atual da célula será substituído pelo valor inicial do novo tipo.',
      confirmLabel: 'Alterar tipo',
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
    form: 'Formulário',
    table: 'Tabela',
    list: 'Cards',
    tree: 'Árvore',
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
      <span>Raiz do documento</span>
      <button
        v-if="!replacingRoot"
        class="mini-button"
        type="button"
        @click="replacingRoot = true"
      >
        Substituir raiz
      </button>
      <JsonTypePicker
        v-else
        label="Novo tipo da raiz"
        confirm-label="Continuar"
        @select="requestRootReplacement"
        @cancel="replacingRoot = false"
      />
    </div>

    <JsonPrimitiveEditor
      v-if="value !== null && !isCollection"
      :value="primitiveValue"
      :label="path.length === 0 ? 'valor raiz' : String(path[path.length - 1])"
      :show-image-preview="imagePreviews"
      @set-value="setValue"
      @change-type="requestTypeChange"
    />

    <div v-else-if="value === null" class="null-editor">
      <div>
        <span class="type-badge">null</span>
        <strong>Valor nulo</strong>
        <p>Escolha um tipo para substituir este valor.</p>
      </div>
      <JsonTypePicker
        label="Novo tipo"
        confirm-label="Substituir"
        :show-cancel="false"
        @select="requestTypeChange"
      />
    </div>

    <details
      v-else
      class="collection-editor"
      :open="depth === 0 || expanded"
      @toggle="expanded = ($event.target as HTMLDetailsElement).open"
    >
      <summary>
        <span class="collapse-indicator" aria-hidden="true">›</span>
        <span class="type-badge">{{ valueKind }}</span>
        <strong>{{ valueKind === 'array' ? 'Array' : 'Objeto' }}</strong>
        <span>{{ itemCount }} {{ itemCount === 1 ? 'item' : 'itens' }}</span>
      </summary>

      <div class="collection-editor__body">
        <div class="collection-toolbar">
          <div class="view-switcher" aria-label="Visualização">
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
            <span>Tipo</span>
            <select
              :value="valueKind"
              aria-label="Alterar tipo deste valor"
              @change="onCollectionTypeChange"
            >
              <option value="object">Objeto</option>
              <option value="array">Array</option>
              <option value="string">Texto</option>
              <option value="number">Número</option>
              <option value="boolean">Booleano</option>
              <option value="null">Nulo</option>
            </select>
          </label>
        </div>

        <template v-if="objectValue">
          <p v-if="!objectCanReorder && objectEntries.length > 1" class="order-note">
            Chaves numéricas seguem a ordem definida pelo JavaScript e não podem ser movidas visualmente.
          </p>

          <div v-if="objectEntries.length === 0" class="empty-collection">
            <span aria-hidden="true">{ }</span>
            <strong>Objeto vazio</strong>
            <p>Adicione a primeira propriedade e escolha o tipo do valor.</p>
          </div>

          <div
            v-else
            class="object-fields"
            :class="{ 'object-fields--tree': viewMode === 'tree' }"
          >
            <section
              v-for="([key, childValue], index) in objectEntries"
              :key="key"
              class="property-field"
              :class="{ 'is-search-highlight': isPathHighlighted(childPath(key)) }"
              :data-json-path="pathDataFor(childPath(key))"
              tabindex="-1"
            >
              <div class="property-field__heading">
                <label>
                  <span class="visually-hidden">Nome da propriedade</span>
                  <input
                    class="property-key"
                    :value="key"
                    :aria-label="`Renomear propriedade ${key}`"
                    @change="renameProperty($event, key)"
                  />
                </label>
                <span class="property-index">{{ index + 1 }}</span>
                <div class="item-actions" aria-label="Ações da propriedade">
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!objectCanReorder || index === 0"
                    :aria-label="`Mover propriedade ${key} para cima`"
                    title="Mover para cima"
                    @click="moveProperty(key, index - 1)"
                  >↑</button>
                  <button
                    class="icon-button"
                    type="button"
                    :disabled="!objectCanReorder || index === objectEntries.length - 1"
                    :aria-label="`Mover propriedade ${key} para baixo`"
                    title="Mover para baixo"
                    @click="moveProperty(key, index + 1)"
                  >↓</button>
                  <button
                    class="icon-button"
                    type="button"
                    :aria-label="`Duplicar propriedade ${key}`"
                    title="Duplicar propriedade"
                    @click="duplicateProperty(key)"
                  >⧉</button>
                  <button
                    class="icon-button"
                    type="button"
                    :aria-label="`Excluir propriedade ${key}`"
                    title="Excluir propriedade"
                    @click="requestRemove(childPath(key), `A propriedade “${key}” e todo o seu conteúdo serão removidos.`)"
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
              + Adicionar propriedade
            </button>
            <form v-else class="add-property-form" @submit.prevent="addProperty">
              <label>
                <span>Nome da propriedade</span>
                <input v-model="newPropertyKey" />
              </label>
              <label>
                <span>Tipo do valor</span>
                <select v-model="newPropertyType">
                  <option value="string">Texto</option>
                  <option value="number">Número</option>
                  <option value="boolean">Booleano</option>
                  <option value="null">Nulo</option>
                  <option value="object">Objeto</option>
                  <option value="array">Array</option>
                </select>
              </label>
              <button class="mini-button mini-button--primary" type="submit">Adicionar</button>
              <button class="mini-button" type="button" @click="addingValue = false">Cancelar</button>
            </form>
          </div>
        </template>

        <template v-else-if="arrayValue">
          <div v-if="arrayValue.length === 0" class="empty-collection">
            <span aria-hidden="true">[ ]</span>
            <strong>Array vazio</strong>
            <p>Adicione o primeiro item e escolha qual tipo criar.</p>
          </div>

          <template v-else-if="viewMode === 'table'">
            <div class="table-scroll" tabindex="0" aria-label="Tabela editável; use rolagem horizontal quando necessário">
              <table class="json-table">
                <caption class="visually-hidden">Array de objetos em formato de tabela editável</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th v-for="column in arrayShape.columns" :key="column" scope="col">
                      {{ column }}
                    </th>
                    <th v-if="arrayShape.columns.length === 0" scope="col">Conteúdo</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in arrayValue"
                    :key="rowIndex"
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
                        @open-details="selectedItemIndex = rowIndex"
                      />
                      <div v-else class="missing-cell">
                        <span v-if="missingCell !== missingCellId(rowIndex, column)">Ausente</span>
                        <button
                          v-if="missingCell !== missingCellId(rowIndex, column)"
                          class="mini-button"
                          type="button"
                          :aria-label="`Criar propriedade ${column} no item ${rowIndex + 1}`"
                          @click="missingCell = missingCellId(rowIndex, column)"
                        >+ Criar</button>
                        <JsonTypePicker
                          v-else
                          label="Tipo da célula"
                          @select="addMissingCell(rowIndex, column, $event)"
                          @cancel="missingCell = null"
                        />
                      </div>
                    </td>
                    <td v-if="arrayShape.columns.length === 0" class="empty-row-cell">
                      Objeto sem propriedades
                    </td>
                    <td class="table-actions">
                      <div class="item-actions item-actions--table">
                        <button class="icon-button" type="button" :disabled="rowIndex === 0" :aria-label="`Mover item ${rowIndex + 1} para cima`" title="Mover para cima" @click="moveArrayItem(rowIndex, rowIndex - 1)">↑</button>
                        <button class="icon-button" type="button" :disabled="rowIndex === arrayValue.length - 1" :aria-label="`Mover item ${rowIndex + 1} para baixo`" title="Mover para baixo" @click="moveArrayItem(rowIndex, rowIndex + 1)">↓</button>
                        <button class="icon-button" type="button" :aria-label="`Duplicar item ${rowIndex + 1}`" title="Duplicar item" @click="duplicateArrayItem(rowIndex)">⧉</button>
                        <button class="icon-button" type="button" :aria-label="`Abrir detalhes do item ${rowIndex + 1}`" title="Abrir detalhes" @click="selectedItemIndex = rowIndex">…</button>
                        <button class="icon-button" type="button" :aria-label="`Excluir item ${rowIndex + 1}`" title="Excluir item" @click="requestRemove(childPath(rowIndex), `O item ${rowIndex + 1} e todo o seu conteúdo serão removidos.`)">×</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="table-cards" aria-label="Itens da tabela em cards">
              <article
                v-for="(row, rowIndex) in arrayValue"
                :key="rowIndex"
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
                    :aria-label="`Abrir detalhes do item ${rowIndex + 1}`"
                    @click="selectedItemIndex = rowIndex"
                  >
                    Abrir detalhes
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
                        @open-details="selectedItemIndex = rowIndex"
                      />
                    </dd>
                    <dd v-else class="missing-cell">
                      <span v-if="missingCell !== missingCellId(rowIndex, column)">Ausente</span>
                      <button
                        v-if="missingCell !== missingCellId(rowIndex, column)"
                        class="mini-button"
                        type="button"
                        :aria-label="`Criar propriedade ${column} no item ${rowIndex + 1}`"
                        @click="missingCell = missingCellId(rowIndex, column)"
                      >+ Criar</button>
                      <JsonTypePicker
                        v-else
                        label="Tipo da célula"
                        @select="addMissingCell(rowIndex, column, $event)"
                        @cancel="missingCell = null"
                      />
                    </dd>
                  </div>
                </dl>
                <div class="item-actions">
                  <button class="mini-button" type="button" :disabled="rowIndex === 0" :aria-label="`Mover item ${rowIndex + 1} para cima`" @click="moveArrayItem(rowIndex, rowIndex - 1)">↑ Subir</button>
                  <button class="mini-button" type="button" :disabled="rowIndex === arrayValue.length - 1" :aria-label="`Mover item ${rowIndex + 1} para baixo`" @click="moveArrayItem(rowIndex, rowIndex + 1)">↓ Descer</button>
                  <button class="mini-button" type="button" :aria-label="`Duplicar item ${rowIndex + 1}`" @click="duplicateArrayItem(rowIndex)">⧉ Duplicar</button>
                  <button class="mini-button mini-button--danger" type="button" :aria-label="`Excluir item ${rowIndex + 1}`" @click="requestRemove(childPath(rowIndex), `O item ${rowIndex + 1} e todo o seu conteúdo serão removidos.`)">Excluir</button>
                </div>
              </article>
            </div>
          </template>

          <ol
            v-else
            class="array-items"
            :class="{ 'array-items--tree': viewMode === 'tree' }"
          >
            <li
              v-for="(childValue, index) in arrayValue"
              :key="index"
              class="array-item"
              :class="{ 'is-search-highlight': isPathHighlighted(childPath(index)) }"
              :data-json-path="pathDataFor(childPath(index))"
              tabindex="-1"
            >
              <div class="array-item__heading">
                <span>Item {{ index + 1 }}</span>
                <div class="item-actions">
                  <button class="icon-button" type="button" :disabled="index === 0" :aria-label="`Mover item ${index + 1} para cima`" title="Mover para cima" @click="moveArrayItem(index, index - 1)">↑</button>
                  <button class="icon-button" type="button" :disabled="index === arrayValue.length - 1" :aria-label="`Mover item ${index + 1} para baixo`" title="Mover para baixo" @click="moveArrayItem(index, index + 1)">↓</button>
                  <button class="icon-button" type="button" :aria-label="`Duplicar item ${index + 1}`" title="Duplicar item" @click="duplicateArrayItem(index)">⧉</button>
                  <button class="icon-button" type="button" :aria-label="`Excluir item ${index + 1}`" title="Excluir item" @click="requestRemove(childPath(index), `O item ${index + 1} e todo o seu conteúdo serão removidos.`)">×</button>
                </div>
              </div>
              <JsonValueEditor
                :value="childValue"
                :path="childPath(index)"
                :depth="depth + 1"
                :highlighted-path="highlightedPath"
                :image-previews="imagePreviews"
                @operation="forwardOperation"
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
              + Adicionar item
            </button>
            <JsonTypePicker
              v-else
              label="Tipo do novo item"
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
      @close="selectedItemIndex = null"
    >
      <div class="detail-panel-actions">
        <button class="mini-button" type="button" :disabled="selectedItemIndex === 0" @click="moveArrayItem(selectedItemIndex, selectedItemIndex - 1)">↑ Mover para cima</button>
        <button class="mini-button" type="button" :disabled="selectedItemIndex === (arrayValue?.length ?? 0) - 1" @click="moveArrayItem(selectedItemIndex, selectedItemIndex + 1)">↓ Mover para baixo</button>
        <button class="mini-button" type="button" @click="duplicateArrayItem(selectedItemIndex)">⧉ Duplicar</button>
        <button class="mini-button mini-button--danger" type="button" @click="requestRemove(childPath(selectedItemIndex), `O item ${selectedItemIndex + 1} e todo o seu conteúdo serão removidos.`)">Excluir</button>
      </div>
      <JsonValueEditor
        :value="selectedItem"
        :path="childPath(selectedItemIndex)"
        :depth="1"
        :highlighted-path="highlightedPath"
        :image-previews="true"
        @operation="forwardOperation"
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

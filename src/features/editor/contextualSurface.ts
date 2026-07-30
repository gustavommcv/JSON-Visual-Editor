import type { JsonSemanticValue } from '@/core/json/semantic'
import type { JsonPath, JsonPrimitive } from '@/core/json/types'

export interface SemanticInspectionRequest {
  semantic: JsonSemanticValue
  rawValue: JsonPrimitive
  path: JsonPath
  trigger: HTMLElement
}

export type ItemDetailsSurfaceState =
  | { kind: 'closed' }
  | { kind: 'item-details'; itemIndex: number }
  | {
      kind: 'semantic-inspector'
      itemIndex: number
      inspection: SemanticInspectionRequest
    }

export function closeItemDetailsSurface(): ItemDetailsSurfaceState {
  return { kind: 'closed' }
}

export function openItemDetailsSurface(itemIndex: number): ItemDetailsSurfaceState {
  return { kind: 'item-details', itemIndex }
}

export function inspectItemDetailsSurface(
  state: ItemDetailsSurfaceState,
  inspection: SemanticInspectionRequest,
): ItemDetailsSurfaceState {
  if (state.kind === 'closed') return state
  return { kind: 'semantic-inspector', itemIndex: state.itemIndex, inspection }
}

export function returnToItemDetails(
  state: ItemDetailsSurfaceState,
): ItemDetailsSurfaceState {
  if (state.kind !== 'semantic-inspector') return state
  return { kind: 'item-details', itemIndex: state.itemIndex }
}

export function getItemDetailsIndex(state: ItemDetailsSurfaceState): number | null {
  return state.kind === 'closed' ? null : state.itemIndex
}

export function getItemDetailsInspection(
  state: ItemDetailsSurfaceState,
): SemanticInspectionRequest | null {
  return state.kind === 'semantic-inspector' ? state.inspection : null
}

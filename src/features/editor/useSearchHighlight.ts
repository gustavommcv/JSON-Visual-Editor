import { nextTick, ref } from 'vue'

import type { JsonPath } from '@/core/json/types'

export interface SearchHighlightTarget {
  scrollIntoView: (options: ScrollIntoViewOptions) => void
  focus: (options: FocusOptions) => void
}

export interface SearchHighlightEnvironment {
  afterRender: () => Promise<void>
  findVisibleTarget: (path: JsonPath) => SearchHighlightTarget | null
  prefersReducedMotion: () => boolean
}

function findVisibleTarget(path: JsonPath): HTMLElement | null {
  const serializedPath = JSON.stringify(path)
  const candidates = document.querySelectorAll<HTMLElement>('[data-json-path]')
  return (
    [...candidates].find(
      (element) => element.dataset.jsonPath === serializedPath && element.offsetParent !== null,
    ) ?? null
  )
}

const browserEnvironment: SearchHighlightEnvironment = {
  afterRender: nextTick,
  findVisibleTarget,
  prefersReducedMotion: () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
}

export function useSearchHighlight(environment: SearchHighlightEnvironment = browserEnvironment) {
  const highlightedSearchResultPath = ref<JsonPath | null>(null)
  let preservingNavigationFocus = false

  function clearHighlight(): void {
    highlightedSearchResultPath.value = null
  }

  function handleFocusInteraction(): void {
    if (!preservingNavigationFocus) clearHighlight()
  }

  function handlePointerInteraction(): void {
    clearHighlight()
  }

  async function selectSearchResult(path: JsonPath): Promise<boolean> {
    highlightedSearchResultPath.value = [...path]
    await environment.afterRender()

    const target = environment.findVisibleTarget(path)
    if (!target) return false

    target.scrollIntoView({
      behavior: environment.prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    })

    preservingNavigationFocus = true
    try {
      target.focus({ preventScroll: true })
    } finally {
      preservingNavigationFocus = false
    }
    return true
  }

  return {
    highlightedSearchResultPath,
    selectSearchResult,
    handleFocusInteraction,
    handlePointerInteraction,
    clearHighlight,
  }
}

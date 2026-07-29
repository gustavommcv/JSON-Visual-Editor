import { describe, expect, it, vi } from 'vitest'

import type { JsonPath } from '@/core/json/types'
import {
  useSearchHighlight,
  type SearchHighlightEnvironment,
  type SearchHighlightTarget,
} from '@/features/editor/useSearchHighlight'

function createHarness(reducedMotion = false) {
  const scrollIntoView = vi.fn<SearchHighlightTarget['scrollIntoView']>()
  let focusInteraction: (() => void) | null = null
  const focus = vi.fn<SearchHighlightTarget['focus']>(() => focusInteraction?.())
  const target: SearchHighlightTarget = { scrollIntoView, focus }
  const findVisibleTarget = vi.fn<(path: JsonPath) => SearchHighlightTarget | null>(() => target)
  const environment: SearchHighlightEnvironment = {
    afterRender: vi.fn(async () => undefined),
    findVisibleTarget,
    prefersReducedMotion: () => reducedMotion,
  }
  const highlight = useSearchHighlight(environment)
  focusInteraction = () => highlight.handleFocusInteraction()

  return { highlight, environment, findVisibleTarget, scrollIntoView, focus }
}

describe('search-result highlight navigation', () => {
  it('highlights, scrolls to, and focuses the selected result', async () => {
    const { highlight, environment, findVisibleTarget, scrollIntoView, focus } = createHarness()

    await expect(highlight.selectSearchResult(['profile', 'name'])).resolves.toBe(true)

    expect(highlight.highlightedSearchResultPath.value).toEqual(['profile', 'name'])
    expect(environment.afterRender).toHaveBeenCalledOnce()
    expect(findVisibleTarget).toHaveBeenCalledWith(['profile', 'name'])
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('does not clear the highlight for the programmatic focus used by navigation', async () => {
    const { highlight } = createHarness()

    await highlight.selectSearchResult(['profile', 'name'])

    expect(highlight.highlightedSearchResultPath.value).toEqual(['profile', 'name'])
  })

  it('clears the highlight when pointer or keyboard focus enters the editor', async () => {
    const { highlight } = createHarness()

    await highlight.selectSearchResult(['profile'])
    highlight.handlePointerInteraction()
    expect(highlight.highlightedSearchResultPath.value).toBeNull()

    await highlight.selectSearchResult(['profile'])
    highlight.handleFocusInteraction()
    expect(highlight.highlightedSearchResultPath.value).toBeNull()
  })

  it('can apply the highlight again after it was cleared', async () => {
    const { highlight, scrollIntoView } = createHarness()

    await highlight.selectSearchResult(['profile'])
    highlight.handleFocusInteraction()
    await highlight.selectSearchResult(['profile'])

    expect(highlight.highlightedSearchResultPath.value).toEqual(['profile'])
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('uses non-animated scrolling when reduced motion is requested', async () => {
    const { highlight, scrollIntoView } = createHarness(true)

    await highlight.selectSearchResult(['profile'])

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('retains the explicit highlight when the target is temporarily unavailable', async () => {
    const environment: SearchHighlightEnvironment = {
      afterRender: vi.fn(async () => undefined),
      findVisibleTarget: () => null,
      prefersReducedMotion: () => false,
    }
    const highlight = useSearchHighlight(environment)

    await expect(highlight.selectSearchResult(['missing'])).resolves.toBe(false)
    expect(highlight.highlightedSearchResultPath.value).toEqual(['missing'])
  })
})

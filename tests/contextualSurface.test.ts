import { describe, expect, it } from 'vitest'

import { detectJsonSemanticValue } from '../src/core/json/semantic'
import {
  closeItemDetailsSurface,
  getItemDetailsIndex,
  getItemDetailsInspection,
  inspectItemDetailsSurface,
  openItemDetailsSurface,
  returnToItemDetails,
  type SemanticInspectionRequest,
} from '../src/features/editor/contextualSurface'

const semantic = detectJsonSemanticValue('2026-07-30T15:14:13-03:00')
if (!semantic) throw new Error('Expected the fixture to have date-time semantics')

const inspection: SemanticInspectionRequest = {
  semantic,
  rawValue: '2026-07-30T15:14:13-03:00',
  path: ['releases', 0, 'releasedAt'],
  trigger: {} as HTMLElement,
}

describe('item-details contextual surface', () => {
  it('moves from an item to its inspector and back without losing the item', () => {
    const details = openItemDetailsSurface(0)
    const inspector = inspectItemDetailsSurface(details, inspection)
    const restoredDetails = returnToItemDetails(inspector)

    expect(details).toEqual({ kind: 'item-details', itemIndex: 0 })
    expect(inspector).toEqual({ kind: 'semantic-inspector', itemIndex: 0, inspection })
    expect(restoredDetails).toEqual(details)
    expect(getItemDetailsIndex(inspector)).toBe(0)
    expect(getItemDetailsInspection(inspector)).toBe(inspection)
  })

  it('keeps close distinct from inspector back navigation', () => {
    const inspector = inspectItemDetailsSurface(openItemDetailsSurface(2), inspection)

    expect(returnToItemDetails(inspector)).toEqual({ kind: 'item-details', itemIndex: 2 })
    expect(closeItemDetailsSurface()).toEqual({ kind: 'closed' })
    expect(getItemDetailsIndex(closeItemDetailsSurface())).toBeNull()
    expect(getItemDetailsInspection(closeItemDetailsSurface())).toBeNull()
  })

  it('can open a different item after inspector navigation is complete', () => {
    const firstInspector = inspectItemDetailsSurface(openItemDetailsSurface(0), inspection)
    const firstDetails = returnToItemDetails(firstInspector)

    expect(firstDetails).toEqual({ kind: 'item-details', itemIndex: 0 })
    expect(openItemDetailsSurface(3)).toEqual({ kind: 'item-details', itemIndex: 3 })
  })

  it('ignores an inspection request when item details are closed', () => {
    const closed = closeItemDetailsSurface()
    expect(inspectItemDetailsSurface(closed, inspection)).toBe(closed)
  })

  it('does not mutate document data while navigating contextual views', () => {
    const document = {
      releases: [{ releasedAt: inspection.rawValue, notes: 'unchanged' }],
    }
    const before = JSON.stringify(document)

    const details = openItemDetailsSurface(0)
    const inspector = inspectItemDetailsSurface(details, inspection)
    returnToItemDetails(inspector)
    closeItemDetailsSurface()

    expect(JSON.stringify(document)).toBe(before)
    expect(document.releases[0]?.releasedAt).toBe(inspection.rawValue)
  })
})

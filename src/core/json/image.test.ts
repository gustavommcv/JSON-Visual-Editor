import { describe, expect, it } from 'vitest'

import {
  detectImageCandidate,
  getImagePreviewState,
  MAX_DATA_IMAGE_LENGTH,
} from './image'

describe('detectImageCandidate', () => {
  it.each([
    'https://example.com/photo.jpg',
    'http://cdn.example.com/image.WEBP',
    'https://example.com/path/art.svg',
  ])('detects a common image URL: %s', (value) => {
    expect(detectImageCandidate(value)).toMatchObject({
      source: value,
      kind: 'remote',
      referrerPolicy: 'no-referrer',
    })
  })

  it('detects the extension before the query string', () => {
    const value = 'https://example.com/photo.png?width=640&token=abc#preview'
    expect(detectImageCandidate(value)).toMatchObject({ source: value, kind: 'remote' })
  })

  it('accepts a reasonably sized raster data image', () => {
    const value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    expect(detectImageCandidate(value)).toEqual({
      source: value,
      kind: 'data',
      referrerPolicy: null,
    })
  })

  it.each([
    'not a url',
    'https://example.com/document.pdf',
    'https://example.com/page-without-extension',
    'ftp://example.com/photo.png',
    'data:image/svg+xml,<svg></svg>',
  ])('rejects a value that should not be previewed: %s', (value) => {
    expect(detectImageCandidate(value)).toBeNull()
  })

  it('rejects an excessively large data image', () => {
    const value = `data:image/png;base64,${'A'.repeat(MAX_DATA_IMAGE_LENGTH)}`
    expect(detectImageCandidate(value)).toBeNull()
  })

  it('represents a loading failure without reclassifying or changing the URL', () => {
    const value = 'https://example.com/unavailable.jpg'
    expect(getImagePreviewState(value, false)).toBe('ready')
    expect(getImagePreviewState(value, true)).toBe('error')
    expect(value).toBe('https://example.com/unavailable.jpg')
  })

  it('keeps an ordinary string hidden from the preview', () => {
    expect(getImagePreviewState('vacation photo', false)).toBe('hidden')
  })
})

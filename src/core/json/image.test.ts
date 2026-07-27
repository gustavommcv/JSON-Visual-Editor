import { describe, expect, it } from 'vitest'

import {
  detectImageCandidate,
  getImagePreviewState,
  MAX_DATA_IMAGE_LENGTH,
} from './image'

describe('detectImageCandidate', () => {
  it.each([
    'https://example.com/foto.jpg',
    'http://cdn.example.com/imagem.WEBP',
    'https://example.com/caminho/arte.svg',
  ])('detecta URL comum de imagem: %s', (value) => {
    expect(detectImageCandidate(value)).toMatchObject({
      source: value,
      kind: 'remote',
      referrerPolicy: 'no-referrer',
    })
  })

  it('detecta extensão antes da query string', () => {
    const value = 'https://example.com/foto.png?width=640&token=abc#preview'
    expect(detectImageCandidate(value)).toMatchObject({ source: value, kind: 'remote' })
  })

  it('aceita data image raster de tamanho razoável', () => {
    const value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    expect(detectImageCandidate(value)).toEqual({
      source: value,
      kind: 'data',
      referrerPolicy: null,
    })
  })

  it.each([
    'não é uma url',
    'https://example.com/documento.pdf',
    'https://example.com/pagina-sem-extensao',
    'ftp://example.com/foto.png',
    'data:image/svg+xml,<svg></svg>',
  ])('rejeita valor que não deve ser pré-visualizado: %s', (value) => {
    expect(detectImageCandidate(value)).toBeNull()
  })

  it('rejeita data image excessivamente grande', () => {
    const value = `data:image/png;base64,${'A'.repeat(MAX_DATA_IMAGE_LENGTH)}`
    expect(detectImageCandidate(value)).toBeNull()
  })

  it('representa falha de carregamento sem reclassificar ou alterar a URL', () => {
    const value = 'https://example.com/indisponivel.jpg'
    expect(getImagePreviewState(value, false)).toBe('ready')
    expect(getImagePreviewState(value, true)).toBe('error')
    expect(value).toBe('https://example.com/indisponivel.jpg')
  })

  it('mantém string comum sem pré-visualização', () => {
    expect(getImagePreviewState('foto de férias', false)).toBe('hidden')
  })
})

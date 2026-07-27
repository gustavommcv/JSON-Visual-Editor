const IMAGE_EXTENSIONS = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
])

const SAFE_DATA_IMAGE_MIME_TYPES = new Set([
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export const MAX_DATA_IMAGE_LENGTH = 1_000_000
const MAX_REMOTE_URL_LENGTH = 4_096

export interface ImageCandidate {
  source: string
  kind: 'remote' | 'data'
  referrerPolicy: 'no-referrer' | null
}

export type ImagePreviewState = 'hidden' | 'ready' | 'error'

function getPathExtension(pathname: string): string | null {
  const segments = pathname.split('/')
  const lastSegment = segments[segments.length - 1]
  if (!lastSegment) return null
  const dotIndex = lastSegment.lastIndexOf('.')
  if (dotIndex < 0 || dotIndex === lastSegment.length - 1) return null
  return lastSegment.slice(dotIndex + 1).toLocaleLowerCase('en-US')
}

function detectRemoteImage(value: string): ImageCandidate | null {
  if (value.length > MAX_REMOTE_URL_LENGTH || value.trim() !== value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    const extension = getPathExtension(url.pathname)
    if (!extension || !IMAGE_EXTENSIONS.has(extension)) return null

    return { source: value, kind: 'remote', referrerPolicy: 'no-referrer' }
  } catch {
    return null
  }
}

function detectDataImage(value: string): ImageCandidate | null {
  if (!value.startsWith('data:image/') || value.length > MAX_DATA_IMAGE_LENGTH) return null

  const separatorIndex = value.indexOf(',')
  if (separatorIndex < 0) return null

  const metadata = value.slice(5, separatorIndex).toLocaleLowerCase('en-US')
  const mimeType = metadata.split(';')[0]
  if (!mimeType || !SAFE_DATA_IMAGE_MIME_TYPES.has(mimeType)) return null

  const payload = value.slice(separatorIndex + 1)
  if (payload.length === 0) return null

  return { source: value, kind: 'data', referrerPolicy: null }
}

export function detectImageCandidate(value: string): ImageCandidate | null {
  return value.startsWith('data:') ? detectDataImage(value) : detectRemoteImage(value)
}

export function getImagePreviewState(value: string, hasFailed: boolean): ImagePreviewState {
  if (!detectImageCandidate(value)) return 'hidden'
  return hasFailed ? 'error' : 'ready'
}

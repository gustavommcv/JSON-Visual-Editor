import type { JsonPrimitive } from './types'

export type JsonSemanticKind =
  | 'date'
  | 'date-time'
  | 'timestamp'
  | 'url'
  | 'image'
  | 'animated-image'
  | 'video'
  | 'color'
  | 'email'
  | 'uuid'
  | 'long-text'
  | 'embedded-json'
  | 'git-url'

export interface JsonSemanticDetail {
  label: string
  value: string
}

export interface JsonSemanticValue {
  kind: JsonSemanticKind
  label: string
  summary: string
  details: JsonSemanticDetail[]
  safeHref?: string
  mediaSource?: string
  mediaKind?: 'remote' | 'data'
  embeddedValue?: unknown
}

const MAX_URL_LENGTH = 4_096
const MAX_DATA_IMAGE_LENGTH = 1_000_000
const MAX_EMBEDDED_JSON_LENGTH = 20_000
const LONG_TEXT_LENGTH = 240
const MAX_CACHE_ENTRIES = 1_000
const MAX_CACHEABLE_VALUE_LENGTH = 20_000
const IMAGE_EXTENSIONS = new Set(['apng', 'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mov'])
const SAFE_DATA_IMAGE_MIME_TYPES = new Set([
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const GIT_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org'])
const semanticCache = new Map<string, JsonSemanticValue | null>()

function cacheResult(key: string, result: JsonSemanticValue | null): JsonSemanticValue | null {
  if (semanticCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = semanticCache.keys().next().value
    if (oldest !== undefined) semanticCache.delete(oldest)
  }
  semanticCache.set(key, result)
  return result
}

function extensionOf(pathname: string): string | null {
  const segments = pathname.split('/')
  const name = segments[segments.length - 1]
  const dot = name?.lastIndexOf('.') ?? -1
  return !name || dot < 0 || dot === name.length - 1
    ? null
    : name.slice(dot + 1).toLocaleLowerCase('en-US')
}

function formatApproximateSize(value: string): string {
  const units = value.length
  return units < 1_000 ? `${units} B` : `~${(units / 1_000).toFixed(units < 10_000 ? 1 : 0)} kB`
}

function detectDataImage(value: string): JsonSemanticValue | null {
  if (!value.startsWith('data:image/') || value.length > MAX_DATA_IMAGE_LENGTH) return null
  const comma = value.indexOf(',')
  if (comma < 0) return null
  const mimeType = value.slice(5, comma).split(';')[0]?.toLocaleLowerCase('en-US')
  if (!mimeType || !SAFE_DATA_IMAGE_MIME_TYPES.has(mimeType) || comma === value.length - 1) return null
  const animated = mimeType === 'image/gif' || mimeType === 'image/apng'
  return {
    kind: animated ? 'animated-image' : 'image',
    label: animated ? 'Animated image' : 'Image',
    summary: `${mimeType} · embedded data`,
    details: [
      { label: 'MIME type', value: mimeType },
      { label: 'Approx. encoded size', value: formatApproximateSize(value) },
      { label: 'Source', value: 'Embedded in this JSON value' },
    ],
    mediaSource: value,
    mediaKind: 'data',
  }
}

function detectUrl(value: string): JsonSemanticValue | null {
  if (value.length > MAX_URL_LENGTH || value.trim() !== value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const extension = extensionOf(url.pathname)
  const safePath = `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`
  const commonDetails: JsonSemanticDetail[] = [
    { label: 'Host', value: url.hostname },
    { label: 'Protocol', value: url.protocol.slice(0, -1).toUpperCase() },
    { label: 'Path', value: url.pathname || '/' },
  ]

  if (extension && IMAGE_EXTENSIONS.has(extension)) {
    const animated = extension === 'gif' || extension === 'apng'
    return {
      kind: animated ? 'animated-image' : 'image',
      label: animated ? 'Animated image' : 'Image',
      summary: safePath,
      details: [...commonDetails, { label: 'Format', value: extension.toUpperCase() }],
      safeHref: value,
      mediaSource: value,
      mediaKind: 'remote',
    }
  }

  if (extension && VIDEO_EXTENSIONS.has(extension)) {
    return {
      kind: 'video',
      label: 'Video',
      summary: safePath,
      details: [...commonDetails, { label: 'Format', value: extension.toUpperCase() }],
      safeHref: value,
      mediaSource: value,
      mediaKind: 'remote',
    }
  }

  const isGit = GIT_HOSTS.has(url.hostname.toLocaleLowerCase('en-US')) || url.pathname.endsWith('.git')
  return {
    kind: isGit ? 'git-url' : 'url',
    label: isGit ? 'Git repository' : 'URL',
    summary: safePath,
    details: commonDetails,
    safeHref: value,
  }
}

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function detectDate(value: string): JsonSemanticValue | null {
  if (validIsoDate(value)) {
    const date = new Date(`${value}T00:00:00.000Z`)
    return {
      kind: 'date',
      label: 'Date',
      summary: date.toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' }),
      details: [
        { label: 'ISO date', value },
        { label: 'Weekday', value: date.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' }) },
        { label: 'Time zone', value: 'Date only (no time zone)' },
      ],
    }
  }

  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !validIsoDate(value.slice(0, 10)) ||
    !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  ) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  return {
    kind: 'date-time',
    label: 'Date & time',
    summary: date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }),
    details: [
      { label: 'UTC', value: date.toISOString() },
      { label: 'Local time', value: date.toLocaleString() },
      { label: 'Unix time', value: String(Math.floor(timestamp / 1_000)) },
    ],
  }
}

function detectTimestamp(value: number): JsonSemanticValue | null {
  if (!Number.isInteger(value)) return null
  const milliseconds = value >= 946_684_800_000 && value <= 4_102_444_800_000
    ? value
    : value >= 946_684_800 && value <= 4_102_444_800
      ? value * 1_000
      : null
  if (milliseconds === null) return null
  const date = new Date(milliseconds)
  return {
    kind: 'timestamp',
    label: 'Timestamp',
    summary: date.toLocaleString(),
    details: [
      { label: 'UTC', value: date.toISOString() },
      { label: 'Unit', value: value === milliseconds ? 'Milliseconds' : 'Seconds' },
      { label: 'Local time', value: date.toLocaleString() },
    ],
  }
}

function detectColor(value: string): JsonSemanticValue | null {
  if (value.length > 100) return null
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)
  const functional = /^(?:rgb|hsl)a?\(\s*[-\d.%]+(?:\s*[,/]?\s*[-\d.%]+){2,3}\s*\)$/i.test(value)
  if (!hex && !functional) return null
  return {
    kind: 'color',
    label: 'Color',
    summary: value.toUpperCase(),
    details: [
      { label: 'CSS value', value },
      { label: 'Format', value: hex ? 'Hexadecimal' : value.slice(0, value.indexOf('(')).toUpperCase() },
    ],
  }
}

function detectEmbeddedJson(value: string): JsonSemanticValue | null {
  if (value.length > MAX_EMBEDDED_JSON_LENGTH || !/^[\[{]/.test(value.trim())) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed === null || typeof parsed !== 'object') return null
    const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
    return {
      kind: 'embedded-json',
      label: 'Embedded JSON',
      summary: `${Array.isArray(parsed) ? 'Array' : 'Object'} · ${count} ${count === 1 ? 'entry' : 'entries'}`,
      details: [
        { label: 'Root type', value: Array.isArray(parsed) ? 'Array' : 'Object' },
        { label: 'Approx. text size', value: formatApproximateSize(value) },
      ],
      embeddedValue: parsed,
    }
  } catch {
    return null
  }
}

function detectString(value: string): JsonSemanticValue | null {
  const dataImage = detectDataImage(value)
  if (dataImage) return dataImage
  const date = detectDate(value)
  if (date) return date
  const url = detectUrl(value)
  if (url) return url
  const color = detectColor(value)
  if (color) return color
  if (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    const domain = value.slice(value.lastIndexOf('@') + 1)
    return {
      kind: 'email',
      label: 'Email address',
      summary: value,
      details: [{ label: 'Domain', value: domain }],
      safeHref: `mailto:${value}`,
    }
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return {
      kind: 'uuid',
      label: 'UUID',
      summary: value,
      details: [{ label: 'Version', value: value[14] ?? 'Unknown' }],
    }
  }
  const embedded = detectEmbeddedJson(value)
  if (embedded) return embedded
  if (value.length >= LONG_TEXT_LENGTH || value.split('\n').length >= 4) {
    const lineCount = value.split('\n').length
    return {
      kind: 'long-text',
      label: 'Long text',
      summary: `${value.length.toLocaleString()} characters · ${lineCount.toLocaleString()} ${lineCount === 1 ? 'line' : 'lines'}`,
      details: [
        { label: 'Characters', value: value.length.toLocaleString() },
        { label: 'Lines', value: lineCount.toLocaleString() },
        { label: 'Approx. size', value: formatApproximateSize(value) },
      ],
    }
  }
  return null
}

export function detectJsonSemanticValue(value: JsonPrimitive): JsonSemanticValue | null {
  if (typeof value === 'number') return detectTimestamp(value)
  if (typeof value !== 'string' || value.length === 0) return null
  if (value.length > MAX_CACHEABLE_VALUE_LENGTH) return detectString(value)
  const cached = semanticCache.get(value)
  if (cached !== undefined) return cached
  return cacheResult(value, detectString(value))
}

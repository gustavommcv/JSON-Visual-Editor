import {
  getEditedJsonDownloadName,
  prepareJsonExport,
  type JsonFormatting,
} from '@/core/json/exporter'
import type { JsonValue } from '@/core/json/types'

export type JsonDownloadResult =
  | { ok: true; fileName: string; contents: string }
  | { ok: false; error: string }

export function downloadJson(
  value: JsonValue,
  fileName: string,
  formatting: JsonFormatting,
): JsonDownloadResult {
  const prepared = prepareJsonExport(value, formatting)
  if (!prepared.ok) return prepared

  const downloadName = getEditedJsonDownloadName(fileName)
  const blob = new Blob([prepared.contents], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = downloadName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)

  return { ok: true, fileName: downloadName, contents: prepared.contents }
}

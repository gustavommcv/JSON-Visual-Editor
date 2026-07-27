import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('English application language', () => {
  it('declares English as the document language and uses English metadata', () => {
    const html = readSource('../index.html')

    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Open and understand JSON files visually')
  })

  it('keeps the major application screens in English', () => {
    expect(readSource('./App.vue')).toContain('Understand your data.')
    expect(readSource('./features/import/JsonDropzone.vue')).toContain('Choose or drop a JSON file')
    expect(readSource('./features/editor/JsonDocumentEditor.vue')).toContain('Compare changes')
    expect(readSource('./features/search/JsonSearchPanel.vue')).toContain('No results found')
    expect(readSource('./features/comparison/JsonComparisonPanel.vue')).toContain('Structural comparison')
    expect(readSource('./features/export/JsonExportPanel.vue')).toContain('Download JSON')
  })

  it('keeps major accessible names in English', () => {
    expect(readSource('./App.vue')).toContain('aria-label="Close error message"')
    expect(readSource('./features/import/JsonDropzone.vue')).toContain(
      'aria-label="Choose or drop a JSON file"',
    )
    expect(readSource('./features/editor/PathBreadcrumb.vue')).toContain(
      'aria-label="Current path"',
    )
    expect(readSource('./features/editor/JsonDocumentEditor.vue')).toContain(
      'aria-label="History and comparison"',
    )
    expect(readSource('./features/export/JsonExportPanel.vue')).toContain(
      'aria-label="Close download dialog"',
    )
  })
})

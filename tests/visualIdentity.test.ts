import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function cssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
}

describe('JSON mark visual identity', () => {
  const app = readSource('../src/App.vue')
  const importedDocument = readSource('../src/features/import/ImportedDocument.vue')
  const component = readSource('../src/components/JsonMark.vue')
  const css = readSource('../src/styles/base.css')
  const favicon = readSource('../public/favicon-dark.svg')
  const html = readSource('../index.html')

  it('shares one vector component between the header and imported document identity', () => {
    expect(app).toContain("import JsonMark from '@/components/JsonMark.vue'")
    expect(app).toContain('<JsonMark class="brand__mark" />')
    expect(importedDocument).toContain("import JsonMark from '@/components/JsonMark.vue'")
    expect(importedDocument).toContain('<JsonMark class="file-mark" />')
  })

  it('resolves the header mark through light and dark theme color tokens', () => {
    const lightTokens = cssBlock(css, ':root')
    const darkTokens = cssBlock(css, "[data-theme='dark']")

    expect(lightTokens).toContain('--green: #265c45;')
    expect(lightTokens).toContain('--green-soft: #e2f4d2;')
    expect(lightTokens).toContain('--json-mark-surface: var(--green-soft);')
    expect(lightTokens).toContain('--json-mark-glyph: var(--green);')
    expect(darkTokens).toContain('--green: #5ecb92;')
    expect(darkTokens).toContain('--green-soft: #1f3b2c;')
    expect(component).toContain('class="json-mark__surface"')
    expect(component).toContain('class="json-mark__glyph"')
  })

  it('keeps the favicon on the dark palette and the same vector geometry', () => {
    const componentPath = component.match(/<path[\s\S]*?d="([^"]+)"/)?.[1]
    const faviconPath = favicon.match(/<path[\s\S]*?d="([^"]+)"/)?.[1]

    expect(favicon).toContain('fill="#1f3b2c"')
    expect(favicon).toContain('stroke="#5ecb92"')
    expect(faviconPath).toBe(componentPath)
    expect(favicon).not.toContain('var(--')
  })

  it('uses only the cache-busted favicon asset in icons and social metadata', () => {
    expect(html).toContain('rel="icon" type="image/svg+xml" sizes="any" href="/favicon-dark.svg"')
    expect(html).toContain('/JSON-Visual-Editor/favicon-dark.svg')
    expect(html).not.toContain('/favicon.svg')
    expect(existsSync(new URL('../public/favicon-dark.svg', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../public/favicon.svg', import.meta.url))).toBe(false)
  })
})

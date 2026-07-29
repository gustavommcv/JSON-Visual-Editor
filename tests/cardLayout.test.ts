import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function cssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
}

describe('collection card layout', () => {
  const component = readSource('../src/features/editor/JsonValueEditor.vue')
  const css = readSource('../src/styles/base.css')

  it('contains card layout and paint overflow inside the scrollable workspace', () => {
    const workspace = cssBlock(css, '.editor-workspace')

    expect(workspace).toContain('contain: layout paint inline-size;')
    expect(workspace).toContain('overflow: auto;')
  })

  it('keeps the native details body in normal flow while its card is open', () => {
    expect(component).toMatch(
      /<details[\s\S]*?class="collection-editor"[\s\S]*?<summary>[\s\S]*?<\/summary>\s*<div class="collection-editor__body">/,
    )
    expect(cssBlock(css, '.collection-editor__body')).not.toContain('display: none;')
  })

  it('keeps legitimate workspace scrolling enabled without hiding page overflow', () => {
    expect(cssBlock(css, '.editor-workspace')).toContain('overflow: auto;')
    expect(cssBlock(css, 'html')).not.toMatch(/overflow(?:-y)?:\s*hidden/)
    expect(cssBlock(css, 'body')).not.toMatch(/overflow(?:-y)?:\s*hidden/)
  })
})

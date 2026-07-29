import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function cssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
}

describe('fixed auto-save indicator', () => {
  const app = readSource('../src/App.vue')
  const component = readSource('../src/components/AutoSaveIndicator.vue')
  const css = readSource('../src/styles/base.css')

  it('stays viewport-fixed only while the document has unexported changes', () => {
    expect(app).toContain('v-if="document && hasUnexportedChanges"')
    expect(cssBlock(css, '.auto-save-indicator')).toContain('position: fixed;')
    expect(cssBlock(css, '.auto-save-indicator')).toContain('bottom: max(14px, env(safe-area-inset-bottom));')
    expect(cssBlock(css, '.app-shell--with-auto-save')).toContain('padding-bottom: 68px;')
    expect(cssBlock(css, 'html')).toContain('scroll-padding-bottom: 80px;')
    expect(cssBlock(css, '.editor-workspace')).toContain('scroll-padding-bottom: 80px;')
  })

  it('uses token-based styling and does not intercept editor clicks in normal states', () => {
    const indicator = cssBlock(css, '.auto-save-indicator')
    expect(indicator).toContain('color: var(--muted);')
    expect(indicator).toContain('background: var(--paper);')
    expect(indicator).toContain('border: 1px solid var(--line);')
    expect(indicator).toContain('pointer-events: none;')
  })

  it('provides saving, saved, local, and keyboard-accessible failure feedback', () => {
    expect(component).toContain("case 'saving': return 'Saving…'")
    expect(component).toContain("case 'saved': return 'Saved'")
    expect(component).toContain("case 'local': return 'Auto-saved locally'")
    expect(component).toContain('role="tooltip"')
    expect(component).toContain('tabindex="0"')
    expect(css).toContain('.auto-save-indicator__state--failed:focus-visible .auto-save-indicator__tooltip')
  })
})

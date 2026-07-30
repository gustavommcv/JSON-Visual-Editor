import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('contextual semantic inspector', () => {
  const primitiveEditor = readSource('../src/features/editor/JsonPrimitiveEditor.vue')
  const inspector = readSource('../src/features/editor/SemanticInspector.vue')
  const documentEditor = readSource('../src/features/editor/JsonDocumentEditor.vue')
  const css = readSource('../src/styles/base.css')

  it('keeps the raw typed editor authoritative and adds interpretation separately', () => {
    expect(primitiveEditor).toContain('<textarea')
    expect(primitiveEditor).toContain('<SemanticBadge')
    expect(primitiveEditor).not.toContain("import ImagePreview")
    expect(documentEditor).toContain('@operation="handleOperation"')
    expect(documentEditor).toContain('@inspect-semantic="inspectSemantic"')
  })

  it('requires explicit consent before creating remote media', () => {
    expect(inspector).toContain('const mediaRequested = ref(false)')
    expect(inspector).toContain("props.semantic.mediaKind === 'data' || mediaRequested.value")
    expect(inspector).toContain('v-if="shouldShowMedia && !mediaFailed"')
    expect(inspector).toContain('@click="mediaRequested = true"')
    expect(inspector).toContain('Load preview')
  })

  it('hardens outbound links and never embeds arbitrary pages', () => {
    expect(inspector).toContain('rel="noopener noreferrer"')
    expect(inspector).toContain('referrerpolicy="no-referrer"')
    expect(inspector).not.toContain('<iframe')
    expect(inspector).not.toContain('v-html')
  })

  it('uses a side inspector on desktop and a bottom sheet on smaller viewports', () => {
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(280px, 330px);')
    expect(css).toContain('@media (max-width: 880px)')
    expect(css).toContain('max-height: min(82dvh, 760px);')
    expect(css).toContain('.inspector-backdrop')
    expect(inspector).toContain(":role=\"isCompactViewport ? 'dialog' : 'complementary'\"")
    expect(inspector).toContain("event.key !== 'Tab' || !isCompactViewport.value")
  })

  it('ships a coherent fixture covering the semantic renderer set', () => {
    const fixture = JSON.parse(readSource('../public/samples/semantic-showcase.json')) as Record<string, unknown>
    expect(fixture).toMatchObject({
      publishedOn: '2026-07-30',
      supportEmail: 'support@example.com',
      repository: 'https://github.com/example/atlas',
    })
    expect(fixture).toHaveProperty('brand.primaryColor')
    expect(fixture).toHaveProperty('brand.demoVideo')
    expect(fixture).toHaveProperty('embeddedConfig')
  })
})

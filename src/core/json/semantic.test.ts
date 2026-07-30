import { describe, expect, it } from 'vitest'

import { detectJsonSemanticValue } from './semantic'

describe('detectJsonSemanticValue', () => {
  it.each([
    ['2026-07-30', 'date'],
    ['2026-07-30T15:14:13Z', 'date-time'],
    [1_786_000_000, 'timestamp'],
    ['https://example.com/docs', 'url'],
    ['https://example.com/photo.webp?token=secret', 'image'],
    ['https://example.com/demo.webm', 'video'],
    ['https://github.com/example/project', 'git-url'],
    ['#4f8a70', 'color'],
    ['person@example.com', 'email'],
    ['f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'uuid'],
    ['{"enabled":true}', 'embedded-json'],
    ['A long field\nwith several lines\nthat should remain editable\nand gain a compact interpretation.', 'long-text'],
  ] as const)('detects %s as %s', (value, kind) => {
    expect(detectJsonSemanticValue(value)?.kind).toBe(kind)
  })

  it('distinguishes animated and embedded images', () => {
    expect(detectJsonSemanticValue('https://example.com/loop.gif')?.kind).toBe('animated-image')
    expect(detectJsonSemanticValue('data:image/png;base64,iVBORw0KGgo=')).toMatchObject({
      kind: 'image',
      mediaKind: 'data',
    })
  })

  it.each(['not a semantic value', '2026-02-31', 'javascript:alert(1)', 'ftp://example.com/a.png'])
  ('does not over-detect %s', (value) => {
    expect(detectJsonSemanticValue(value)).toBeNull()
  })

  it('does not expose credentials or query parameters in derived URL metadata', () => {
    const semantic = detectJsonSemanticValue('https://user:password@example.com/photo.png?token=secret')
    expect(JSON.stringify(semantic?.details)).not.toContain('password')
    expect(JSON.stringify(semantic?.details)).not.toContain('secret')
    expect(semantic?.summary).toBe('example.com/photo.png')
  })
})

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const SITE_URL = 'https://gustavommcv.github.io/JSON-Visual-Editor/'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('search engine discoverability', () => {
  const html = readSource('../index.html')

  it('declares a canonical URL and an indexable robots policy', () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}" />`)
    expect(html).toContain('<meta name="robots" content="index, follow" />')
  })

  it('has a descriptive title', () => {
    expect(html).toMatch(/<title>[^<]*JSON Visual Editor[^<]*<\/title>/)
  })

  it('provides complete Open Graph metadata for link previews', () => {
    expect(html).toContain('<meta property="og:type" content="website" />')
    expect(html).toContain('<meta property="og:site_name" content="JSON Visual Editor" />')
    expect(html).toMatch(/<meta property="og:title" content="[^"]+" \/>/)
    expect(html).toMatch(/<meta\s+property="og:description"\s+content="[^"]+"\s*\/>/)
    expect(html).toContain(`<meta property="og:url" content="${SITE_URL}" />`)
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}favicon.svg" />`)
  })

  it('provides a Twitter Card matching the Open Graph image', () => {
    expect(html).toContain('<meta name="twitter:card" content="summary" />')
    expect(html).toMatch(/<meta name="twitter:title" content="[^"]+" \/>/)
    expect(html).toContain(`<meta name="twitter:image" content="${SITE_URL}favicon.svg" />`)
  })

  it('embeds well-formed WebApplication structured data', () => {
    const match = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )
    expect(match).not.toBeNull()

    const data: unknown = JSON.parse(match?.[1] ?? '')
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'JSON Visual Editor',
      url: SITE_URL,
    })
  })

  it('ships a robots.txt that allows crawling and references the sitemap', () => {
    const robots = readSource('../public/robots.txt')
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/m)
    expect(robots).toContain(`Sitemap: ${SITE_URL}sitemap.xml`)
  })

  it('ships a sitemap.xml listing the main page', () => {
    const sitemap = readSource('../public/sitemap.xml')
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(sitemap).toContain(`<loc>${SITE_URL}</loc>`)
  })
})

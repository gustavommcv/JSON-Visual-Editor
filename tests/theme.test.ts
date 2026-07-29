import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY, useTheme } from '@/composables/useTheme'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const initializer = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]

if (!initializer) throw new Error('The pre-render theme initializer is missing from index.html.')

function runThemeInitializer(storedTheme: string | null, operatingSystemPrefersDark = false) {
  let appliedTheme: string | null = null
  let themeColor: string | null = null
  const getItem = vi.fn(() => storedTheme)
  const setItem = vi.fn()
  const matchMedia = vi.fn(() => ({ matches: operatingSystemPrefersDark }))

  runInNewContext(initializer, {
    window: { matchMedia },
    localStorage: { getItem, setItem },
    document: {
      documentElement: {
        setAttribute: (_name: string, value: string) => {
          appliedTheme = value
        },
      },
      querySelector: () => ({
        setAttribute: (_name: string, value: string) => {
          themeColor = value
        },
      }),
    },
  })

  return { appliedTheme, themeColor, getItem, setItem, matchMedia }
}

afterEach(() => vi.unstubAllGlobals())

describe('initial theme', () => {
  it('starts a new user in light mode even when the operating system prefers dark', () => {
    const result = runThemeInitializer(null, true)

    expect(result.appliedTheme).toBe('light')
    expect(result.themeColor).toBe('#f6f7f2')
    expect(result.matchMedia).not.toHaveBeenCalled()
    expect(result.setItem).not.toHaveBeenCalled()
  })

  it.each(['light', 'dark'] as const)(
    'restores the saved %s preference without overwriting it',
    (savedTheme) => {
      const result = runThemeInitializer(savedTheme, savedTheme === 'light')

      expect(result.appliedTheme).toBe(savedTheme)
      expect(result.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY)
      expect(result.setItem).not.toHaveBeenCalled()
    },
  )

  it('falls back safely to light when the saved value is not a supported theme', () => {
    expect(runThemeInitializer('system', true).appliedTheme).toBe('light')
  })
})

describe('theme persistence', () => {
  function mountTheme(initialTheme: 'light' | 'dark') {
    const attributes = new Map<string, string>([['data-theme', initialTheme]])
    const setItem = vi.fn()
    const setThemeColor = vi.fn()

    vi.stubGlobal('document', {
      documentElement: {
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
      querySelector: () => ({ setAttribute: setThemeColor }),
    })
    vi.stubGlobal('localStorage', { setItem })

    return { ...useTheme(), attributes, setItem, setThemeColor }
  }

  it('persists dark mode and restores it on the next initialization', () => {
    const mounted = mountTheme('light')

    mounted.toggleTheme()

    expect(mounted.theme.value).toBe('dark')
    expect(mounted.attributes.get('data-theme')).toBe('dark')
    expect(mounted.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark')
    expect(mounted.setThemeColor).toHaveBeenCalledWith('content', '#101713')
    expect(runThemeInitializer('dark').appliedTheme).toBe('dark')
  })

  it('persists light mode and restores it on the next initialization', () => {
    const mounted = mountTheme('dark')

    mounted.toggleTheme()

    expect(mounted.theme.value).toBe('light')
    expect(mounted.attributes.get('data-theme')).toBe('light')
    expect(mounted.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light')
    expect(mounted.setThemeColor).toHaveBeenCalledWith('content', '#f6f7f2')
    expect(runThemeInitializer('light', true).appliedTheme).toBe('light')
  })
})

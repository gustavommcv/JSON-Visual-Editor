import { ref } from 'vue'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'json-visual-editor-theme'
const DARK_THEME_COLOR = '#101713'
const LIGHT_THEME_COLOR = '#f6f7f2'

function readAppliedTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)

  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // localStorage may be unavailable (privacy mode, disabled storage). The
    // theme still applies for this tab; it just won't be remembered.
  }
}

export function useTheme() {
  // index.html runs a blocking inline script before first paint that reads
  // localStorage (falling back to light for a new user) and sets
  // data-theme on <html>. Reading it back here keeps that one script as the
  // single source of truth for the initial value instead of re-deriving it.
  const theme = ref<Theme>(readAppliedTheme())

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme(theme.value)
  }

  return { theme, toggleTheme }
}

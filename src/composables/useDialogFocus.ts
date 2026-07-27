import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => element.offsetParent !== null,
  )
}

export function useDialogFocus(
  container: Ref<HTMLElement | null>,
  initialFocus: Ref<HTMLElement | null>,
) {
  let previousFocus: HTMLElement | null = null
  let fallbackFocus: HTMLElement[] = []

  function trapFocus(event: KeyboardEvent): void {
    const dialog = container.value
    if (!dialog) return

    const focusable = getFocusableElements(dialog)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    } else if (!dialog.contains(document.activeElement)) {
      event.preventDefault()
      first.focus()
    }
  }

  onMounted(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    fallbackFocus = []

    let ancestor = previousFocus?.closest<HTMLElement>('[data-json-path]') ?? null
    while (ancestor) {
      fallbackFocus.push(ancestor)
      ancestor = ancestor.parentElement?.closest<HTMLElement>('[data-json-path]') ?? null
    }

    void nextTick(() => {
      initialFocus.value?.focus()
      if (!initialFocus.value && container.value) getFocusableElements(container.value)[0]?.focus()
    })
  })

  onBeforeUnmount(() => {
    if (previousFocus?.isConnected) {
      previousFocus.focus()
      return
    }
    fallbackFocus.find((element) => element.isConnected)?.focus()
  })

  return { trapFocus }
}

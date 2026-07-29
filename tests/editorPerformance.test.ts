import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const editorSource = readFileSync(
  new URL('../src/features/editor/JsonValueEditor.vue', import.meta.url),
  'utf8',
)

describe('large-document editor rendering', () => {
  it('does not mount nested collection bodies until their card is opened', () => {
    expect(editorSource).toContain('const bodyMounted = ref(props.depth < 2)')
    expect(editorSource).toContain('if (open) bodyMounted.value = true')
    expect(editorSource).toContain('v-if="depth === 0 || bodyMounted"')
  })

  it('memoizes unchanged object fields and array rows', () => {
    expect(editorSource.match(/v-memo=/g)).toHaveLength(4)
    expect(editorSource).toContain('index === objectEntries.length - 1')
    expect(editorSource).toContain('rowIndex === arrayValue.length - 1')
  })
})

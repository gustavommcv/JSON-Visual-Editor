# Project structure

This is a file-level map of `src/`, grouped the way [Architecture overview](../architecture/overview.md) describes the layers. Paths are relative to the repository root.

```text
src/
├── App.vue                          Composition root: wires theme, document, and auto-save together
├── main.ts                          Vue app bootstrap
├── vite-env.d.ts                    Vite client type reference
├── language.test.ts                 Asserts English-only interface text and accessible names
├── seo.test.ts                      Asserts index.html/robots.txt/sitemap.xml metadata
│
├── components/
│   ├── AutoSaveIndicator.vue         Fixed-position save-status pill (pending/saving/saved/failed)
│   └── JsonMark.vue                  The shared "{ }" brand mark (header + imported-document identity)
│
├── composables/
│   ├── useJsonDocument.ts            Document state: import, operations, history, export, restore
│   ├── useAutoSave.ts                IndexedDB session persistence (see architecture/local-persistence.md)
│   ├── useTheme.ts                   Light/dark theme state, backed by localStorage
│   └── useDialogFocus.ts             Focus trap + focus restore for modal dialogs/panels
│
├── core/json/                        Domain layer — no Vue import anywhere in this folder
│   ├── types.ts                      JsonValue/JsonPath/LoadedJsonDocument types
│   ├── path.ts                       Path formatting/comparison helpers
│   ├── parser.ts                     File text → JsonValue, with typed parse errors
│   ├── analyzer.ts                   Root/array-shape analysis and view inference
│   ├── operations.ts                 Every mutation, as pure root → new-root functions
│   ├── history.ts                    Undo/redo snapshot stack with typing-grouping
│   ├── diff.ts                       Structural comparison (added/removed/changed/reordered)
│   ├── search.ts                     Recursive key/value/path search
│   ├── image.ts                      Legacy image-candidate helpers (kept regression-tested)
│   ├── semantic.ts                   Pure semantic detector and safe derived metadata
│   ├── exporter.ts                   Export validation + JSON serialization
│   ├── sessionStorage.ts             Session (de)serialization, validation, and storage-budget trimming
│   ├── sessionBudget.ts              Byte-size measurement used by the budget worker
│   └── *.test.ts                     One test file per module above
│
├── workers/
│   └── sessionBudget.worker.ts       Off-main-thread wrapper around sessionBudget.ts
│
├── features/
│   ├── import/
│   │   ├── JsonDropzone.vue           Click-or-drag file input
│   │   ├── ImportedDocument.vue        Wraps the loaded document: file identity, remove/download actions
│   │   └── ResumeSessionPrompt.vue     Modal listing recoverable/quarantined sessions on startup
│   │
│   ├── editor/
│   │   ├── JsonDocumentEditor.vue       Toolbar (undo/redo/restore/compare/download), search, workspace
│   │   ├── JsonValueEditor.vue          The recursive editor — renders itself for every nested value
│   │   ├── JsonPrimitiveEditor.vue       Typed control for string/number/boolean
│   │   ├── JsonTableCell.vue             A single editable table/card cell
│   │   ├── JsonTypePicker.vue             Type-selection form used when adding a value
│   │   ├── JsonItemDetailsPanel.vue       Side panel for editing one item/row in isolation
│   │   ├── PathBreadcrumb.vue             Renders the current path as $["a"][0]
│   │   ├── ConfirmAction.vue              Generic destructive-action confirmation dialog
│   │   ├── SemanticBadge.vue              Compact, optional interpretation control
│   │   ├── SemanticInspector.vue          Contextual desktop/mobile interpretation panel
│   │   ├── contextualSurface.ts            Pure Item Details → inspector navigation state
│   │   ├── ImagePreview.vue               Legacy image preview component (not in the active editor path)
│   │   └── useSearchHighlight.ts          Highlight/scroll/focus behavior for search + comparison navigation
│   │
│   ├── search/
│   │   └── JsonSearchPanel.vue           Search input + debouncing + results list
│   │
│   ├── comparison/
│   │   └── JsonComparisonPanel.vue        Structural diff panel with per-change navigation
│   │
│   └── export/
│       ├── JsonExportPanel.vue            Download dialog (formatted/compact choice)
│       └── downloadJson.ts                 Blob + object-URL download helper
│
└── styles/
    └── base.css                          The application's only stylesheet (theming, layout, a11y)
```

## Tests outside `src/core/json`

[`tests/`](../../tests) at the repository root holds tests that need more than one module or exercise component/CSS-level behavior: `useAutoSave.test.ts`, `autoSaveIndicator.test.ts`, `cardLayout.test.ts`, `editorPerformance.test.ts`, `searchHighlight.test.ts`, `theme.test.ts`, and `visualIdentity.test.ts`. See [Testing](testing.md) for what each covers.

## Other top-level paths

| Path | Purpose |
|---|---|
| `index.html` | Vite entry HTML — SEO/social metadata and the inline pre-paint theme script (see [Editor model](../architecture/editor-model.md)). |
| `public/` | Static files copied as-is into the build: favicon, `robots.txt`, `sitemap.xml`, and a Google Search Console verification file. |
| `.github/workflows/deploy-pages.yml` | Builds and deploys `dist/` to GitHub Pages on push to `main`. See [Deployment](../deployment.md). |
| `vite.config.ts`, `tsconfig*.json`, `eslint.config.js` | Build, type-checking, and lint configuration — see [Code quality](code-quality.md). |
| `scripts/` | Present in the repository but currently empty; nothing references it. |
| `dist/` | Build output. Git-ignored, not part of the source tree. |

## Import alias

`@/*` resolves to `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`) — for example, `@/core/json/operations` instead of a relative `../../core/json/operations`.

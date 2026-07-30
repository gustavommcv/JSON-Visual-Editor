# JSON Visual Editor

A browser-based application for importing, understanding, editing, comparing, and exporting JSON documents visually — without hand-editing raw JSON syntax.

Point it at any `.json` file and it infers a sensible way to display each part of it (a form for an object, a table or cards for an array), lets you edit values and structure directly, and tracks what changed against the file you started with. There's no backend: everything runs in your browser, and your file is never uploaded — see [Privacy](#privacy-and-local-processing).

## Features

- Import a `.json` file by clicking or dragging it in; clear English error messages for empty files, invalid JSON, and unsafe/non-finite numbers.
- Recursive editing of objects, arrays, strings, numbers, booleans, and `null` — including at the document root.
- A **Form** view for objects and a **Table** view (with a **Cards** alternative) for arrays of similar objects; every other array uses an editable Cards list. The view is inferred from the data's actual shape, never from property names.
- Create, rename, retype, deeply duplicate, delete, and reorder properties and items, with confirmation before anything destructive.
- A stable table with a union of columns across items, explicit "missing" cells, nested-value summaries, and a details panel for inspecting one item at a time.
- Global search across property names, values, and paths, with navigation to a highlighted result.
- Content-aware badges and a contextual inspector for dates, timestamps, URLs, images/GIFs, direct video links, colors, email addresses, UUIDs, long text, embedded JSON, and Git repository URLs.
- Undo, redo (50 steps each), and one-click restoration of the originally imported document.
- A structural comparison view (added / removed / changed / reordered) against the original.
- Download the result as formatted (two-space) or compact JSON.
- Local auto-save to IndexedDB, with a resumable-session prompt on your next visit — see [Export and recovery](docs/user-guide/export-and-recovery.md) for exactly what that does and doesn't guarantee.
- A light/dark theme, keyboard shortcuts, and responsive layout (cards instead of a table below 760 px).

See the [user guide](docs/user-guide/getting-started.md) for a full walkthrough.

## Technology

- [Vue 3](https://vuejs.org/) (`<script setup>` SFCs) — the only runtime dependency.
- [Vite 7](https://vite.dev/) for the dev server and production build.
- [TypeScript](https://www.typescriptlang.org/) in strict mode throughout.
- [Vitest](https://vitest.dev/) for the test suite.
- [ESLint](https://eslint.org/) (flat config, with `typescript-eslint` and `eslint-plugin-vue`).

No state-management library, no UI/table/component kit, and no CSS framework — see [Architecture overview](docs/architecture/overview.md) for the reasoning.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 7).
- npm (bundled with Node.js).
- A modern browser with `File`, `Blob`, `URL.createObjectURL`, and JavaScript module support to *use* the built application.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Vite prints the local address to open. There's no backend and no environment variables to configure.

## Checks and tests

```bash
npm test           # Vitest suite
npm run typecheck  # vue-tsc, strict mode
npm run lint       # ESLint, zero warnings allowed
```

See [Testing](docs/development/testing.md) for how the suite is organized and [Code quality](docs/development/code-quality.md) for what the type checker and linter enforce.

## Build

```bash
npm run build    # runs typecheck, then builds dist/
npm run preview  # serves the built output locally
```

## Architecture, in brief

- `src/core/json/` — the JSON domain layer (parsing, operations, history, diff, search, export, session serialization). Plain TypeScript, no Vue dependency.
- `src/composables/` — reactive state built on that domain layer: the loaded document and its history, local auto-save, theme, dialog focus.
- `src/features/` and `src/components/` — the UI, receiving data as props and emitting typed operations rather than mutating the document directly.

Full details, a component map, and the data flow are in [Architecture overview](docs/architecture/overview.md) and [Editor model](docs/architecture/editor-model.md).

## Privacy and local processing

There is no backend and no analytics. Importing, editing, semantic detection, history, search, comparison, export, and local auto-save all happen in your browser. Remote images, GIFs, and videos are never requested automatically: their inspector asks you to load the preview first, and only then does your browser contact that media host. See [Privacy and local data](docs/user-guide/privacy-and-local-data.md) for the full picture, including exactly what's stored locally and for how long.

## Known limitations

- One document open at a time (open a second browser tab for a second document).
- Very large documents aren't virtualized, and JSON parsing/rendering run on the main thread.
- Numbers follow JavaScript's safe-integer/finite-number rules; there's no arbitrary-precision support.
- Local auto-save is a crash-recovery net, not a guarantee or a substitute for downloading your file.

The full, evidence-based list — including a known UI-state quirk in the Cards/list view after reordering — is in [Limitations](docs/limitations.md).

## Documentation

Start at [`docs/README.md`](docs/README.md) for the full documentation index (user guide, architecture, development, accessibility, deployment).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[GPL-3.0](LICENSE).

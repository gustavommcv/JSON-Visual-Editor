# JSON Visual Editor

A generic web application for importing, understanding, editing, comparing, and exporting JSON documents without working directly with JSON syntax. The document is processed locally and stays in the memory of the current browser tab.

The final MVP scope and product decisions are documented in [`docs/MVP.md`](docs/MVP.md).

## Features

- import one `.json` file by clicking or dragging and dropping;
- edit objects, arrays, strings, numbers, booleans, and `null`, including at the root;
- navigate a recursive editor with breadcrumbs, collapsible structures, and an independently scrolling workspace;
- use a form for objects, a list for simple arrays, a table for similar objects, and a tree for irregular structures;
- switch manually between compatible views;
- create, edit, change type, rename, deeply duplicate, delete, and reorder values;
- use a table with a stable union of columns, missing cells, nested summaries, and item details;
- use responsive cards instead of a table on narrow screens;
- search globally by property, value, or path and navigate to a highlighted result without changing the document;
- preview likely image values safely within the layout;
- undo, redo, and restore the original document;
- compare additions, removals, changes, and array reordering structurally;
- download formatted two-space JSON or compact JSON;
- see whether the current document has changes that have not been downloaded;
- use accessible messages, visible focus, labelled controls, and dialogs with contained and restored focus.

## Terminology

Application-owned text follows these terms consistently:

| Concept | Required term |
|---|---|
| Imported content | File |
| JSON being edited | Document |
| Object member | Property |
| JSON content at a path | Value |
| JSON map | Object |
| Ordered JSON collection | Array |
| Differences from the original | Changes |
| Reverse the last operation | Undo |
| Reapply a reversed operation | Redo |
| Return to imported content | Restore original |
| Inspect differences | Compare changes |
| Save a JSON copy | Download JSON |
| Find content | Search |
| Recursive hierarchy | Tree view |
| Rows and columns | Table view |

Names and strings inside a user's JSON are data, not interface terminology, and are never translated.

## Privacy

Your file is not sent to a server, database, or analytics service. Importing, editing, history, search, comparison, and export all happen in your browser. Unsaved state is lost when the tab is closed or reloaded.

The only possible external traffic is an optional preview of a remote image URL already present in the JSON. In that case, the browser requests the image directly from its host; the JSON document is not sent. The application does not proxy, upload, or automatically download images.

## Requirements

- Node.js 20.19+ or 22.12+;
- npm, included with standard Node.js distributions;
- a modern browser with support for `File`, `Blob`, `URL.createObjectURL`, and JavaScript modules.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Vite prints the local address. The application has no backend and requires no environment variables.

## Tests and checks

```bash
npm test
npm run typecheck
npm run lint
```

- `npm test` runs the Vitest suite;
- `npm run typecheck` checks Vue and TypeScript in strict mode;
- `npm run lint` runs ESLint without allowing warnings.

## Build

```bash
npm run build
```

The command runs the type check and generates static files in `dist/`. To inspect the production output locally:

```bash
npm run preview
```

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`. Every push to `main` installs dependencies, builds the application, and publishes only the generated `dist/` directory.

In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. The project is then available at:

```text
https://gustavommcv.github.io/JSON-Visual-Editor/
```

The Vite `base` is configured for the `/JSON-Visual-Editor/` project path. If the site later moves to a custom domain or to the root repository `gustavommcv.github.io`, change `base` back to `/`.

## Dependencies

- `vue`: the only runtime dependency, used for components and reactive interface state;
- `vite` and `@vitejs/plugin-vue`: development server and production bundling;
- `typescript` and `vue-tsc`: strict typing for the domain and components;
- `vitest`: unit tests for JSON rules;
- `eslint`, `typescript-eslint`, `eslint-plugin-vue`, and `vue-eslint-parser`: static analysis.

There is no state-management, table, upload, JSON-manipulation, or CSS library. The MVP uses Vue and native browser APIs.

## Supported formats

- input: one file with the `.json` extension at a time;
- roots: object, array, string, number, boolean, or `null`;
- output: JSON formatted with two spaces or compact JSON;
- possible images: HTTP or HTTPS URLs whose path ends in a known image extension, including URLs with query strings, and raster `data:image` values within the documented limit.

Embedded SVG `data:image` values are not loaded. A valid URL without a known image extension is not previewed automatically.

## Automatic view inference

The initial view depends only on the actual type and structure of the data:

| Structure | Initial view |
|---|---|
| Object | Form |
| Array of primitive values | Editable list |
| Array containing only objects, with at most 16 combined columns and at least 50% of those columns in every row | Table |
| Mixed, nested, or highly irregular array | Tree |
| Primitive root value | Editor for that value type |
| `null` | Explicit replacement-type picker |

Table columns follow the first appearance of each property. Names such as `title`, `image`, `category`, or `id` do not affect inference.

## Security and data-integrity decisions

- JSON paths are arrays of `string | number` segments, so dots, spaces, slashes, accents, and symbols remain literal;
- every change passes through `src/core/json/operations.ts` and produces a new root;
- renaming and creation reject duplicate property names;
- duplication uses a deep copy;
- arrays preserve exact order; object order is only a predictable presentation and has no semantic meaning;
- unsafe integers and non-finite numbers are rejected;
- type changes, root replacement, relevant deletions, and restoration require confirmation;
- document-provided HTML is never rendered;
- remote images use `referrerpolicy="no-referrer"`, links use `noopener noreferrer`, loading is lazy, and dimensions are constrained;
- export validates the current state again and serializes only the current JSON value;
- search and image heuristics never transform URLs, property names, strings, or value types;
- object URLs created for downloads are revoked after use;
- application language never changes imported filenames or JSON content.

## History and comparison

History uses immutable snapshots, with up to 50 previous states and 50 redo states. Consecutive typing in the same field within 750 ms is grouped into one step. `Ctrl+Z`/`Cmd+Z`, `Ctrl+Y`, and `Cmd+Shift+Z` work outside form fields; inside a field, the browser keeps its native text undo behavior.

Comparison walks the document structurally. Object property order is ignored, while array order is significant. A change that keeps exactly the same array elements in a different sequence is reported as a reorder.

## Architecture summary

- the JSON domain is independent of Vue;
- components emit typed operations and do not mutate the document directly;
- the document composable coordinates import, history, comparison, downloaded state, and export;
- search, selection, focus, and panel state stay only in the interface;
- shared CSS controls responsive layout, table containment, focus, contrast, and reduced motion.

## Folder structure

```text
src/
├── composables/          # document state and reusable focus management
├── core/json/            # parser, analysis, operations, history, comparison, search, and export
├── features/
│   ├── comparison/       # structural changes panel
│   ├── editor/           # recursive editor, table, types, images, and dialogs
│   ├── export/           # download configuration and browser download
│   ├── import/           # file drop zone and imported-file summary
│   └── search/           # global search and results
├── styles/               # responsive and accessible visual system
├── App.vue
└── main.ts
docs/
└── MVP.md                # scope, decisions, and final requirement status
```

## Known limitations

- one document can be open at a time;
- state exists only for the lifetime of the browser tab;
- very large documents are not virtualized or processed in a worker;
- large documents can still make snapshot history use significant memory, although history is limited;
- decimals follow JavaScript IEEE 754 precision;
- image detection can produce a false positive or a remote loading failure;
- comparison reports reordering only when the array keeps the same multiset of values;
- there is no persistence, synchronization, or collaboration.

## Future work outside the MVP

- optional JSON Schema support;
- virtualization and workers for very large files;
- an explicit arbitrary-precision number policy;
- optional local persistence;
- editing multiple files at once;
- backend services, accounts, cloud storage, and collaboration;
- external integrations and automatic publishing;
- a localization framework and language selector if additional languages are introduced.

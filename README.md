# JSON Visual Editor

A generic web application for importing, understanding, editing, comparing, and exporting JSON documents without working directly with JSON syntax. The document is processed entirely in your browser and is automatically saved to local browser storage as you edit, so it can be recovered after an accidental tab close or crash — see [Local auto-save](#local-auto-save) for exactly what that means and does not mean.

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

Your file is not sent to a server, database, or analytics service. Importing, editing, history, search, comparison, export, and auto-save all happen in your browser, using its local storage only — nothing leaves the device.

The only possible external traffic is an optional preview of a remote image URL already present in the JSON. In that case, the browser requests the image directly from its host; the JSON document is not sent. The application does not proxy, upload, or automatically download images.

## Local auto-save

The application persists your editing session to the browser's IndexedDB as you work, so it can be recovered after an accidental tab close, reload, or crash. This is a local safety net, not a save button, a sync service, or a substitute for **Download JSON** — it is the only way to get a file back out of the browser onto disk.

- **What is saved:** the original imported document, the current edited document, the last-exported snapshot (if any), and a capped slice of the undo/redo history (up to 20 entries per side, and an approximate 8 MB budget per session — the in-editor undo/redo limit of 50 steps is unaffected; only what gets persisted is trimmed, oldest-from-present first).
- **When it saves:** immediately after each edit that is actually committed to the undo stack — there is no artificial delay. A burst of rapid changes never runs more than one write at a time for the same document; if more edits arrive while a write is in progress, they are coalesced so the very next write always reflects the latest state, not an intermediate one. The tab becoming hidden or being unloaded also nudges a save attempt, but this is best-effort reinforcement, not the primary mechanism — like any unload-time work in a browser, it is not guaranteed to complete if the process is closed abruptly (killed, powered off, or crashed) rather than closed normally.
- **What is *not* saved:** a freshly imported file that has not been edited yet does not create a recoverable session.
- **Restoring a session:** on startup, before you can start a new import, the application checks local storage; if one or more recoverable sessions exist, it offers each one by filename, last-saved time, and size, letting you resume or discard each individually (never picking "the most recent" for you automatically) or dismiss the prompt for this visit without discarding anything.
- **Retention:** up to 5 recoverable sessions are kept, for up to 7 days each. A session with a current tab lease is never evicted; that can temporarily put the total above 5 until the tab closes or its lease expires. Records written by a newer app schema remain quarantined until you explicitly discard them and do not count toward the five recoverable sessions.
- **Cleanup:** restoring the original document, successfully downloading it, removing the file, or choosing Discard removes all stored JSON for that session. IndexedDB keeps a minimal deletion marker containing only a random session ID, revision, owner-tab ID, and deletion time; it contains no filename or document content and prevents an older or suspended tab from recreating the deleted session. Editing again after Restore or Download starts a new session identity.
- **Multiple documents and tabs:** each imported or resumed document gets its own independent session, identified internally and never merely by filename — two files named the same are not mixed up. Changes from two tabs are not merged. Atomic revision checks let one concurrent write win and pause auto-save in the losing tab. Revisioned deletion markers also prevent an old tab from recreating a session another tab deleted.
- **When it is unavailable:** if IndexedDB cannot be used at all (for example, some private-browsing modes), a visible notice explains that editing still works but is only retained in the current tab. Other storage failures are also reported with a specific message; a temporary failure is retried on the next edit, while a full quota stops further attempts for that session until reload.

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
- a separate composable owns local auto-save (persistence timing, session identity, retention, and multi-tab conflict detection) and wraps just the document-composable actions it needs to react to (restore, download);
- search, selection, focus, and panel state stay only in the interface;
- shared CSS controls responsive layout, table containment, focus, contrast, and reduced motion.

## Folder structure

```text
src/
├── composables/          # document state, local auto-save, and reusable focus management
├── core/json/            # parser, analysis, operations, history, comparison, search, export, and session serialization
├── features/
│   ├── comparison/       # structural changes panel
│   ├── editor/           # recursive editor, table, types, images, and dialogs
│   ├── export/           # download configuration and browser download
│   ├── import/           # file drop zone, imported-file summary, and the resume-session prompt
│   └── search/           # global search and results
├── styles/               # responsive and accessible visual system
├── App.vue
└── main.ts
docs/
└── MVP.md                # scope, decisions, and final requirement status
```

## Known limitations

- one document can be open at a time;
- local auto-save (see above) is a crash-recovery net, not a sync or backup service — it stays on one browser profile on one device; a save starts immediately on each edit, but cannot guarantee recovery of an edit whose write was still in progress at the exact moment of an abrupt process kill (killed, powered off, or crashed) — no web app can guarantee that;
- very large documents are not virtualized or processed in a worker;
- large documents can still make snapshot history use significant memory, although history is limited;
- decimals follow JavaScript IEEE 754 precision;
- image detection can produce a false positive or a remote loading failure;
- comparison reports reordering only when the array keeps the same multiset of values;
- there is no cross-device synchronization or real-time collaboration.

## Future work outside the MVP

- optional JSON Schema support;
- virtualization and workers for very large files;
- an explicit arbitrary-precision number policy;
- editing multiple files at once;
- backend services, accounts, cloud storage, and collaboration;
- external integrations and automatic publishing;
- a localization framework and language selector if additional languages are introduced.

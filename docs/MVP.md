# JSON Visual Editor — MVP

## Product vision

JSON Visual Editor is a generic web application that lets anyone open and edit JSON data visually without learning JSON syntax. The application discovers structure at runtime and does not depend on a specific project, property name, or schema.

The MVP uses English as its single application language. User-provided filenames, property names, string values, URLs, and all other JSON content are preserved exactly and are never translated.

## MVP flow

1. Choose or drag and drop a JSON file.
2. Analyze its structure automatically.
3. Select an appropriate initial view.
4. Edit values and structure.
5. Search the entire document.
6. Open item details and image previews when available.
7. Undo, redo, and restore changes.
8. Compare the current document with the original.
9. Download formatted or compact JSON.

## Complete scope

- import by clicking or dragging and dropping;
- object, array, string, number, boolean, and `null` roots;
- recursive editing;
- automatic object form;
- automatic table for arrays of similar objects;
- editable list for simple arrays;
- tree view for mixed or irregular structures;
- manual switching between compatible views;
- item details panel;
- automatic image-candidate preview;
- property and item creation, editing, renaming, duplication, deletion, and reordering;
- segmented paths and breadcrumbs;
- global search;
- undo, redo, and restoration;
- structural comparison;
- formatted and compact download;
- responsive and accessible browser interface;
- temporary browser-only storage.

## Explicitly outside the MVP

- authentication and accounts;
- backend storage or cloud synchronization;
- collaboration;
- GitHub integration from the product interface;
- automatic publishing;
- domain-specific templates;
- AI-generated edits;
- simultaneous editing of multiple files;
- JSON Schema authoring;
- a localization framework or language selector.

## Delivered stages

### Foundation and import

- Vue 3, strict TypeScript, and Vite project foundation;
- responsive main layout;
- file selection and drag-and-drop handlers sharing one `FileList` pipeline;
- local reading and JSON validation;
- recognition of all six valid JSON root types;
- clear English errors for empty files, malformed JSON, unsafe integers, and unsupported numbers;
- imported filename and structural summary;
- file removal and return to the start screen.

### Recursive editor

- central `JsonValueEditor` coordinator selected by the actual value type;
- object form, simple-array list, uniform-object table, and irregular tree;
- manual view switching;
- value editing and type changes at any path;
- primitive root editing and root replacement;
- creation and deletion of properties and items;
- collision-safe property renaming;
- explicit type choice when replacing `null` or adding to an empty array;
- collapsible nested objects and arrays;
- segmented breadcrumbs;
- independently scrolling workspace for deep structures;
- immutable operations centralized in the domain layer.

### Table and CRUD

- table columns from the stable union of object properties;
- explicit missing-property cells;
- direct typed editing of primitive cells;
- nested object and array summaries;
- accessible item details panel;
- editable responsive cards below 760 px;
- deep duplication of items and properties;
- unique English copy names generated centrally;
- confirmation for relevant destructive changes, with the affected path;
- exact array reordering;
- predictable object-property presentation when representable;
- root replacement;
- interface-only selection state with no JSON metadata.

### Images and search

- generic detection of HTTP and HTTPS URLs with known image extensions;
- support for query strings and bounded raster `data:image` values;
- lazy preview with preserved proportions and layout limits;
- loading-failure fallback that does not change the value;
- safe external link behavior and `referrerpolicy="no-referrer"` where applicable;
- disclosure that a remote preview contacts the image host;
- recursive search across property names, strings, numbers, booleans, and full paths;
- case-insensitive matching;
- exact paths, match types, and value previews;
- navigation that expands ancestors, opens table details when needed, and highlights the target;
- 180 ms input delay and a limit of 250 results;
- no mutation or metadata from search.

### History, comparison, and export

- central immutable snapshot history for every operation;
- limits of 50 undo and 50 redo states;
- continuous typing in the same field grouped within 750 ms;
- Undo and Redo controls and Windows, Linux, and macOS shortcuts;
- native field-level text undo preserved;
- redo stack discarded after a new edit;
- complete, reversible restoration of the original;
- visible status for changes not yet downloaded;
- recursive structural comparison;
- added, removed, changed, and pure array-reorder changes identified by path;
- object property order ignored semantically;
- navigation from each change to the editor;
- formatted two-space or compact JSON;
- edited filename suggestion based on the original filename;
- validation before download;
- no interface, history, or search metadata in downloaded JSON;
- document and history preserved after download.

## Final requirement status

| Requirement | Final status | Main evidence |
|---|---|---|
| Click and drag import | Complete | `JsonDropzone.vue` sends both inputs through the same file-selection pipeline |
| Six JSON root types | Complete | `JsonValueEditor.vue`, `JsonPrimitiveEditor.vue`, parser and operation tests |
| Recursive editor | Complete | `JsonValueEditor.vue` recursively renders segmented child paths |
| Object form | Complete | Editable, renameable, collapsible properties with CRUD |
| Automatic table | Complete | `analyzer.ts` and a semantic table with a union of columns |
| List and tree alternatives | Complete | Manual selection between compatible views |
| Item details | Complete | `JsonItemDetailsPanel.vue` with contained and restored focus |
| Images | Complete | `image.ts` and `ImagePreview.vue`, without changing source values |
| CRUD and reordering | Complete | Immutable operations centralized in `operations.ts` |
| Global search | Complete | `search.ts` and `JsonSearchPanel.vue`, without document metadata |
| Undo, redo, and restoration | Complete | Limited snapshots in `history.ts` |
| Structural comparison | Complete | `diff.ts` and navigable comparison panel |
| Formatted and compact download | Complete | Validation in `exporter.ts` and browser `Blob` download |
| Responsive layout | Complete | Cards below 760 px, contained tables, and no page-level horizontal overflow |
| Accessibility | Complete | Native semantics, labels, alerts, visible focus, contrast, dialog focus, and reduced motion |
| Local processing | Complete | No backend calls; optional remote previews contact only the image host |
| English-only application | Complete | English interface, accessibility text, source messages, tests, HTML metadata, and documentation |
| User-data language preservation | Complete | Parser, operations, search, and export use literal values; dedicated Portuguese fixtures verify preservation |

## Audited end-to-end flows

| Flow | Status | Evidence |
|---|---|---|
| 1. Import by clicking | Validated | Native picker loaded object and array files |
| 2. Import by dragging | Validated by implementation | Drag events and click selection share the same `FileList` pipeline; the operating-system file gesture could not be synthesized by browser automation |
| 3. Edit a root object | Validated | String, number, and boolean properties changed at the root |
| 4. Edit a root array | Validated | Cells and items changed directly in the root array |
| 5. Edit primitive and `null` roots | Validated | Root replacement and editing covered all primitive types and explicit replacement after `null` |
| 6. Navigate nested structures | Validated | Breadcrumb and expansion reached six path segments |
| 7. Use the automatic table | Validated | Uniform arrays opened with typed cells and semantic headers |
| 8. Switch to tree view | Validated | The view control replaced the table with a tree |
| 9–13. Add, edit, duplicate, delete, and reorder | Validated | Operations executed in the interface and covered by unit tests |
| 14. Search | Validated | Nested search returned a full path and navigated to its result |
| 15. Preview images | Validated | Horizontal and vertical images stayed contained and loaded lazily |
| 16. Undo and redo | Validated | Buttons, keyboard shortcuts, stack behavior, and native field undo were verified |
| 17. Compare changes | Validated | Panel showed path, previous value, current value, and editor navigation |
| 18. Restore original | Validated | Document returned to the original and restoration remained undoable |
| 19–20. Download formatted and compact | Validated | Both files were generated, parsed as valid JSON, and compared |
| 21. Reopen downloaded file | Validated | Compact output was imported again with its structure and types intact |

## Architecture decisions

JSON rules live in `src/core/json` and do not depend on Vue. Browser interactions live in `src/features`, and reusable screen state lives in `src/composables`. JSON paths are segment arrays rather than dot-concatenated strings.

Every edit passes through `src/core/json/operations.ts`. An operation validates its path and container, copies only the required ancestors, and returns a new root. Components emit typed intentions and never mutate the document directly.

The default view is inferred only from the actual value type and structural uniformity. A table candidate must contain only objects, expose no more than 16 combined columns, and fill at least 50% of those columns in every row. Property names never influence this decision.

Table columns follow the first appearance of each property. A missing property is explicit and can be created by choosing a type. Nested values are summarized in cells and edited in the item panel to prevent excessively tall tables.

Arrays have semantic order and are reordered exactly. JSON objects do not have semantic property order, although the implementation keeps a predictable presentation for ordinary string keys. Objects with JavaScript array-index-like keys do not offer visual property reordering because the runtime controls their enumeration order.

Interface identifiers, search state, selection, and focus stay in Vue state. The domain layer operates exclusively on user values, and no internal property is added to exported JSON.

History lives in `src/core/json/history.ts`. Each valid edit creates a snapshot except consecutive string edits at the same path within 750 ms. The past and future stacks are limited to 50 entries. Restoring the original creates a new snapshot and can therefore be undone.

Comparison lives in `src/core/json/diff.ts` and walks values recursively. Object keys are compared as sets because their order is not semantic; array indices are compared in order. If two arrays contain the same multiset of values in a different sequence, the change is classified as a reorder.

Export validates the current value in `src/core/json/exporter.ts`, serializes only that value, and creates the file in the browser. No composable or component state participates in serialization.

Wide tables stay inside `.table-scroll` with layout and paint containment. Below 760 px, the visual presentation changes to cards while keeping the same typed editors. Deep structures use an independently scrolling workspace.

Dialogs and panels remember the control that opened them, contain `Tab` and `Shift+Tab`, and restore focus when closed. If deletion removes the original control, focus falls back to the nearest remaining JSON ancestor.

Search lives in `src/core/json/search.ts`, visits only the current JSON value, and returns segmented paths. Navigation expands components and applies interface highlight classes; it never marks the document itself.

Image detection lives in `src/core/json/image.ts`. Remote URLs must use HTTP or HTTPS and end in a known extension in their `pathname`; query strings do not interfere. Raster `data:image` input is limited to 1,000,000 characters, while embedded SVG is excluded. Remote previews are made directly by the browser and therefore contact the host supplied in the user's JSON.

## Numeric policy

Import rejects integers outside JavaScript's safe range and numeric values that become infinite. This prevents opening and downloading a file from silently changing a number. Arbitrary decimal precision remains outside this MVP and requires an explicit representation decision before implementation.

## Language policy

English is the single default language for application-owned interface text, accessible names, announcements, errors, source documentation, tests, examples, and project documentation. No translation framework or language selector is included in the MVP.

Imported content is opaque user data. The application never translates, normalizes, or otherwise rewrites a filename, property name, string value, URL, search result, or exported value because of its language.

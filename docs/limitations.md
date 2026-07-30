# Limitations

Confirmed constraints of the current implementation — not a wishlist, and not deliberately unfinished work. Each item below is backed by something specific in the code, referenced inline.

## One document at a time

There is no multi-document or tabbed editing. Importing a new file replaces the one currently loaded (`useJsonDocument`'s `document` holds exactly one `LoadedJsonDocument`). Open a second document by using a second browser tab — see [Local persistence](architecture/local-persistence.md) for how sessions stay isolated per tab in that case.

## Cards/list view: local UI state can follow the wrong item after a reorder or an earlier deletion

Documented directly in [`JsonValueEditor.vue`](../src/features/editor/JsonValueEditor.vue), in the Cards/list rendering path: each item is keyed by its array index (`:key="index"`). Deleting or reordering an item *before* another one in the same array reuses that other item's component instance for a different value, so purely local UI state (whether it's expanded, which nested view mode is selected, which row is open in the details panel) can render against the wrong item until it's touched again. The document's actual data is never affected — this is a display-state issue, not a data-integrity one.

This is a known trade-off, not an oversight: resetting local state whenever the underlying value changes would also reset it on every edit to nested content *within* that same item (any nested edit produces a new object reference along the whole ancestor chain), which would collapse or reset a section out from under someone actively editing it — a worse problem than the one it would fix. Fixing this properly needs a stable per-item identity that plain JSON arrays don't have and that this application deliberately does not synthesize.

## Large documents

Parsing and rendering both happen on the main thread — there is no Web Worker for JSON parsing, and the recursive editor is not virtualized (every visible node is a real DOM node, though collapsed collections don't mount their body until expanded — see [Editor model](architecture/editor-model.md#rendering-performance)). The one piece of this system that *does* run off the main thread is auto-save's recovery-snapshot size measurement (`src/workers/sessionBudget.worker.ts`). A very large document can still mean a large DOM tree and a heavier undo/redo history, even with the structural sharing described in [Editor model](architecture/editor-model.md#history-undoredo).

## Numeric precision

Numbers follow JavaScript's IEEE 754 double-precision behavior. Rather than silently lose precision, the application rejects at parse, edit, and export time: any integer outside `Number.isSafeInteger` range, and any value that isn't finite (see [`parser.ts`](../src/core/json/parser.ts) and [`operations.ts`](../src/core/json/operations.ts)). There is no arbitrary-precision ("big number") representation.

## Image detection is a heuristic

A value is treated as a possible image based on its shape (a URL ending in a known image extension, or a `data:image/...` prefix) — not by inspecting the actual bytes or content type (see [Editor model](architecture/editor-model.md#image-detection)). This means a URL that merely *looks* like an image can fail to load, and (in principle) a differently-typed resource served from a URL with an image-like extension could be offered a preview. Either way, a failed load only shows a fallback message; the underlying value is never changed by this heuristic.

## Comparison's reorder detection is exact

An array change is reported as a single **Reordered** change only when both versions contain the exact same multiset of items, just in a different order (see [Editor model](architecture/editor-model.md#comparison)). If even one item was also added, removed, or edited, the comparison falls back to per-index **Added**/**Removed**/**Changed** entries instead of a combined "reordered + 1 changed" summary.

## No accounts, sync, or collaboration

Everything is local to one browser profile on one device (see [Privacy and local data](user-guide/privacy-and-local-data.md)). There is no account system, no backend, no cross-device sync, and no real-time collaboration.

## English only

The interface, accessible names, and messages are English-only, with no language selector or localization framework. Content that comes from your own JSON file (property names, string values) is never translated or altered based on language, regardless of this.

## Local auto-save is a safety net, not a guarantee

See [Export and recovery](user-guide/export-and-recovery.md#local-auto-save) and, for the full mechanics, [Local persistence](architecture/local-persistence.md#what-this-does-not-guarantee) — auto-save cannot guarantee recovery from an abrupt browser/process crash or power loss, and is not a substitute for downloading your file.

## Ideas raised but not committed

The project's earlier planning notes listed several ideas explicitly kept **outside** its initial scope: optional JSON Schema validation, virtualization/worker-based processing for very large documents' rendering (as opposed to just the auto-save sizing worker that exists today), an explicit arbitrary-precision number policy, editing multiple files at once, backend services/accounts/cloud storage/collaboration, external integrations or automatic publishing, and a localization framework should additional languages ever be introduced.

None of these have an implementation, a design, or a scheduled milestone as of this writing — they're recorded here only so the same ideas aren't re-litigated from scratch, not as a roadmap or a commitment. Any of them would need its own design discussion before implementation.

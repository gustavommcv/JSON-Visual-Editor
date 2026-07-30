# Editing and views

## Contents

- [Terminology](#terminology)
- [Automatic view selection](#automatic-view-selection)
- [Editing values](#editing-values)
- [Changing a value's type](#changing-a-values-type)
- [Objects: properties](#objects-properties)
- [Arrays: items](#arrays-items)
- [The table view](#the-table-view)
- [Item details panel](#item-details-panel)
- [Content-aware values and inspector](#content-aware-values-and-inspector)
- [Confirmations](#confirmations)
- [Undo, redo, and restoring the original](#undo-redo-and-restoring-the-original)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Responsive layout](#responsive-layout)

## Terminology

The interface uses these words consistently, and this guide follows the same convention:

| Term | Meaning |
|---|---|
| File | The imported `.json` file |
| Document | The JSON content you're editing |
| Property | A key in an object |
| Value | The content at a given path — an object, array, or primitive |
| Path | Where a value lives in the document, shown as `$["key"][0]` in the breadcrumb |

Property names, string values, and anything else that comes from *your* file are your data — the application never translates or rewrites them.

## Automatic view selection

When you open a value that's an object or array, the editor infers an initial way to display it from its actual shape — never from property names like `id`, `title`, or `image`:

| What the value looks like | Initial view |
|---|---|
| Object | **Form** — one labeled field per property |
| Array of only primitive values (strings, numbers, booleans, `null`), or empty | **Cards** — an editable, numbered list |
| Array of only objects, with at most 16 distinct properties combined and each item filling at least half of them | **Table** |
| Any other array — mixed types, nested arrays/objects, or object arrays that don't fit the table shape above | **Cards** |

A **view switcher** (Table / Cards) appears only when both views genuinely apply — that is, only for arrays of similar objects. For every other case there's exactly one sensible view, so no switcher is shown. Switching views is purely visual: it never changes the underlying data.

There is no separate "tree" view. A card that contains a nested object or array still shows that nested value using the same recursive editor, so the result naturally looks hierarchical for deeply nested documents — it's just Cards (or Form) rendering itself again one level deeper.

## Editing values

Every primitive gets a typed control:

- **String** — a text area (it grows to a few rows automatically for longer or multi-line text).
- **Number** — a number input; an invalid or unsafe entry shows an inline error and the previous value is kept until you enter a valid one.
- **Boolean** — a switch, labeled "True"/"False".
- **`null`** — shown as an explicit `null` badge with a type picker to replace it, since there's no "value" to edit directly.

## Changing a value's type

Every value — including the document root — has a **Type** selector next to it (String, Number, Boolean, Null, Object, Array). Choosing a different type replaces the value with a sensible default for that type (an empty string, `0`, `false`, `null`, `{}`, or `[]`); it does not try to convert the existing content. Changing the type of a value that already holds data asks for confirmation first, since the old content is discarded — replacing `null` does not, because there's nothing to lose.

**Replace root** (shown above the document) works the same way, at the very top level: it replaces the *entire* document with a fresh default value of the type you pick, and always asks for confirmation.

## Objects: properties

For each property you can:

- **Rename** it in place (the input reverts if you don't change anything). A rename that would collide with an existing property name is rejected with an explanation.
- **Add** a new property, naming it and choosing its initial type.
- **Duplicate** it — this makes a deep copy of the value and generates a unique name automatically (`"name (copy)"`, then `"name (copy) 2"`, and so on).
- **Delete** it, with confirmation, since this removes everything nested underneath it too.
- **Reorder** it with the up/down controls — *when the object supports reordering*. An object whose keys all look like array indices (plain non-negative integers) shows a notice instead: JavaScript itself controls the display order of those keys, so there's nothing meaningful to move.

Object property order has no meaning in JSON itself; reordering only changes how properties are presented in the editor, not the document's semantics.

## Arrays: items

For each item you can:

- **Add** an item at the end, choosing its type.
- **Duplicate** an item (deep copy, inserted right after the original).
- **Delete** an item, with confirmation.
- **Reorder** items with the up/down controls, or from the item details panel. Array order *is* meaningful in JSON, and reordering preserves the exact sequence you set.

## The table view

When an array qualifies for the table view:

- Columns are the union of every property seen across all items, in first-appearance order — not alphabetical, and not influenced by property names.
- A cell for a property an item doesn't have shows **Missing**, with a **Create** control to add that property (with a chosen type) to just that item.
- A cell holding a nested object or array shows a compact summary (for example, "Object · 3 properties") with an **Open item** button instead of trying to flatten it into the cell.
- Every other cell is directly editable in place, the same typed controls described above.

## Item details panel

Opening a nested value from a table or card ("Open details" / "Open item") shows it in a side panel instead of navigating away from the table. From there you can edit it with the full recursive editor, move it up/down within its array, duplicate it, or delete it, then close the panel to return to the table.

## Content-aware values and inspector

Some primitive values gain a quiet badge beneath their normal editor. The badge is an interpretation only: the original text/number field and Type selector remain visible and editable, and detection never changes what Download JSON exports.

The editor recognizes conservative, content-based forms of:

- ISO dates and date-times, and plausible Unix timestamps (seconds or milliseconds from 2000 through 2100).
- Safe `http://`/`https://` URLs, direct image/GIF/video links, common Git-host repository URLs, and email addresses.
- CSS colors (hex, RGB/RGBA, HSL/HSLA), UUIDs, long/multiline text, raster `data:image/...` values, and strings containing a valid JSON object or array up to 20,000 characters.

Activate a badge to open the contextual inspector. On a wide screen it occupies a side column; below 880 px it becomes a bottom sheet. The inspector shows the path, raw JSON type, safe derived properties, copy actions, and a purpose-built preview. Embedded JSON is parsed read-only; long text gets a reading surface; colors get a swatch; and date/timestamp values show useful alternate forms.

Remote media is **not requested when the document opens, the card expands, or the inspector opens**. The inspector shows the host and requires **Load preview** first. Only that action assigns the media URL to an image/video element, at which point the browser contacts the remote host. Embedded raster data is already part of the document and can be shown locally. SVG data images are not previewed. See [Privacy and local data](privacy-and-local-data.md#remote-media-opt-in) for the network and security details.

## Confirmations

A confirmation dialog, naming the affected path, appears before:

- Deleting a property or array item.
- Changing the type of a value that currently holds data.
- Replacing the document root.
- Restoring the original document (see below).

Adding a property/item or replacing `null` does not ask for confirmation, since there is no existing content to lose.

## Undo, redo, and restoring the original

- **Undo** and **Redo** step through every committed edit, up to 50 steps in each direction.
- Typing continuously in the same field is grouped into a single undo step as long as you keep typing within roughly three-quarters of a second; pausing longer, or editing something else, starts a new step.
- **Restore original** replaces the current document with the one you originally imported. This is itself an undoable action — restoring, then undoing, brings your edits back.
- Downloading, restoring, and normal editing all keep your full undo/redo history available; none of them clear it.

## Keyboard shortcuts

Outside of text fields: `Ctrl+Z` (`Cmd+Z` on macOS) for Undo, `Ctrl+Y` or `Ctrl+Shift+Z`/`Cmd+Shift+Z` for Redo. Inside a text field, your browser's native undo for that field takes over instead, so you don't lose in-progress typing edits to a global undo step.

## Responsive layout

Below **760 px** wide, the table view's `<table>` is replaced by a stacked card layout that keeps the same typed, editable fields — no functionality is lost, only the visual arrangement changes. Below **880 px**, the contextual inspector becomes a bottom sheet. Deeply nested documents scroll independently of the page, and a wide table scrolls horizontally within its own container rather than the whole page.

The interface also supports a light and a dark theme, toggled from the header; your choice is remembered for your next visit (see [Privacy and local data](privacy-and-local-data.md#what-is-stored-and-where)).

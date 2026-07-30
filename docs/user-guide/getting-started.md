# Getting started

JSON Visual Editor opens a JSON file and lets you inspect and edit it as forms, tables, and cards instead of raw text. Everything happens in your browser — see [Privacy and local data](privacy-and-local-data.md) for exactly what that means.

## Requirements

- A modern desktop or mobile browser with JavaScript enabled, and support for the `File`, `Blob`, and `URL.createObjectURL` APIs (all evergreen browsers — recent Chrome, Edge, Firefox, and Safari — support these).
- No account, no installation, and no server connection is required to use the application.

If you're setting up the project to develop or build it yourself, see [Development setup](../development/setup.md) instead.

## Opening a file

From the start screen, either:

- **Click** the drop zone to open your operating system's file picker, or
- **Drag and drop** a `.json` file onto it.

Both paths go through the same file-selection code, so they behave identically. Only one file, with a `.json` extension, can be opened at a time; opening a new file while one is already loaded replaces it (there is no multi-file/tabbed editing).

If the file can't be used, an error message explains why, without technical jargon where possible:

- The file is empty.
- The file is not valid JSON (the underlying JSON syntax error is included).
- A number in the file is an integer too large to represent safely in JavaScript, or is otherwise non-finite.

None of these cases partially import the file — either the whole document loads, or nothing does.

## What counts as valid JSON here

Any of the six JSON value kinds can be the root of the document, not just objects and arrays:

- object
- array
- string
- number
- boolean
- `null`

Whichever one it is, the editor picks an appropriate starting view for it — see [Editing and views](editing-and-views.md#automatic-view-selection).

## After a file loads

Once a file is open, you'll see:

- The file name and a short summary (detected root type and size).
- A toolbar with **Undo**, **Redo**, **Restore original**, **Compare changes**, and **Download JSON**.
- A path breadcrumb showing where you are in the document.
- A search field.
- The recursive editor itself, starting from the document root.

From here:

- [Editing and views](editing-and-views.md) covers changing values and structure, and how the form/table/cards views work.
- [Search and comparison](search-and-comparison.md) covers finding content and reviewing changes.
- [Export and recovery](export-and-recovery.md) covers downloading your edits and what happens if you close the tab by accident.

**Remove file** (next to the file name) clears the loaded document and returns to the start screen without downloading anything.

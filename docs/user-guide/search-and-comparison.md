# Search and comparison

## Search

The search field above the editor looks across the **entire current document** — not just the value you're currently viewing — for your query against:

- property names ("key" matches),
- primitive values, compared as text (a number or boolean is matched against its displayed form), and
- the formatted path itself (so searching `items[2]` finds that location directly).

Matching is case-insensitive and looks for your query as a substring anywhere in each of those three fields. Typing pauses briefly (about 180 ms) before searching, so results don't refresh on every keystroke; up to 250 results are shown, in the order they're found while walking the document, not ranked by relevance.

Each result shows its path, which of the three fields matched, and a short preview of the value. Selecting a result:

- expands whatever ancestors are collapsed so the target is visible,
- opens the item details panel if the result is inside a table row,
- scrolls to it and briefly highlights it, and
- **never modifies the document** — searching and navigating to a result are read-only actions.

The highlight clears the next time you click or move keyboard focus elsewhere in the editor.

## Comparing changes

**Compare changes** (with a live count in the toolbar) opens a panel listing every structural difference between the document **as originally imported** and its **current** state:

| Kind | Meaning |
|---|---|
| Added | A property or item that doesn't exist in the original |
| Removed | A property or item from the original that no longer exists |
| Changed | The same path holds a different value now |
| Reordered | An array still contains exactly the same items, just in a different sequence |

A few things about how this comparison works:

- Object property order is never considered a change by itself — only which properties exist and what they contain.
- An array is only reported as a single **Reordered** change when it still holds the exact same items, just rearranged; if items were also added, removed, or edited, those show up individually instead.
- Each change shows a preview of the value before and after, and a **Go to editor** button that navigates you to that exact path (closing the comparison panel, expanding ancestors, and highlighting it, the same as a search result).
- If nothing has changed, the panel says so plainly instead of showing an empty list.

Comparison always measures against the file you originally imported, not against your last download — see [Export and recovery](export-and-recovery.md) for the distinction between "changes since import" and "changes since your last download".

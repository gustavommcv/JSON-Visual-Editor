# Export and recovery

## Contents

- [Downloading your document](#downloading-your-document)
- [Local auto-save](#local-auto-save)
- [Resuming a session](#resuming-a-session)
- [Working in more than one tab](#working-in-more-than-one-tab)
- [When auto-save can't run](#when-auto-save-cant-run)
- [Auto-save vs. Download JSON](#auto-save-vs-download-json)

## Downloading your document

**Download JSON** opens a dialog showing:

- the suggested file name (your original name with `-edited` appended before `.json`),
- how many changes exist since the original import, and
- a choice between **Formatted** (two-space indentation) and **Compact** (no extra whitespace) output.

The document is validated again right before downloading; if it currently contains something that can't be serialized as JSON (for example, a circular reference), the dialog explains why and the download button is disabled until that's no longer the case — this should not happen through normal use of the editor, since every edit already goes through validated operations. The file is generated entirely in your browser (a `Blob` and a temporary download link) and is not uploaded anywhere. After downloading, your document, its undo/redo history, and your ability to keep editing are all unaffected.

If you close or reload the tab while there are changes that haven't been downloaded yet, the browser shows its own native "leave site?" confirmation.

## Local auto-save

While you edit, the application saves your progress to your browser's local storage (IndexedDB) automatically, so an accidental tab close, reload, or crash doesn't necessarily lose your work. A few things worth knowing about how this actually behaves:

- **It only starts after your first real edit.** Opening a file and not touching it doesn't create anything to recover.
- **It's not instantaneous.** Auto-save waits for a short pause in your editing (a few seconds) before writing, and shows an "Auto-save pending" status in the indicator at the bottom of the screen while it's waiting. If you keep editing continuously, the save keeps waiting for a pause — but closing the tab, reloading, or switching away from it triggers an immediate save attempt as a safety net.
- **A save-status indicator** is shown whenever you have unexported changes, cycling through *Auto-save pending* → *Saving…* → *Auto-saved locally* (or *Saved*, right after a successful attempt) as appropriate. If a save can't complete, it shows *Not saved* with an explanation available on focus/hover.
- **It is not a substitute for Download JSON.** It's a local safety net against losing in-progress work, not a save button, a backup service, or a way to get a file out of your browser — downloading is the only way to do that. See [Auto-save vs. Download JSON](#auto-save-vs-download-json).

## Resuming a session

The next time you open the application (in the same browser, on the same device), if one or more editing sessions were saved and not cleaned up, you'll see a prompt listing each one individually — by file name, when it was last saved, and its approximate size — so you can **Resume** or **Discard** each one on its own. Nothing is resumed automatically, and dismissing the prompt with **Not now** doesn't delete anything; it's simply offered again next time.

A saved session stops being offered once you restore the original document, successfully download it, remove the file, or explicitly discard it from the prompt — any of those start a fresh session identity if you keep editing afterward.

Sessions aren't kept forever: at most 5 recoverable sessions are retained, for up to 7 days each (a session you currently have open elsewhere is never evicted just for being old or over that count). If a session was saved by a *newer* version of the application than the one you're currently running, it's shown separately as unable to open here, with the option to discard it — it's kept, not silently deleted, in case you go back to the newer version later.

## Working in more than one tab

Each imported or resumed document has its own independent saved session — two files with the same name are never mixed up. If you open the *same* resumed session in two tabs, they don't merge each other's changes; if both try to save at once, the tab that loses that race shows a notice and pauses its own auto-save for that session, while you keep editing normally in that tab (only local persistence is paused, not editing itself). A tab also shows a lighter notice when it detects the same document might be open elsewhere, even before any conflict actually happens.

## When auto-save can't run

If local storage isn't available at all — some private-browsing modes are the common case — a notice explains that editing still works normally, but nothing will be kept beyond the current tab. Other failures (a temporary read/write problem, a blocked database, storage quota being full, or a document too large to store) show a specific message; most of these are retried automatically on your next edit, while a full storage quota pauses further attempts for that session until you reload.

## Auto-save vs. Download JSON

| | Local auto-save | Download JSON |
|---|---|---|
| Where the result lives | Your browser's local storage, on this device | A real file on your disk, wherever you save it |
| Purpose | Recover from an accidental close, reload, or crash | Keep, share, or use the result outside the browser |
| Happens | Automatically, a few seconds after you pause editing | Only when you choose Download JSON |
| Survives clearing browser data | No | Yes, it's a normal file |

If you need your edits outside this browser tab — to share the file, back it up, or use it somewhere else — download it. Don't rely on auto-save as your only copy.

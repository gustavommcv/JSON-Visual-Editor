# Privacy and local data

## Processing

There is no backend. Importing, editing, undo/redo history, search, comparison, export, and local auto-save all run in your browser; your JSON file is never uploaded or transmitted to a server. There is no analytics or telemetry code in the application, and it makes no network requests of its own while you use it.

The only files served by the site that aren't the application itself are static, inert metadata for search engines: `robots.txt`, `sitemap.xml`, and a single-line Google Search Console ownership-verification file. None of these run any code or track visitors.

## Remote images: the one exception

If your JSON contains a string that looks like a remote image URL, the editor can show a small preview of it (see [Editing and views](editing-and-views.md#image-previews)). To do that, **your browser requests that image directly from whatever host the URL points to** — that request is made by the browser, not by this application proxying or relaying it, but it does mean the image's host learns that URL was requested. The interface discloses this next to the preview. Your JSON document itself is never sent as part of that request, and no other part of the application makes outbound requests.

If your document contains sensitive URLs you don't want requested, avoid opening it somewhere those requests would be logged in a way that concerns you, or be aware that scrolling a field with such a value into view triggers its image preview.

## What is stored, and where

| Data | Storage | Purpose | Lifetime |
|---|---|---|---|
| Editing session (original document, current document, last-downloaded snapshot, a trimmed slice of undo/redo history) | IndexedDB, database `json-visual-editor` | Recover from an accidental tab close, reload, or crash | Up to 5 sessions, up to 7 days each — see [Export and recovery](export-and-recovery.md#resuming-a-session) |
| Theme choice (light/dark) | `localStorage`, key `json-visual-editor-theme` | Remember your preferred theme across visits | Until you clear it or change the theme again |

Nothing else is written to your browser by this application. All of it stays on your device, in your browser profile — there is no server-side copy anywhere.

## Removing your data

- **A specific document's saved session** is removed automatically when you restore the original document, successfully download it, remove the file, or discard it from the resume prompt.
- **Everything at once**: clearing your browser's site data for this application (or its IndexedDB/local storage specifically) removes all saved sessions and the remembered theme. This is a normal browser feature, not something the application exposes its own control for.

## Downloads

**Download JSON** builds the file entirely in your browser (a `Blob` and a temporary link) and saves it wherever your browser's normal download flow puts it. The file is not uploaded anywhere as part of that process.

## Limits for sensitive data

This application does not encrypt what it stores locally, and IndexedDB/localStorage are only as private as the browser profile and device they live on — anyone with access to that profile (another person using the same computer account, for instance) can potentially read what's there using the browser's own developer tools. Treat local auto-save the same way you'd treat any other unencrypted local application data: fine for convenience and crash recovery, not a substitute for handling genuinely sensitive files with the care they need on a shared or untrusted device.

# Local persistence (auto-save)

This page documents the current implementation of [`useAutoSave`](../../src/composables/useAutoSave.ts), [`sessionStorage.ts`](../../src/core/json/sessionStorage.ts), [`sessionBudget.ts`](../../src/core/json/sessionBudget.ts), and [`sessionBudget.worker.ts`](../../src/workers/sessionBudget.worker.ts). This subsystem has changed substantially over the project's history (debouncing, worker-based size measurement, multi-tab conflict detection, retention limits); everything below is verified directly against the current source and against [`tests/useAutoSave.test.ts`](../../tests/useAutoSave.test.ts) and [`src/core/json/sessionStorage.test.ts`](../../src/core/json/sessionStorage.test.ts).

For the user-facing description of the same feature, see [Export and recovery](../user-guide/export-and-recovery.md). This page is the implementation detail behind that behavior.

## Contents

- [What triggers persistence](#what-triggers-persistence)
- [Timing: debounce and lifecycle flushes](#timing-debounce-and-lifecycle-flushes)
- [Storage layout](#storage-layout)
- [Session identity and revisions](#session-identity-and-revisions)
- [Write serialization](#write-serialization)
- [Multi-tab conflict detection](#multi-tab-conflict-detection)
- [Retention, quarantine, and cleanup](#retention-quarantine-and-cleanup)
- [Storage budget](#storage-budget)
- [Failure handling](#failure-handling)
- [What this does not guarantee](#what-this-does-not-guarantee)

## What triggers persistence

A document only becomes a recoverable session after its **first committed edit**. Importing a file alone does not create a session: `performSave` returns early with `if (history.value.past.length === 0) return`, and `useJsonDocument` only pushes onto `history.past` when an operation actually changes the value (see [Editor model](editor-model.md#history-undoredo)). Opening a file and closing the tab without touching it leaves nothing in IndexedDB.

A session identity (`activeSessionId`, a random UUID from `crypto.randomUUID()`) is assigned lazily: either when a document becomes active (`watch(() => document.value !== null, ...)`) or, as a fallback, on the first `editVersion` change in the same tick as a programmatic import.

## Timing: debounce and lifecycle flushes

Saving is **debounced, not immediate**. Every committed edit calls `scheduleSave()`, which:

1. Sets `isSavePending` to `true` right away (the UI can show "Auto-save pending" immediately).
2. (Re)starts a `setTimeout` of `AUTO_SAVE_DEBOUNCE_MS` (**5000 ms**, exported as a constant from `useAutoSave.ts`).
3. If another edit commits before the timer fires, the timer is reset — a burst of edits keeps postponing the actual write until editing pauses for a full 5 seconds.

When the timer finally elapses, `requestSaveNow()` runs the actual write. Three browser lifecycle events flush a pending save immediately instead of waiting out the debounce, on a best-effort basis:

- `visibilitychange` when `document.visibilityState === 'hidden'`
- `pagehide`
- `beforeunload`

This behavior is exercised directly in [`tests/useAutoSave.test.ts`](../../tests/useAutoSave.test.ts) (`describe('browser event wiring (visibilitychange/pagehide/beforeunload)')`) and in the "waits for an editing pause before persisting a recoverable change" test, which asserts zero writes at `AUTO_SAVE_DEBOUNCE_MS - 1` and exactly one write at `AUTO_SAVE_DEBOUNCE_MS`.

> **Earlier behavior, now superseded:** an older version of this feature saved immediately after every committed edit with no debounce. The 5-second debounce (`e32140b`, `190fbb8` in the project history) was introduced to reduce write and size-measurement overhead during active typing; any documentation or comment claiming "no artificial delay" describes that earlier behavior, not the current one.

## Storage layout

Everything lives in one IndexedDB database, `json-visual-editor`, currently at version `3` (`DB_VERSION` in `useAutoSave.ts`), with three object stores:

| Store | Key path | Purpose |
|---|---|---|
| `session` (legacy) | fixed key `"current"` | The single-slot store used by schema v1 of this feature. Kept, never deleted, so opening a newer build never destroys old data by itself. |
| `sessions` | `sessionId` | The current per-session store. Holds either a `PersistedSession` record or a `PersistedSessionTombstone` (see below), one row per document session. |
| `session-leases` | `leaseId` (`` `${sessionId}:${tabId}` ``) | Tracks which tab currently "owns" a session, with a TTL, so retention sweeps don't evict a session that's actively open in another tab. |

On upgrade, `onupgradeneeded` creates the `sessions` and `session-leases` stores if missing, and — if a legacy `session` store exists — copies its one record into the new `sessions` store via `migrateLegacySingleSession` when it parses as a valid record, while leaving the legacy store itself untouched.

A `PersistedSession` record (`schemaVersion` currently `1`, tracked independently of `DB_VERSION`) contains: `sessionId`, `ownerTabId`, `revision`, `fileName`, `savedAt`, `original`, `current`, `lastExported`, and a trimmed `history` (see [Storage budget](#storage-budget)). Every field is re-validated structurally on read by `isValidPersistedSessionRecord` (in `sessionStorage.ts`) — including an iterative, cycle-safe walk of `original`/`current`/history values (`isValidJsonValue`) — so a malformed or hand-edited IndexedDB entry cannot crash the app; it is treated as invalid and tombstoned instead.

## Session identity and revisions

A session is never keyed by file name alone: two files imported with the same name (in the same tab over time, or in two different tabs) get independent `sessionId`s and never overwrite each other's data. Each write increments an integer `revision`; the previous revision is only overwritten if the value on disk is not ahead of (or owned by a different, more-current tab than) the value being written — see [Multi-tab conflict detection](#multi-tab-conflict-detection).

## Write serialization

Writes for a given `sessionId` are never concurrent. `useAutoSave` keeps one `SessionQueue` per session (`generation`, a promise `tail`, and in-flight/pending flags):

- `enqueueForSession` chains every write and every delete for that session onto the same promise tail, so they run strictly in order.
- If new edits arrive while a write is already running, nothing is enqueued a second time — only a `pendingWriteRequested` flag is set, and one more save runs after the current one finishes, always re-reading the *current* document/history rather than replaying a stale snapshot.
- Before actually opening a write transaction, `performSave` re-checks the session's `generation` counter. Any cleanup (Remove file, Restore original, a successful download, or Discard) bumps `generation` synchronously and immediately, which is what stops a write that was merely queued — not yet inside its own `await getDatabase()` — from resurrecting a record that cleanup is in the middle of removing. This exact race is covered by five dedicated tests tagged `[AS-02 race 1..5]` in `tests/useAutoSave.test.ts`.

The recovery record itself is deliberately compact: `serializeRecoverySession` writes `current`, `original`, and `lastExported`, but clears `history.past`/`history.future` to empty arrays. Crash recovery only needs where the document is now and what it started from — not every intermediate undo/redo snapshot from the live tab.

## Multi-tab conflict detection

`compareAndWrite` reads the existing record and the incoming one in the *same* IndexedDB transaction before deciding whether to `put()`:

- If the stored record is a tombstone, or fails structural validation, or belongs to a different tab and is already at or ahead of the incoming revision, the write is refused as a `conflict` instead of overwriting it.
- On a conflict, the composable sets `sessionConflictActive = true` and exposes `sessionConflict` to the UI; `App.vue` then shows a notice ("This session was also saved from another tab with a newer version...") and stops auto-saving that session in the losing tab, without touching what that tab is actively editing.
- A `BroadcastChannel` (`json-visual-editor-session`) is used only as an early, best-effort UI signal ("this document may be open in another tab", refreshed on a 4-second heartbeat and considered stale after 10 seconds) — the actual conflict *safety* guarantee comes from the atomic revision check above, not from the broadcast.
- A session lease (`session-leases`, 5-minute TTL) records which tab is actively editing a session; an active lease exempts that session from the retention sweep described below, even if that temporarily pushes the total past the normal cap.

## Retention, quarantine, and cleanup

- **Cap and TTL**: at most `MAX_RECOVERABLE_SESSIONS = 5` sessions are offered for resume, and a session older than `SESSION_TTL_MS` (7 days) is swept on the next startup scan — *unless* it currently holds an active lease, in which case it is kept regardless (temporarily exceeding 5) until the lease expires or the tab closes.
- **Quarantine**: if a stored record's `schemaVersion` is *newer* than this build's `SESSION_SCHEMA_VERSION`, it is not deleted and not offered for resume — it is reported separately as a `QuarantinedSessionInfo` (file name/timestamp only, if recoverable from the raw record) and kept until the user explicitly discards it from the resume dialog. This protects a user who reopens an older build after using a newer one.
- **Deletion is a tombstone, not a row removal.** `Remove file`, a successful `Download JSON`, `Restore original`, and `Discard` all replace the session's record with a `PersistedSessionTombstone` — `{ recordType: 'tombstone', sessionId, ownerTabId, revision, deletedAt }` — rather than deleting the row outright. The tombstone carries no file name or JSON content; its only purpose is to make deletion durable and revisioned, so a suspended or stale tab cannot recreate a session merely because the live record is momentarily absent. Editing again after `Restore original` or `Download JSON` starts a brand-new session identity.

## Storage budget

Persisted history is capped independently of the in-editor undo/redo limit (50 steps each side, see [Editor model](editor-model.md#history-undoredo)):

- At most `MAX_PERSISTED_HISTORY_ENTRIES = 20` entries per side are kept in the stored record.
- The whole record is additionally kept under an approximate `MAX_SESSION_BYTES_APPROX` of 8 MiB.
- `applyStorageBudget` trims the entries farthest from `current` first (oldest `past`, then farthest `future`) until the record fits, and reports `historyTrimmed: true` if anything was dropped. `original`/`current`/`lastExported` are never trimmed — if the record is still too large with an empty history, the save is reported as `too-large-even-without-history` instead of silently truncating the user's actual document.
- Measuring the record's byte size runs off the main thread when possible: `useAutoSave` posts the record to a dedicated Web Worker (`src/workers/sessionBudget.worker.ts`), which calls `measurePersistedSessionByteSize` (`TextEncoder().encode(JSON.stringify(record)).byteLength`, falling back to an iterative, stack-safe size walk if `JSON.stringify` itself throws). If `Worker` is unavailable, the same iterative measurement runs synchronously on the main thread instead.

## Failure handling

Every storage failure is classified into one `AutoSaveFailureKind`: `unavailable`, `blocked`, `quota-exceeded`, `read-failure`, `write-failure`, `too-large`, `transient`. `App.vue` maps each to a specific, user-visible English message (see `AUTO_SAVE_STATUS_MESSAGE`). Only `unavailable` and `quota-exceeded` are treated as terminal for the rest of that session (`storageAvailable = false`, no further attempts); every other kind is retried on the next committed edit and does not repeat the warning once a subsequent save succeeds.

`unavailable` specifically covers environments where `indexedDB` doesn't exist or fails to open (some private-browsing modes are the common real-world case) — editing continues to work normally, but nothing is retained beyond the current tab.

## What this does not guarantee

Local auto-save is a crash-recovery net, not a save button, a sync service, or a substitute for **Download JSON** — downloading is the only way to get a file back out of the browser onto disk. Specifically:

- A write that was still in-flight at the exact moment of an abrupt process kill, power loss, or browser crash is not guaranteed to complete — no web application can guarantee that, and this project does not claim otherwise.
- The `visibilitychange`/`pagehide`/`beforeunload` flushes are best-effort reinforcement for an *orderly* close or reload; they are not a substitute for the guarantee above, and the test suite explicitly does not claim they prove anything about real browser scheduling during an ungraceful shutdown (see the comment above `describe('browser event wiring ...')` in `tests/useAutoSave.test.ts`).
- Recovery is local to one browser profile on one device — there is no cross-device sync, and two tabs editing the same session do not merge changes (see [Multi-tab conflict detection](#multi-tab-conflict-detection)).

# Accessibility

This page describes accessibility features actually implemented in the codebase. It is a description of existing practices and support, not a claim of formal WCAG conformance — there has been no formal accessibility audit of this project.

## Keyboard operability

- The import drop zone is a `role="button"` with `tabindex="0"` and explicit `Enter`/`Space` handlers, so it's fully operable without a mouse, not just clickable.
- Undo (`Ctrl+Z`/`Cmd+Z`) and redo (`Ctrl+Y` or `Ctrl/Cmd+Shift+Z`) work anywhere outside a text field; inside `input`, `textarea`, `select`, or a `contenteditable` element, the shortcuts are deliberately not intercepted, so the browser's native per-field text undo still works.
- Every dialog and side panel (confirmation, item details, comparison, export, resume-session) closes on `Escape`, except the resume-session prompt — see [Modals and dialogs](#modals-and-dialogs) for why that one is intentionally different.
- Every semantic badge is a real button with a contextual accessible name. A directly opened inspector closes with `Escape` or its named close control and returns focus to the exact badge that opened it. Inside Item Details, the inspector is the next view in the same dialog: focus moves to **Back to item details**, and Back, Close, or the first `Escape` returns focus to its badge; a second `Escape` closes Item Details and restores the table/card opener.

## Focus management

[`useDialogFocus.ts`](../src/composables/useDialogFocus.ts) is shared by every modal/panel (`ConfirmAction`, `JsonItemDetailsPanel`, `JsonComparisonPanel`, `JsonExportPanel`, `ResumeSessionPrompt`) and provides:

- **A focus trap**: `Tab`/`Shift+Tab` cycle only within the open dialog's focusable elements, rather than escaping to the page behind it.
- **Initial focus** on a sensible control when the dialog opens (typically the non-destructive action, or a dedicated close button).
- **Focus restoration** on close, back to whatever element had focus before the dialog opened — with a fallback if that element no longer exists (for example, because the action just deleted it): the fallback walks up the deleted item's `[data-json-path]` ancestor chain and focuses the nearest one still connected to the page, rather than dropping focus to the document body.

A global `:focus-visible` style (a visible 3 px outline) applies across the whole interface, not just to specific components, so a keyboard user always has a visible indicator of where focus is.

## Accessible names and labels

Icon-only controls (move up/down, duplicate, delete, open details, close) all carry a descriptive `aria-label`, often including context — for example, the resume-session prompt's Resume/Discard buttons are labelled with the specific session's file name and relative save time, not just "Resume"/"Discard". Text inputs that only show a visual icon (search) or that reuse a value as their own label (the property-name field) pair with a `.visually-hidden` screen-reader-only label.

## Live regions and error feedback

- Errors (file import errors, operation errors, export-blocking errors) use `role="alert"`.
- The auto-save indicator, session notices (another tab editing/conflict/storage warning), and search's pending/result-count text use `role="status"` with `aria-live="polite"` (and `aria-atomic="true"` where a state name should be read as a whole rather than word-by-word), so these updates are announced without moving focus.
- A failed auto-save state is additionally reachable and readable via keyboard: the indicator uses `aria-describedby` to associate the failure reason, and is focusable (`tabindex="0"`) specifically in that state.

## Modals and dialogs

Dialogs use `role="dialog"` or `role="alertdialog"` (for destructive confirmations) with `aria-modal="true"` and `aria-labelledby` pointing at their heading. The resume-session prompt is the one dialog that does **not** close on `Escape` or backdrop click — this is deliberate (see the comment in [`ResumeSessionPrompt.vue`](../src/features/import/ResumeSessionPrompt.vue)): unlike a confirmation with a safe default, each recoverable session needs an explicit Resume or Discard choice, so the only way to close it without acting on a specific session is its own "Not now" button.

## Contrast and themes

The application ships a light and a dark theme (see [Editing and views](user-guide/editing-and-views.md#responsive-layout)) driven by CSS custom properties, not by literal colors scattered through the stylesheet, which keeps contrast decisions centralized to the theme definitions in `src/styles/base.css`. Semantic badges and the inspector use those same tokens rather than separate theme overrides. Contrast has been specifically revisited at least once as a targeted fix (the drop-zone format hint was raised to meet WCAG AA contrast). This is evidence of attention to contrast, not a claim that every color pairing in the application has been formally audited.

## Reduced motion

A `prefers-reduced-motion: reduce` media query disables CSS transitions and forces `scroll-behavior: auto` globally. The search/comparison navigation helper ([`useSearchHighlight.ts`](../src/features/editor/useSearchHighlight.ts)) checks the same preference at runtime and uses instant (`'auto'`) rather than smooth scrolling when it's set, so scrolling to a search result or a comparison change respects the same preference.

## Semantic structure

The table view uses a real `<table>` with `scope="col"`/`scope="row"` and a visually-hidden `<caption>`; the item-details panel and export dialog use `<dl>`/`<dt>`/`<dd>` for label/value pairs and `<fieldset>`/`<legend>` for the format choice; headings follow document structure (`h1` for the page's current state, `h2` for dialog/section titles) rather than being sized with generic `<div>`s.

## Responsive behavior

Below 760 px, the table view switches to a stacked card layout using the same semantic form controls (see [Editing and views](user-guide/editing-and-views.md#responsive-layout)) rather than shrinking the table itself. Below 880 px, a directly opened contextual inspector becomes a scrollable bottom sheet with a backdrop and an always-visible close control. Inspection started from Item Details stays inside that dialog, avoiding stacked mobile sheets. These adaptations preserve target sizes and label associations instead of relying on horizontal scrolling or zooming.

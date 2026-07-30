# Documentation

This is the index for JSON Visual Editor's documentation. Start at the root [`README.md`](../README.md) for a project overview; use this page to find something more specific.

## User guide

How to use the application.

- [Getting started](user-guide/getting-started.md) — requirements, opening a file, what happens next.
- [Editing and views](user-guide/editing-and-views.md) — Form/Table/Cards, editing values and structure, undo/redo, keyboard shortcuts, responsive layout.
- [Search and comparison](user-guide/search-and-comparison.md) — finding content and reviewing changes against the original.
- [Export and recovery](user-guide/export-and-recovery.md) — downloading your document, and how local auto-save/session resume actually behaves.
- [Privacy and local data](user-guide/privacy-and-local-data.md) — what's processed locally, what's stored, and for how long.

## Architecture

How the application is built.

- [Overview](architecture/overview.md) — layers, component map, technology choices.
- [Editor model](architecture/editor-model.md) — the JSON domain layer: types, operations, history, view inference, search, comparison, export, and the rendering-performance techniques built on top of it.
- [Local persistence](architecture/local-persistence.md) — the IndexedDB-backed auto-save system: timing, schema, multi-tab conflict handling, retention, and failure handling.

## Development

Setting up, testing, and maintaining the project.

- [Setup](development/setup.md) — requirements and everyday commands.
- [Project structure](development/project-structure.md) — a file-by-file map of `src/`.
- [Testing](development/testing.md) — tooling, how the suite is organized, and the different testing styles used.
- [Code quality](development/code-quality.md) — type-checking and lint configuration, conventions, and troubleshooting.

## Cross-cutting

- [Accessibility](accessibility.md)
- [Limitations](limitations.md) — confirmed constraints, and ideas raised but not committed to.
- [Deployment](deployment.md) — the GitHub Pages workflow.

## Contributing

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) at the repository root.

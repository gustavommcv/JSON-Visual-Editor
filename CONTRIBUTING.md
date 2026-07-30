# Contributing

Thanks for considering a contribution to JSON Visual Editor. This project is a small, backend-free Vue application — most contributions are either a change to the JSON domain layer, a UI change to a feature component, or a documentation update.

## Before you start

1. Read [`docs/architecture/overview.md`](docs/architecture/overview.md) for how the codebase is laid out.
2. For anything beyond a trivial fix, open an issue first describing what you'd like to change and why — this avoids duplicated work and lets the change be discussed before you invest time in an implementation.

## Setup

```bash
npm install
npm run dev
```

See [`docs/development/setup.md`](docs/development/setup.md) for requirements and every available command.

## Making a change

1. Create a branch from `main`.
2. Follow the existing layering: domain rules go in `src/core/json/`, reactive/side-effecting state goes in a composable under `src/composables/`, and UI goes in `src/features/` or `src/components/`. See [`docs/development/code-quality.md`](docs/development/code-quality.md#adding-or-changing-a-feature) for the recommended order.
3. Add or update tests alongside the change — see [`docs/development/testing.md`](docs/development/testing.md) for which testing style fits which kind of code.
4. If the change affects what a user sees or how the application behaves, update the relevant page under [`docs/user-guide/`](docs/README.md); if it changes an architectural decision, limit, or schema, update the relevant page under `docs/architecture/`.

## Before opening a pull request

Run all of the following, and make sure they pass:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Don't disable a lint rule, skip or narrow a test, or loosen a type just to make one of these pass — fix the underlying issue, or explain in your pull request why an exception is warranted.

## Commit messages

Existing history follows a `type: short, imperative description` convention (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `style:`, `ci:`, `chore:`, `revert:`). Following it keeps `git log` scannable, but it isn't enforced by tooling.

## Pull requests

Describe what changed and why, and how you verified it (which commands you ran, and — for a UI change — what you checked manually in a browser, since this project has no end-to-end test suite; see [`docs/development/testing.md`](docs/development/testing.md#what-isnt-covered)). Link the issue it addresses, if any.

## Reporting a bug

Open an issue with: what you did, what you expected, what happened instead, and your browser/OS. If it's related to local auto-save, mention whether you were using a private-browsing window and whether more than one tab had the same document open — see [`docs/architecture/local-persistence.md`](docs/architecture/local-persistence.md) for the behavior that's actually implemented there today.

## License

By contributing, you agree that your contribution is licensed under this project's [GPL-3.0 license](LICENSE).

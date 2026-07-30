# Code quality

## Type checking

`npm run typecheck` runs `vue-tsc -b`, building the two project references declared in [`tsconfig.json`](../../tsconfig.json):

- [`tsconfig.app.json`](../../tsconfig.app.json) — `src/**/*.{ts,tsx,vue}`, excluding `*.test.ts`. Notably strict, beyond plain `"strict": true`:
  - `noUncheckedIndexedAccess` — indexing an array/record returns `T | undefined`, not `T`.
  - `exactOptionalPropertyTypes` — an optional property can be *absent*, or present with its declared type; not explicitly set to `undefined`.
  - `noUnusedLocals` / `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitOverride`.
- [`tsconfig.node.json`](../../tsconfig.node.json) — `vite.config.ts` and `src/**/*.test.ts`, targeting `ES2023` with Vitest's global types available.

`npm run build` runs `typecheck` before `vite build`, so a type error blocks the production build (and, by extension, the GitHub Pages deploy — see [Deployment](../deployment.md)).

## Linting

`npm run lint` runs ESLint (flat config, [`eslint.config.js`](../../eslint.config.js)) with **`--max-warnings=0`** — a warning fails the command exactly like an error does, there's no "warnings are fine" tier. The config layers:

- `@eslint/js` recommended rules for plain `.js`/`.mjs`/`.cjs`.
- `typescript-eslint` recommended rules for TypeScript.
- `eslint-plugin-vue`'s `flat/essential` preset for `.vue` files, parsed with `vue-eslint-parser` (which in turn uses the TypeScript parser for `<script>` blocks).
- One project-specific override: `vue/multi-word-component-names` is turned off, since components like `App.vue` and files matching real UI concepts don't always need a second word.

There is no separate Prettier configuration; formatting is whatever ESLint's rule set enforces, plus whatever style is already consistent in the surrounding file.

## Conventions actually used in this codebase

These aren't enforced by tooling, but are consistent enough across the codebase to follow when adding to it:

- **Domain code has no Vue dependency.** Nothing under `src/core/json/` imports from `vue`. If what you're writing needs `ref`/`computed`/lifecycle hooks, it belongs in a composable or component, not in `core/json`.
- **Immutable operations.** Every function in `operations.ts` takes a value and returns a new one; none mutate their input. Follow the same shape (`{ ok: true, value }` / `{ ok: false, error }`) for a new operation rather than throwing.
- **Components emit, they don't own.** A `.vue` component under `features/` receives data through props and emits a typed operation/event; it does not import from `core/json`'s mutating functions directly to change the document. (Read-only helpers like `formatJsonPath` or `summarizeNestedJsonValue` are fine to call directly.)
- **Naming**: composables are `useXxx.ts` (camelCase, `use` prefix); components are `PascalCase.vue`; domain modules are lowercase nouns (`operations.ts`, `analyzer.ts`); CSS classes follow a BEM-like `.block__element--modifier` pattern (see `src/styles/base.css`).
- **Comments explain *why*, not *what*.** The codebase's existing comments (see `useAutoSave.ts` and `sessionStorage.ts` for the density this warrants) are reserved for non-obvious invariants, races, and rationale — not restating what the next line of code does.
- **User-facing and source text is English**, including error messages, accessible names, and code comments — enforced for a sample of UI strings by [`src/language.test.ts`](../../src/language.test.ts), and expected consistently elsewhere by convention.

## Adding or changing a feature

1. If it changes document *rules* (a new operation, a new validation, a new inference rule), add it to the relevant `src/core/json/*.ts` module and its colocated test first.
2. Wire it into the composable (`useJsonDocument.ts` or `useAutoSave.ts`) if it needs reactive state or a side effect.
3. Wire it into the relevant `.vue` component last, following that component's existing prop/emit shape.
4. Add or extend a test using whichever style already fits (see [Testing](testing.md#testing-styles-used-in-this-project)) — a new domain function gets a direct test; a new piece of component markup or CSS gets a source-pattern assertion; a new composable behavior gets a fake/stub-based test.
5. Run `npm test`, `npm run typecheck`, and `npm run lint` before opening a pull request.
6. If the change affects user-visible behavior, update the relevant page under `docs/user-guide/`; if it changes an architectural decision (a limit, a schema, a flow), update the relevant page under `docs/architecture/`. See [`docs/README.md`](../README.md) for which page owns which topic.

## Troubleshooting

- **`npm run typecheck` fails after adding a new file** — confirm it's inside `src/` and matches one of the two `tsconfig` project references' `include` globs (see above); a `.ts` file outside `src/` (for example, a root-level script) isn't type-checked by either reference.
- **`npm run lint` fails on something that looks like a warning** — remember `--max-warnings=0` treats it as a failure; run `npx eslint <file>` without that flag while iterating, then confirm with the real `npm run lint` before committing.
- **A test needs `window`, `document`, or IndexedDB** — the environment is `node`, not `jsdom`. Don't add a `jsdom`/`happy-dom` dependency to work around this; follow the existing fake/stub pattern described in [Testing](testing.md#testing-styles-used-in-this-project) instead.
- **The production build works locally but assets 404 on GitHub Pages** — see [Deployment](../deployment.md) for the `base` path this project is configured for.

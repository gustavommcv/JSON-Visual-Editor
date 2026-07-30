# Testing

## Contents

- [Tooling](#tooling)
- [Running tests](#running-tests)
- [How the suite is organized](#how-the-suite-is-organized)
- [Testing styles used in this project](#testing-styles-used-in-this-project)
- [Fakes and mocks](#fakes-and-mocks)
- [What isn't covered](#what-isnt-covered)

## Tooling

Tests run on [Vitest](https://vitest.dev/), configured in [`vite.config.ts`](../../vite.config.ts) with `test.environment: 'node'` — **not** `jsdom` or `happy-dom`. Neither is a dependency of this project (confirmed in `package.json`; a `jsdom` entry that appears in `package-lock.json` is a transitive dependency of another package, not something the test suite uses). There is also no `@vue/test-utils` dependency, so `.vue` components are never mounted or rendered in tests. See [Testing styles used in this project](#testing-styles-used-in-this-project) for how component behavior is verified without a DOM.

No code-coverage tool (`@vitest/coverage-v8`, `c8`, etc.) is configured, so there's no coverage report or threshold to run.

## Running tests

```bash
npm test           # runs the whole suite once (vitest run)
npm run test:watch # watch mode
```

To run a single file or a subset:

```bash
npx vitest run src/core/json/parser.test.ts
npx vitest run tests/useAutoSave.test.ts

# by name pattern, across all files:
npx vitest run -t "debounce"
```

(`npm test -- <args>` forwards the same arguments through the `test` script, since it's a thin wrapper around `vitest run`.)

## How the suite is organized

Two locations, by convention:

- **`src/core/json/*.test.ts`** — one test file per domain module, colocated with the module it tests (`operations.ts` ↔ `operations.test.ts`, and so on for `analyzer`, `diff`, `exporter`, `history`, `image`, `parser`, `search`, `sessionBudget`, `sessionStorage`).
- **`tests/`** (repository root) and two files directly under **`src/`** (`language.test.ts`, `seo.test.ts`) — tests that span more than one module, exercise a composable's behavior, or check component/CSS/HTML source rather than a single domain function: `useAutoSave.test.ts`, `autoSaveIndicator.test.ts`, `cardLayout.test.ts`, `editorPerformance.test.ts`, `searchHighlight.test.ts`, `theme.test.ts`, `visualIdentity.test.ts`.

Run `npm test` to see the current count of test files and cases — it isn't repeated here as a number, since it changes as the suite grows.

## Testing styles used in this project

Because there's no jsdom/happy-dom and no `@vue/test-utils`, this project uses three different techniques depending on what's being tested:

1. **Direct function tests** for the domain layer (`src/core/json/*.test.ts`): import the module, call its exported functions, assert on the returned value. No environment faking needed since this layer has no DOM/browser dependency by design.
2. **Behavioral tests with hand-rolled fakes** for composables that do need browser APIs: `tests/useAutoSave.test.ts` implements a `FakeIndexedDb` class that models the real `IDBDatabase`/`IDBTransaction`/`IDBObjectStore` contract `useAutoSave.ts` actually uses (`get`/`getAll`/`put`/`delete` through `transaction(name, mode).objectStore(name)`), plus a fake `window`/`document` for lifecycle-event tests, combined with `vi.useFakeTimers()` to control the auto-save debounce deterministically. `tests/theme.test.ts` stubs `document`/`localStorage` with `vi.stubGlobal` and additionally uses Node's built-in `vm.runInNewContext` to execute the literal inline `<script>` extracted from `index.html`, so the pre-first-paint theme initializer is tested as real, executed code rather than duplicated logic. `src/features/editor/useSearchHighlight.ts` takes its DOM-touching operations (`findVisibleTarget`, `afterRender`, `prefersReducedMotion`) as an injectable `SearchHighlightEnvironment`, and its test supplies a fake one directly — no global stubbing needed.
3. **Static source-pattern tests** for `.vue` components and static assets, where rendering isn't available: `editorPerformance.test.ts`, `cardLayout.test.ts`, `autoSaveIndicator.test.ts`, `visualIdentity.test.ts`, `language.test.ts`, and `seo.test.ts` read the relevant `.vue`/`.css`/`index.html`/`robots.txt`/`sitemap.xml` source with `node:fs`'s `readFileSync` and assert that it contains (or doesn't contain) specific literal code, markup, or CSS. This catches regressions in specific implementation details (a class name, a `v-if` condition, a CSS rule) but does not exercise actual rendering or user interaction.

When adding a test for a `.vue` component, follow the existing convention for that kind of component rather than introducing a new mounting strategy — check whether a similar component already has a source-pattern test you can extend, or whether the logic you're adding actually belongs in a plain, directly-testable function (composable or `core/json` module) instead.

## Fakes and mocks

Besides the ones above, worth knowing about if you're changing `useAutoSave.ts`:

- `FakeIndexedDb` supports simulating a write failure (quota vs. generic/transient error), a delayed read (to test the startup-scan race), a delayed write completion (to test the cleanup-vs-in-flight-write races), pre-existing object stores (to simulate an upgrade from an older `DB_VERSION`), and a legacy single-slot record (to test the v1 migration).
- Concurrency and multi-tab scenarios are directly covered, not incidental: tests tagged `[AS-01]`, `[AS-02]`, `[AS-03]`, `[AUTO-01]`, `[AUTO-02]` in `tests/useAutoSave.test.ts` specifically target write-ordering races, cleanup-vs-in-flight-write races, the startup-scan race, and coalesced-retry cancellation. See [Local persistence](../architecture/local-persistence.md) for what these races are.

## What isn't covered

There is no end-to-end test suite (no Playwright, Cypress, WebdriverIO, or similar dependency, and no corresponding config or test directory in the repository). All testing is at the unit/module level, using the styles above. Manually exercising the running application in a browser is the only way to verify a change end-to-end today.

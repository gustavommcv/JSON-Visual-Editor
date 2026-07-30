# Development setup

## Requirements

- **Node.js `^20.19.0` or `>=22.12.0`.** This comes from Vite 7's own `engines` requirement (the project's `package.json` does not pin an `engines` field of its own — Vite is the binding constraint among its dependencies).
- **npm** (bundled with standard Node.js installs). The repository ships a `package-lock.json` (npm lockfile v3); there's no evidence the project has been tested with another package manager, so npm is the supported choice.

## Install

```bash
npm install
```

## Run the dev server

```bash
npm run dev
```

Vite prints a local URL (typically `http://localhost:5173`) once it starts. The application has no backend and needs no environment variables or `.env` file — none exist in the repository, and nothing in the source reads `import.meta.env` beyond Vite's own built-in client types.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server with hot module replacement. |
| `npm test` | Runs the Vitest suite once (`vitest run`). |
| `npm run test:watch` | Runs Vitest in watch mode. |
| `npm run typecheck` | Type-checks the project with `vue-tsc -b` (project references from `tsconfig.json`). |
| `npm run lint` | Runs ESLint over the repository with `--max-warnings=0` — any warning fails the command, not just errors. |
| `npm run build` | Runs `typecheck`, then `vite build`, into `dist/`. |
| `npm run preview` | Serves the built `dist/` output locally, for a final check against a production build. |

Run `npm test`, `npm run typecheck`, and `npm run lint` before opening a pull request — see [Code quality](code-quality.md) for what each one enforces, and [Testing](testing.md) for how the test suite is organized.

## Editor setup

There's no committed editor configuration (no `.vscode/settings.json`, `.editorconfig`, or Prettier config in the repository). Any TypeScript- and Vue-aware editor (for example VS Code with the official Vue extension, "Vue - Official") will pick up `tsconfig.json` and the path alias `@/*` → `src/*` automatically. Formatting is only enforced by ESLint (see [Code quality](code-quality.md)); there is no separate Prettier step.

## Next steps

- [Project structure](project-structure.md) — what lives where in `src/`.
- [Testing](testing.md) — how the test suite is organized and how to run part of it.
- [Code quality](code-quality.md) — linting, type-checking conventions, and troubleshooting.
- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) — how to propose a change.

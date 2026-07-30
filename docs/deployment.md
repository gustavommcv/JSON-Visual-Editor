# Deployment

The project deploys as a static site to GitHub Pages via [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml). There is no other deployment target documented or configured in the repository.

## What the workflow does

On every push to `main` (or a manual run via `workflow_dispatch`), the workflow:

1. Checks out the repository.
2. Sets up Node.js 22 with npm caching.
3. Runs `npm ci`.
4. Runs `npm run build` — which runs `typecheck` and then `vite build` (see [Code quality](development/code-quality.md)).
5. Uploads the generated `dist/` directory as a Pages artifact and deploys it via `actions/deploy-pages`.

Concurrency is limited to one deployment at a time (`concurrency: { group: pages, cancel-in-progress: true }`), and a newer push cancels an in-progress deployment rather than queuing behind it.

**This workflow does not run `npm test` or `npm run lint`.** The only automated gate before a deploy is the type check that's part of `npm run build` — a type error blocks the build step and the deployment never happens, but a failing test or a lint warning would not, on its own, stop a deploy through this workflow today.

## One-time repository setup

For the workflow to publish successfully, the repository's **Settings → Pages → Source** must be set to **GitHub Actions** (rather than "Deploy from a branch") — this is what lets `actions/configure-pages` and `actions/deploy-pages` publish the uploaded artifact.

## The Vite `base` path

[`vite.config.ts`](../vite.config.ts) sets `base: '/JSON-Visual-Editor/'`, matching this repository's name — GitHub Pages serves a project site at `https://<owner>.github.io/<repo>/`, so every built asset URL needs that prefix. If you fork this repository under a different name, or move it to a user/organization root page (`<owner>.github.io`) or a custom domain, update `base` to match (`/` for a root page or custom domain, or `/<new-name>/` for a differently-named fork) — otherwise the built assets will 404 in production while working fine in `npm run dev`.

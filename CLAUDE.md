# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server.
- `npm run build` — production build (output to `dist/`).
- `npm run preview` — serve the production build locally.
- `npm run lint` — ESLint (flat config in `eslint.config.js`). Globs `**/*.{js,jsx}` only, so the `.ts` files under `src/lib/` and `scripts/` are not linted.
- `npm run sink -- "Iron Ore"` — AWESOME Sink optimizer CLI (`--help` for options).
- `npm run test:sink` — `node --test` over `src/lib/satisfactory-sink/*.test.ts`. Intentionally dependency-free; keep it on Node's runner.
- `npm run test:ui` — Vitest + jsdom component tests (`src/**/*.test.{js,jsx}`; `src/lib/**` is excluded so the two runners never overlap). Setup in `src/test/`: `setup.jsx` mocks `src/firebase.js` and `react-leaflet` for every test, `server.js` holds the MSW handlers for the AskMe and Apply for Jobs endpoints (unhandled requests fail the test). `src/App.test.jsx` renders every route via `MemoryRouter`; its `PAGES` map must list each new tool/project URL with a heading unique to that page, or the coverage test fails.
- `npm run data:satisfactory` — regenerate `src/data/satisfactory/*.json` from the game's docs export. `:check` variant exits non-zero if the committed files have drifted.

Node 22+ is required (`.nvmrc` and `engines.node` in `package.json`); the `.ts` files rely on Node's native type-stripping, so they run with no build step and no TypeScript dependency.

## Required environment variables

Create a `.env` in the repo root before `npm run dev`:

- `VITE_FIREBASE_API_KEY` — Firebase Web API key (from Firebase Console → thedavidhanks → project settings). `src/firebase.js` throws on startup if this is missing.
- `VITE_AWS_SKILLS_API_KEY` — API key for the "Ask Me" Lambda (`https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask`). Used only by the `/askme` route.
- `VITE_AWS_APPLY_API_KEY` — API key for the "Apply for Jobs" Lambda. Used only by the `/tools/applyforjobs` route. See `docs/applyforjobs-bedrock-deploy.md` for the backend deploy spec.

In the Amplify console these three must be set as **environment variables**
(App settings → Environment variables), *not* as Amplify **secrets**. Secrets
are not exported into the build shell, so Vite would inline `undefined` for
each one and every route would render blank. `amplify.yml` runs
`npm run check:env` in `preBuild` so a misconfiguration fails the build instead
of deploying a blank site.

## Architecture

Single-page React 19 app bundled with Vite, deployed to AWS Amplify (us-west-2) on push to `master` (see `amplify.yml`).

- `src/main.jsx` is the thin entrypoint: it mounts `App` inside `BrowserRouter`. `src/App.jsx` is the top-level class component and defines all routes (it renders no router itself, so tests can wrap it in `MemoryRouter`). Adding a new top-level page means adding a `<Route>` in `App.jsx`, (usually) a link in the `menuItems` state, and an entry in `PAGES` in `src/App.test.jsx`.
- `src/firebase.js` initializes the Firebase compat SDK (auth + firestore) and exports `auth`, `db`, `provider`. Auth state lives on `App`'s `state.user`; `login`/`logout` use `signInWithPopup`/`signOut` and are passed down to `BSnavbar`.
- `src/components/projects/index.jsx` is its own nested-router subtree: the `projectlist` array in `projectlist.jsx` drives both the card grid (`CardContainer` → `ProjectCard`) and the per-project routes. To add a project, append to `projectlist` with `{path, endpoint, element, title, description, tags, imgsrc?}` and create the page component under `src/components/projects/pages/`. `ProjectHome` is mounted at `/projects/*`, so its descendant `<Routes>` matches only the remaining segment: `path` is the bare slug (`gps-tracker`) and `endpoint` is the full path minus the leading slash (`projects/gps-tracker`), which `ProjectCard` links to absolutely. Pages are served at `/projects/<slug>`. This mirrors `toollist.jsx`/`ToolCard.jsx`; re-adding a `projects/` prefix to `path` is what caused the doubled `/projects/projects/<slug>` URLs in #36.
- `src/components/askme/index.jsx` is a chat UI that POSTs `{question, sessionId?}` to the AWS API Gateway endpoint above and types the response character-by-character via a `setInterval`. The `sessionId` returned by the API is reused for follow-up questions to maintain conversation context.
- Styling is Bootstrap 5 + react-bootstrap, with the bundle JS imported once in `main.jsx`.

## Branch protection

Three repository rulesets, all `active`. View them with `gh api repos/thedavidhanks/thedavidhanks2/rulesets`.

| Branch | Ruleset | Rules | Bypass |
| --- | --- | --- | --- |
| `master` | `master: production gate` | PR required (0 approvals), `verify` must pass, no force-push, no deletion | none |
| `dev` | `dev: no force-push or delete` | no force-push, no deletion | none |
| `dev` | `run tests on branch` | PR required (0 approvals), `verify` must pass | Repository admin, mode `always` |

- `verify` is the job name in `ci.yml`. It is pinned by `name: verify` precisely because the rulesets reference that string — renaming the job silently disables the gate on both branches.
- **`master` has no bypass for anyone.** Changes reach it only through a PR with a green `verify`; `dev-to-master-monthly.yml` opens that PR on the 1st and deliberately does not merge it.
- `dev` is split across two rulesets on purpose. The admin bypass is scoped to the PR/status-check ruleset so the owner can push to `dev` directly, while force-push and deletion stay blocked for everyone.
- No workflow holds the admin role, so every automated path — Dependabot included — still goes through a PR. See `docs/dependabot-automation.md`.
- Required approvals are `0` on both branches and should stay there: this is a single-maintainer repo and GitHub forbids approving your own PR, so any higher count makes self-authored PRs unmergeable. For the same reason `require_extra_approval_for_unattributed_changes` is `false` on `master`.

## Conventions to be aware of

- ESLint rule `no-unused-vars` ignores identifiers matching `^[A-Z_]` — uppercase-prefixed unused vars (e.g. unused React component imports) won't fail lint.
- Components are a mix of class components (`App`, `ProjectHome`) and function components with hooks (`AskMe`, etc.). Match the surrounding style when editing a file.
- The Firebase compat API (`firebase/compat/*`) is used intentionally — don't migrate to the modular v9+ API piecemeal.

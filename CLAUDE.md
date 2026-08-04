# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server.
- `npm run build` — production build (output to `dist/`).
- `npm run preview` — serve the production build locally.
- `npm run lint` — ESLint (flat config in `eslint.config.js`). No test runner is configured.

Node 22+ is required (`.nvmrc` and `engines.node` in `package.json`).

## Required environment variables

Create a `.env` in the repo root before `npm run dev`:

- `VITE_FIREBASE_API_KEY` — Firebase Web API key (from Firebase Console → thedavidhanks → project settings). `src/firebase.js` throws on startup if this is missing.
- `VITE_AWS_SKILLS_API_KEY` — API key for the "Ask Me" Lambda (`https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask`). Used only by the `/askme` route.
- `VITE_AWS_APPLY_API_KEY` — API key for the "Apply for Jobs" Lambda. Used only by the `/tools/applyforjobs` route. See `docs/applyforjobs-bedrock-deploy.md` for the backend deploy spec.

## Architecture

Single-page React 19 app bundled with Vite, deployed to AWS Amplify (us-west-2) on push to `master` (see `amplify.yml`).

- `src/main.jsx` is the entrypoint: it constructs the top-level `App` class component, wires `BrowserRouter`, and defines all routes. Adding a new top-level page means adding a `<Route>` here and (usually) a link in the `menuItems` state.
- `src/firebase.js` initializes the Firebase compat SDK (auth + firestore) and exports `auth`, `db`, `provider`. Auth state lives on `App`'s `state.user`; `login`/`logout` use `signInWithPopup`/`signOut` and are passed down to `BSnavbar`.
- `src/components/projects/index.jsx` is its own nested-router subtree: a `projectlist` array drives both the card grid (`CardContainer` → `ProjectCard`) and the per-project routes. To add a project, append to `projectlist` with `{path, element, title, description, tags, imgsrc?}` and create the page component under `src/components/projects/pages/`.
- `src/components/askme/index.jsx` is a chat UI that POSTs `{question, sessionId?}` to the AWS API Gateway endpoint above and types the response character-by-character via a `setInterval`. The `sessionId` returned by the API is reused for follow-up questions to maintain conversation context.
- Styling is Bootstrap 5 + react-bootstrap, with the bundle JS imported once in `main.jsx`.

## Conventions to be aware of

- ESLint rule `no-unused-vars` ignores identifiers matching `^[A-Z_]` — uppercase-prefixed unused vars (e.g. unused React component imports) won't fail lint.
- Components are a mix of class components (`App`, `ProjectHome`) and function components with hooks (`AskMe`, etc.). Match the surrounding style when editing a file.
- The Firebase compat API (`firebase/compat/*`) is used intentionally — don't migrate to the modular v9+ API piecemeal.

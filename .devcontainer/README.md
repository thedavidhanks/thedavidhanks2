# Dev container

Reproduces the Amplify build environment (Debian, Node 22) locally so
`npm ci` / `npm run build` behave the same in the container as they do in CI.

## First run

1. **Create `.env` in the repo root before opening the container.** It is
   gitignored but bind-mounted in with the rest of the workspace, so the
   container sees whatever is on the host. Required keys are listed in the
   root `CLAUDE.md`: `VITE_FIREBASE_API_KEY`, `VITE_AWS_SKILLS_API_KEY`,
   `VITE_AWS_APPLY_API_KEY`.
2. **Dev Containers: Reopen in Container.** `npm ci` runs automatically on
   create.
3. `npm run dev` — port 5173 is auto-forwarded.
4. If Github integration is desired, `gh auth login` will be needed once.

## Why `node_modules` is a volume

The host is Windows and the container is Linux. `esbuild`, `rollup`, and
`firebase` pull platform-specific native binaries, so sharing one
`node_modules` between the two breaks whichever one didn't install last.
The named volume (`thedavidhanks-node_modules`) keeps them separate — the
host install stays intact if you go back to running the app outside the
container.

Side effect: `node_modules` is invisible to the host while the container
runs. To reset it, delete the volume (`docker volume rm
thedavidhanks-node_modules`) and rebuild.

## Claude

The `claude-code` feature installs the CLI and the `anthropic.claude-code`
extension. `/home/node/.claude` is a named volume so history survives
rebuilds, and `setup.sh` populates it from the host on create:

| Host `~/.claude`                       | Container            | How                          |
| -------------------------------------- | -------------------- | ---------------------------- |
| `skills/`, `agents/`, `commands/`, `CLAUDE.md` | same paths   | symlink (live, read-only)    |
| `settings.json`                        | same path            | copied once                  |
| `plugins/`                             | re-installed         | from `settings.json` via git |
| `projects/`, `history.jsonl`, sessions | container-local      | not shared                   |

The host copy is mounted read-only at `/home/node/.claude-host`. It is
deliberately *not* mounted at `/home/node/.claude`: `plugins/installed_plugins.json`
records absolute `C:\Users\...` install paths, and letting the container
rewrite them with Linux paths would break the host setup.

Consequences:

- **Plugins re-install on first launch.** `settings.json` carries
  `enabledPlugins` and `extraKnownMarketplaces`, so the `rice-tss`
  marketplace is re-cloned from Bitbucket — you need credentials for that
  repo in the container (the `github-cli` feature and your git config help,
  but Bitbucket may prompt).
- **Auth is Vertex, not Anthropic OAuth.** `settings.json` sets
  `CLAUDE_CODE_USE_VERTEX=1`. Run `gcloud auth application-default login`
  once; the `gcloud-config` volume persists it across rebuilds.
- **Skills/agents are read-only in the container.** Create new ones on the
  host. Nothing is lost — you just can't author them from inside.
- **Per-project memory and transcripts don't carry over.** Claude keys
  `projects/` by working directory, and the container's path
  (`/workspaces/thedavidhanks`) differs from the host's
  (`C:\Users\dave_\workspace\thedavidhanks`), so it starts a fresh project
  entry. Project-scoped memory written on the host won't be visible inside.

## GitHub CLI

The `github-cli` feature puts `gh` on `PATH`. Authenticate once:

```
gh auth login
```

The token lands in `/home/node/.config/gh/hosts.yml`, which is a named volume
(`gh-config`), so it survives rebuilds the same way `gcloud-config` does. To
force a re-login, `docker volume rm gh-config` and rebuild.

## Notes

- If Vite's HMR misses file changes (can happen with Windows bind mounts
  outside WSL2), either move the repo into the WSL2 filesystem or set
  `server.watch.usePolling = true` in `vite.config.js`.
- No test runner is configured; `npm run lint` is the only check.

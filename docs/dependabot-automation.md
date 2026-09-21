# Dependabot automation

Dependabot raises PRs against `master`, but `master` is what Amplify deploys.
These workflows redirect that work through `dev` and keep a human in front of
production.

| Workflow | Runs | Does |
| --- | --- | --- |
| [`dependabot-to-dev.yml`](../.github/workflows/dependabot-to-dev.yml) | Daily, 06:17 UTC | Finds open Dependabot PRs against `master` and hands each to the workflow below |
| [`dependabot-one.yml`](../.github/workflows/dependabot-one.yml) | Called per PR | Rebase onto `dev` → verify → raise an auto-merging PR into `dev` → close the `master` PR |
| [`dev-to-master-monthly.yml`](../.github/workflows/dev-to-master-monthly.yml) | 1st of the month, 13:00 UTC | Opens a `dev` → `master` promotion PR, assigned to `thedavidhanks` |

All three also accept `workflow_dispatch`, so you can run any of them on demand
from the Actions tab.

## Why a scheduled poll instead of reacting to the PR

Two reasons.

The `pull_request` event would verify the bump sitting on top of `master`. That
is not the tree being merged — `dev` is — so a green run there proves the wrong
thing.

And the write access needed to merge would have to be paired with running
`npm ci` on a dependency that changed minutes ago. Install scripts are arbitrary
code, so the usual `pull_request_target` pattern hands a write-capable token to
the exact thing being vetted. (Dependabot-triggered runs default to a read-only
token and cannot read Actions secrets, but `permissions:` *can* raise the token
— the isolation below is the reason to avoid the pattern, not an inability to
make it work.)

A scheduled run is a trusted context, which buys the three-job split in
`dependabot-one.yml`:

- **prepare** — write token, but runs no npm. Rebases and pushes a working branch.
- **verify** — runs `npm ci` and the build. Read-only token, `persist-credentials: false`
  so no token is on disk, and placeholder `VITE_*` values instead of the real keys.
- **finalize** — write token, but runs no npm. Raises the PR into `dev` with
  auto-merge armed, closes the `master` PR, or files an issue.

Jobs run on separate runners, so anything a hostile postinstall does to the
verify runner — including appending to `$GITHUB_PATH` to hijack later steps —
cannot reach a job that holds credentials.

Placeholder secrets are safe here because [`scripts/check-env.ts`](../scripts/check-env.ts)
only asserts each `VITE_*` name is present and non-blank, and `vite build`
inlines whatever value it is given. The gate is fully exercised without the real
keys.

## How this relates to `dependabot.yml`

[`.github/dependabot.yml`](../.github/dependabot.yml) sets `target-branch: dev`,
so **version** updates are raised against `dev` directly and
[`dependabot-auto-merge.yml`](../.github/workflows/dependabot-auto-merge.yml)
arms auto-merge on them. That covers the scheduled weekly bumps.

It does not cover **security** updates. `target-branch` applies only to version
updates — security updates always target the default branch, and the options in
that ecosystem entry stop applying to them. So security PRs still arrive against
`master`, and that is the gap these three workflows fill. The two halves meet at
the same place: both end with an auto-merging PR into `dev`, gated on the same
`verify` check.

`dev` is branch-protected and requires `verify`, which is why the automation
raises a PR rather than pushing to `dev` directly — a direct push would be
rejected by the protection rule.

## Outcomes per PR

| Situation | Result |
| --- | --- |
| Rebases cleanly, verify green | PR raised into `dev` with auto-merge armed, `master` PR closed with a comment |
| `dev` already has the change | `master` PR closed as superseded, nothing raised |
| Rebase conflicts | Nothing touched, issue opened and assigned |
| Verify fails | No PR raised, `master` PR left open, issue opened and assigned |
| PR into `dev` cannot be opened | Issue opened; usually the Actions PR-creation setting |

Issues are deduplicated by a `dependabot-automation:pr-<n>` marker in the body,
so a PR that fails every day produces one issue, not thirty.

## Expected noise

Dependabot evaluates alerts against the default branch, and an alert is resolved
when the fix reaches that branch. Merging into `dev` therefore leaves the alert
on `master` open until the monthly promotion lands, so the same bump can arrive
again while `dev` already has it. Whether Dependabot re-raises a PR you closed
is not documented either way, so this is built to be correct under both: the
repeat hits the "already applied" path and is closed without merging anything.
Promoting more often than monthly is the way to reduce the churn.

Note that the workflows close PRs with the native `gh pr close` rather than an
`@dependabot close` comment — that command is being retired.

## Manual setup

- **Both scheduled workflows must exist on `master`.** A cron only fires from the
  workflow file as it exists on the default branch, so neither schedule runs
  until these files are merged there. Bootstrapping needs one manual PR.
- **Enable Settings → Actions → General → Workflow permissions → "Allow GitHub
  Actions to create and approve pull requests."** Personal-account repositories
  default to *not* allowed, and without it the monthly `gh pr create` fails.
- **Optionally add an `AUTOMATION_TOKEN` secret** (PAT or GitHub App token). A PR
  opened with the default `GITHUB_TOKEN` starts its checks in an
  approval-required state, so `verify` waits for a human click and auto-merge
  stalls behind it. With the secret set, the PR into `dev` merges unattended.
  Without it everything still works, it just needs one approval per bump.
- **This repo is public, so GitHub disables scheduled workflows after 60 days
  with no repository activity.** If the repo goes quiet, the daily poll stops
  silently and has to be re-enabled from the Actions tab.

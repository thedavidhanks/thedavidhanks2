---
name: next-task
description: Decide what to work on next in this repo. Ranks open GitHub issues (security first, then Dependabot bumps the automation failed to land on dev, then everything else oldest-first), follows "blocked by" chains to the real starting point, and weighs unfinished branches against the pick before recommending one item. Use when the user asks "what's next", "what should I work on", "pick the next issue/task", or wants to triage the backlog.
---

# Pick the next task

Produce **one** recommendation with its reasoning, then offer to start it. The
ranking is mechanical and lives in `gather.mjs`. The judgment calls (unfinished
work, heuristic false positives) are yours, and the rules for them are below.

## 1. Gather

```bash
node .claude/skills/next-task/gather.mjs        # --no-fetch to skip git fetch, --top=N for a longer list
```

It takes about 10–20 s (one `gh api` call per issue for native blockers). The
JSON contains:

| Field | Meaning |
| --- | --- |
| `pick` | Top-ranked item after following blockers. `chain` is the path walked, e.g. `[46, 69]` means #46 is blocked by #69, so start with #69. `cycle` is set if blockers loop, and `number` is then `null`. |
| `ranked` | Top N actionable items in priority order: `tier`, then `createdAt` ascending |
| `skipped` | Open issues excluded from ranking, with the reason (`wontfix`/`duplicate`/`invalid` label, or a Dependabot tracking issue whose bump `dev` already contains) |
| `pendingDependabot` | Dependabot PRs against `master` that the daily automation has not processed yet. Not candidates: tonight's run may land them. |
| `hygiene` | Housekeeping to offer, never to do silently |
| `wip` | Branches with commits not on `origin/dev` (patch-id aware), plus their issue refs and overlap with the pick's cited files |
| `workingTree` | Current branch and `git status --porcelain` |
| `warnings` | Degraded inputs (fetch failed, Dependabot alerts unreadable). Repeat them in your report. |

## 2. How the ranking works

Tiers, highest first. Within a tier, the oldest `createdAt` wins.

1. **security**: any of
   - the `security` label (definitive);
   - title/body text matching `GHSA-…`, `CVE-…`, `vulnerab…`, `security advisory`, `exploit…`;
   - a Dependabot bump whose package has an **open Dependabot alert**.

   Bare "security" is deliberately not a signal, because "Firestore security
   rules" appears in ordinary feature work (#78). If a text match is clearly a
   false positive, say so and rank the item as if it were `normal`.
2. **stuckDependabot**: a Dependabot PR still open against `master` after a
   completed `dependabot-to-dev.yml` run processed it. On success,
   `dependabot-one.yml` closes the master PR and opens one into `dev`, so
   "still open after processing" means it failed to land. A rebase conflict
   fails no job: `prepare` and `finalize` succeed and `verify` is skipped. The
   job results only explain *why*, recorded as `lastAttempt.outcome`:
   `rebase-conflict`, `job-failed` or `not-landed`. A failing check on the PR
   itself also counts. The item appears as its tracking issue
   (`<!-- dependabot-automation:pr-N -->` in the body) if one exists, or as
   `kind: "dependabot-pr"` otherwise (e.g. when the issue step itself failed).
3. **normal**: everything else, including Dependabot tracking issues whose PR
   was closed without the bump reaching `dev`.

**Blockers** are the union of GitHub's native "blocked by" relationships and
`Blocked by #N` / `Depends on #N` text in the body. Only open blockers count. At
a fork, the walk follows the highest-ranked blocker. A cross-repo or PR
reference is ignored; mention it if you notice one.

## 3. Weigh unfinished work against the pick

Look at `workingTree` and `wip` before recommending `pick`. Apply these rules in order.

1. **Uncommitted changes**: if `dirty` lists anything besides this skill's own
   output, lead with it. Ask whether to finish, commit or stash before switching.
   Never stash or discard on your own.
2. **WIP for the pick or anything in its chain**: a branch whose `openIssueRefs`
   or name contains the number, or with an open PR closing it. Recommend
   **resuming that branch** instead of starting fresh. Report `behind` so the
   user knows a rebase/merge from `dev` is due.
3. **WIP that must land first**: a branch with recent commits (roughly the last
   30 days) that either
   - has non-empty `overlapWithPick` (starting the pick in parallel would set up
     a merge conflict), or
   - belongs to an item ranked *above* the pick.

   Recommend finishing it first. Before claiming overlap, inspect the diff
   (`git diff origin/dev...<branch> --stat`), because cited-file matching is a
   heuristic.
4. **Everything else** (old, unrelated, no PR): list it briefly under
   "Unfinished branches" as possibly abandoned. It does not displace the pick.
   `origin/wordle-tool` (2022) is an example.

To judge what a branch is for when it has no issue refs, read its log:
`git log --oneline origin/dev..<branch>`.

## 4. Report

Keep it short. Use this shape:

```markdown
**Next: #69 — Align Node version on 24 across devcontainer, CI and Amplify**
<url>

Why: #46 (security, oldest) is blocked by #69 (native relationship), so #69 comes first.
<or: "Resume branch fix/foo-69 — 3 commits, 12 behind dev." / "Finish pr61fix first — it touches package-lock.json, which the pick also changes.">

Up next:
1. #46 — … (security)
2. #35 — … (2026-09-25)
3. …

Housekeeping (say the word and I'll do these):
- Label #46 `security` (matched "security advisory")
- Close #75, #67, #28: `dev` already contains those Dependabot bumps
- Branches already merged by patch-id, safe to delete: …
```

Before writing "Why", read the pick with `gh issue view <n>` (or `gh pr view
<n>` for `kind: "dependabot-pr"`). The JSON omits bodies to keep it small. This
repo is public: if the pick links a private advisory (GHSA), you may read it
for context, but never quote its details in an issue comment, PR or commit.

## 5. Offer to start, and on "yes"

End by asking whether to start. Do nothing that changes state until the user agrees.

On yes:

1. Make sure the tree is clean (see rule 1). Then either
   - **resume**: `git switch <branch>` (for a remote-only branch, `git switch -c <name> --track origin/<name>`); or
   - **start fresh**: `git switch -c <type>/<slug>-<number> origin/dev`, where
     `type` is `fix`, `feat`, `chore`, `docs` or `ci`. This matches existing
     branches like `fix/msw-unhandled-frame-68`.
   - **stuck Dependabot bump**: branch from `origin/dev`, run `npm install <pkg>@<target>`,
     resolve `package-lock.json`, and run `npm run verify`. When the bump
     lands on `dev`, close the master PR and the tracking issue with a comment
     linking the dev PR, as the automation would have.
2. Hand the work to the **code-writer** agent. Give it the issue's
   `## Agent prompt` section verbatim (every issue here embeds one), the issue
   URL, the branch name, and any WIP context from step 3.
3. Do not push, open a PR or close issues unless the user asks. Pushing straight
   to `dev` is allowed for the owner, but it is their call.

## Housekeeping actions (only when asked)

```bash
gh issue edit <n> --add-label security
gh issue close <n> --comment "Superseded: dev already has <pkg>@<version>."
gh api -X POST repos/{owner}/{repo}/issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker's numeric id>   # id: gh api repos/{owner}/{repo}/issues/<blocker> --jq .id
git branch -d <branch>     # local only; remote deletion needs explicit approval
```

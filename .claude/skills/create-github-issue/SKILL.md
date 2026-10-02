---
name: create-github-issue
description: Create a GitHub issue in this repo with the house format — plain-English summary, background with file:line citations, an embedded agent prompt, testable acceptance criteria, and always an assignee. The repo is public, so the skill also covers keeping secrets and unpatched vulnerabilities out of issues. Use whenever the user asks to file, open, or create an issue, or to turn a bug/idea/finding into one.
---

# Create a GitHub issue

Issues in `thedavidhanks/thedavidhanks2` are written to be handed straight to a
coding agent. An issue that only describes a symptom is incomplete — it forces
the next person to re-derive the context. Every issue carries its own briefing.

## This repo is public — read this first

`thedavidhanks/thedavidhanks2` has **public** visibility, so every issue, title,
comment and edit is world-readable and indexed by search engines. Issue edits do
not erase history: the original text stays in the issue's edit history and in
any notification email already sent. Treat anything you type as permanent and
published.

Two things therefore never go in an issue.

### 1. Secrets

Never paste a live credential, even to illustrate a bug. That includes:

- `VITE_FIREBASE_API_KEY`, `VITE_AWS_SKILLS_API_KEY`, `VITE_AWS_APPLY_API_KEY`
  and any other `.env` value
- AWS access keys, session tokens, Amplify app IDs paired with account IDs
- Firebase service-account JSON, `.firebaserc` private config
- Signed URLs, bearer tokens, or cookies captured from a browser or `curl -v`
- Full `env`, `printenv`, or `aws sts get-caller-identity` output

Redact instead, keeping enough shape to be useful:

```
VITE_AWS_SKILLS_API_KEY=<redacted, 40 chars, starts "k9Q">
Authorization: Bearer <redacted>
```

Scrub command output before pasting it — `curl -v`, CI logs and build output all
leak headers and environment values. Describe a secret by **name and location**
("the key set in Amplify → Environment variables"), never by value.

If you discover a real secret already committed or already published in an
issue, **stop and tell the user immediately**. Rotation comes first; redacting
the text is not a fix, because the value is already public.

### 2. Unfixed vulnerabilities

Do not open a public issue that explains how to exploit an unpatched weakness in
the live site. A public issue is a disclosure with a working recipe attached, and
the site stays vulnerable until it is fixed.

This covers: exploitable auth or Firestore rule gaps, injection paths, exposed
admin endpoints, anything with a concrete attack sequence against
`www.thedavidhanks.com` or the Lambda endpoints.

Instead:

- Report it privately — GitHub Security tab → **Report a vulnerability**
  (private advisory), or just tell the user directly in chat. Ask the user which
  they prefer; do not pick a public issue by default.
- Once it is fixed and deployed, a public issue or PR describing the fix is fine.

**Hardening review work is not in this category** and belongs in a normal public
issue — e.g. #46, "evaluate correct use and security of the Firebase Web API
key". The line is whether the text hands a stranger a working exploit against
production. "Our Firestore rules should be audited" is fine; "send this payload
to this collection to read every user's data" is not.

When in doubt, ask the user before filing rather than after.

## Assignee (required)

Every issue gets an assignee. There is no such thing as an unassigned issue here.

- If the user names someone, use their GitHub login.
- **If no one is specified, assign `dphanks@gmail.com`** — that email maps to the
  GitHub login **`thedavidhanks`**. `gh` takes logins, not emails, so always pass
  `--assignee thedavidhanks`.
- If `gh issue create` rejects the assignee (not a collaborator), create the
  issue anyway and say so in your reply rather than dropping the field silently.

## Before writing

Gather the facts the issue needs to stand on its own:

1. Reproduce or confirm the problem if it is observable (run the command, curl
   the URL, run the test). Paste the real output — never invented output, and
   never un-scrubbed output (see the public-repo rules above).
2. Find the relevant code and note `file.ext:line` references.
3. Check for related issues: `gh issue list --state all --limit 30` or
   `gh search issues --repo thedavidhanks/thedavidhanks2 <keyword>`. Cross-link
   with `#N`.
4. Note anything that cannot be fixed by a commit alone (AWS Amplify console
   settings, environment variables, Firebase config) — call it out explicitly.

## Title

Short, specific, states the problem or the change — not the area. Lead with the
observable fact when there is one.

- Good: `Every route except / returns HTTP 404, after a 301 that appends a trailing slash`
- Bad: `Routing issues`

Prefix `[Tier N]` only when the user has given a priority tier.

## Body format

Use exactly these sections, in this order. Write the body to a temp file and
pass `--body-file` so backticks and `$` in code blocks survive the shell.

```markdown
## Summary

Two to four sentences a non-expert can follow. What is wrong (or what should
exist), what the user-visible consequence is, and where it shows up. Say whether
it is a regression or long-standing. No jargon that is not unpacked.

## Background

The technical detail: how the relevant code works today, with `file.ext:line`
citations. Include the real evidence — command output, curl headers, a failing
test, a table of observed values. State what is NOT in the repo if that matters
(e.g. "the rule lives in the Amplify console, so a commit alone cannot fix it").
Cross-reference related issues with `#N`.

## Agent prompt

> A fully blockquoted, self-contained brief. Assume the reader has the repo and
> nothing else — no access to this thread. Cover, in this order:
>
> **Stack and context.** The repo, framework versions, how the relevant subsystem
> is wired, where the files live.
>
> **Problem.** What is broken and how to see it. Give the exact command so the
> agent verifies before changing anything.
>
> **Task.** What to do. Be concrete about the approach where the approach is
> already decided; leave it open where it genuinely is.
>
> **Constraints / do-nots.** Conventions from `CLAUDE.md` that apply (Firebase
> compat API stays, Node test runner for `src/lib/**`, new routes need a `PAGES`
> entry in `src/App.test.jsx`, etc.), and any tradeoff that must be surfaced
> rather than silently accepted.
>
> **How to verify.** The exact commands that prove it works, and what output
> counts as passing. Include known verification gotchas (edge caching, stale
> builds, which test runner owns which files).

## Acceptance criteria

- [ ] One checkbox per independently testable outcome
- [ ] Each states an observable result, not an activity — "every route returns 200",
      not "fix the routing"
- [ ] Include the verification/test requirement as its own box
- [ ] Include any docs or `CLAUDE.md` update the change implies
```

### Examples of failure and success

Include concrete before/after whenever the problem is observable — inside
**Background** for what fails today, and inside the agent prompt's **How to
verify** for what success looks like. Real pasted output, formatted as a code
block or table:

```
$ curl -sI https://dev.thedavidhanks.com/about/
HTTP/2 404          # today — the failure

Every line must read 200.   # after the fix — the success
```

If the problem is not observable from the outside, give a failing-test sketch or
a worked input → wrong-output example instead.

## Creating it

```bash
gh issue create \
  --repo thedavidhanks/thedavidhanks2 \
  --title "<title>" \
  --body-file /tmp/issue-body.md \
  --assignee thedavidhanks \
  --label bug
```

Labels are optional; only use ones that already exist (`gh label list`) —
`bug`, `enhancement`, `question`, `help wanted`, `good first issue`,
`documentation` if present. Do not invent labels.

Report the issue URL back to the user.

## Checklist before you run `gh`

- [ ] **No secrets anywhere** in the title, body, or pasted output — keys, tokens,
      signed URLs, `.env` values, `curl -v` headers, CI logs
- [ ] **No exploit recipe** for an unpatched vulnerability; if that is the subject,
      route it privately instead of filing publicly
- [ ] Assignee set (`thedavidhanks` by default)
- [ ] Summary is readable by someone who has never seen the code
- [ ] Background cites `file.ext:line` and shows real, un-invented output
- [ ] Agent prompt is fully blockquoted and self-contained — no "as described above"
- [ ] Agent prompt says how to verify, with exact commands
- [ ] Acceptance criteria are checkboxes, each independently testable
- [ ] Anything requiring a console/dashboard change is flagged as not-a-commit

---
name: concurrent-agents-git
description: Never use git stash/checkout to get a baseline when other agents may be editing the same worktree
metadata:
  type: feedback
---

Do not run `git stash`, `git checkout -- <file>`, or any tree-wide revert to obtain
a "before" baseline while another agent may be working in the same worktree.

**Why:** During the layout.ts gutter-routing task I ran `git stash` to measure the
pre-change behaviour. It stashed a *different* agent's in-progress tracked edits
(docs/satisfactory-sink-maximizer.md, PlanResults.jsx, index.jsx) and — because the
file I actually wanted to revert was untracked — did not even produce the baseline I
was after. Restored with `git stash pop`, but the window was real.

**How to apply:** To measure "before", copy the file to /tmp *before* editing it, or
use `git show HEAD:<path>` into a scratch file. Both are read-only with respect to the
working tree. If a task brief says another agent is editing a file, treat the whole
worktree as shared mutable state, not just that file.

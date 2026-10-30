# Firestore security rules

[`firestore.rules`](../firestore.rules) is the source of truth for this
project's Firestore access control. This document covers how to deploy it,
verify it, and roll it back.

Same situation as [amplify-redirects.md](amplify-redirects.md): configuration
that lives in a cloud console rather than in the build. The difference is that
rules *can* be deployed from the repo, so they should be — a rule change is
then reviewable in a PR instead of being one misclick in a console.

## What this ruleset replaced

Until 2026-10-30 the rules existed only in the Firebase console, and read:

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read;                                      // <-- see below
    }
    match /Games/PM2ahWu01w0wb5KQcoV8/Points/{PointsID} {
      allow write: if isSignedIn();
    }
    function isSignedIn(){ return request.auth.uid != null; }
  }
}
```

Two things mattered about it:

1. **`allow read;` is `allow read: if true`.** On `/{document=**}` that is an
   unauthenticated public read of every document in the database. With only
   NWmap's map points stored, the practical impact was nil — those are meant to
   be public. It would have become a real exposure the moment saved job
   applications landed, since anyone could then read every user's resumes and
   job postings without signing in.
2. **Nothing outside the NWmap path could be written at all.** There was no
   other `allow write`, so `users/{uid}/jobApplications` writes were denied.
   The Apply for Jobs history feature cannot function against this ruleset.

Both rulesets were run through the emulator with `npm run check:rules` before
the replacement was written, which is where those statements come from rather
than from reading the rules by eye.

## What the current file does

- Removes the global read. There is no catch-all match block; anything not
  named below is denied by default.
- `users/{userId}/{document=**}` — owner-only read and write, enforced by
  `request.auth.uid == userId`. Recursive, so the planned per-user knowledge
  base (`users/{uid}/knowledgeBase/*`) is already covered. See
  [applyforjobs-history.md](applyforjobs-history.md).
- `Games/PM2ahWu01w0wb5KQcoV8/Points/{pointId}` — public read, authenticated
  write, reproducing NWmap's previous behavior exactly. The game id is pinned
  rather than wildcarded so a signed-in user cannot create points under
  arbitrary game documents.
- Adds `rules_version = '2'`. The console ruleset declared none, so it ran as
  v1. v2 is the current default and the correct semantics for recursive
  wildcards.

## Before deploying

The deploy replaces the console ruleset wholesale, and the big behavioral
change is that global public read goes away. Confirm nothing depends on it:

1. Open the console **Data** tab and list top-level collections. Expect only
   `Games` (and `users` once the feature has run). A third collection that
   something reads would start returning permission-denied.
2. Run the checks locally:

   ```bash
   npm run emulators     # terminal 1
   npm run check:rules   # terminal 2 -- all cases must pass
   ```

## Deploying

```bash
npx firebase login
npx firebase deploy --only firestore:rules --project thedavidhanks-559b0
```

Rules take effect within seconds; there is no build or propagation delay to
wait out.

Deploy the rules **before** merging the app to `master`. A bad ruleset then
affects only NWmap, which is trivially reversible, instead of silently breaking
a feature users are already touching.

## Verifying after deploy

1. Load `/tools/nwmap` on the live site **signed out** — markers must still
   render. This is the regression the deploy could plausibly cause.
2. Sign in and add a point — it must still save.
3. Once the app ships, generate an application and confirm it appears under
   "Past applications", and that `users/{uid}/jobApplications` is populated in
   the console Data tab.

## Rolling back

The console keeps every published ruleset.

1. Firebase Console → Firestore Database → **Rules**
2. Open the **History** dropdown (next to the Publish button) — it lists past
   rulesets with publish timestamps.
3. Select the previous entry and publish it. Effective immediately.

Direct link:
<https://console.firebase.google.com/u/0/project/thedavidhanks-559b0/firestore/databases/-default-/security/rules>

A rollback restores the global `allow read`, so treat it as a stopgap: fix the
rules file, re-run `npm run check:rules`, and redeploy rather than leaving the
old ruleset in place.

## Keeping it honest

- The emulator reads `firestore.rules` **once at startup** and does not
  hot-reload. Restart `npm run emulators` after editing, or you are testing the
  previous ruleset. See
  [local-firebase-emulator.md](local-firebase-emulator.md).
- `npm run check:rules` is not part of `npm run verify` — it needs a running
  emulator, the same reason `check:routes` is excluded for needing the network.
  Run it by hand whenever the rules change.
- If anyone edits the rules in the console, copy them back into this repo in
  the same sitting. Otherwise the next deploy silently reverts their change.

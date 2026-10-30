# Apply for Jobs — saved application history

Design spec for persisting `/tools/applyforjobs` inputs and outputs so a
signed-in user can review past submissions. Companion to
[applyforjobs-bedrock-deploy.md](applyforjobs-bedrock-deploy.md), which lists
this feature under "Out of scope (future)" as *"Persisting prior generations
per user in DynamoDB"* — that line is superseded by this document.

## Decisions

| Question | Decision |
| --- | --- |
| Where records live | **Firestore**, per-user subcollection |
| Company / position for the list label | **Two optional form fields** on the submit form |
| When a record is written | **Auto-save on a successful generation**, then update in place when the user edits the result |
| History actions | View inputs + outputs read-only, download PDF, delete |

### Why Firestore and not DynamoDB

The deploy doc's original instinct was DynamoDB, next to the Lambda. The
blocker is identity. `/apply` is secured by a single shared API key
(`VITE_AWS_APPLY_API_KEY`); the Lambda has **no idea which user is calling**.
Storing per-user records server-side therefore requires implementing Firebase
ID-token verification in the Lambda first — itself listed as out of scope —
and without it any signed-in user could read every other user's applications.

Firestore inverts that cost to zero:

- `src/firebase.js` already initializes and exports `db`; the dependency is
  installed and bundled today.
- The route is already gated on a Firebase login
  ([src/components/tools/index.jsx:31](../src/components/tools/index.jsx#L31)),
  so `request.auth.uid` is available in security rules and ownership is
  enforced by the database rather than by application code.
- No backend change at all: no new Lambda, no new API Gateway route, no
  change to the `/apply` request or response shape.

The tradeoff accepted: application records live in Firebase while the
generation backend lives in AWS. That split already exists — Firebase owns
auth — and this puts user data with the service that owns user identity.

S3 was rejected for the same auth reason plus no query/sort: building the
"list my submissions" view would mean a prefix scan or a hand-rolled index.

## Data model

```
users/{uid}/jobApplications/{applicationId}
```

A subcollection, not a top-level collection with a `userId` field. Two
reasons: the security rule becomes a one-liner, and `orderBy` on a single
field inside a subcollection needs no composite index, whereas
`where('userId', '==', uid).orderBy('createdAtMs')` would.

### Document shape

```js
{
  schemaVersion: 1,

  // Label fields — drive "{datetime} - {company} {position}".
  company:  'Acme Corp',       // string, '' if the user left it blank
  position: 'Staff Engineer',  // string, '' if the user left it blank

  // Ordering. createdAtMs is the sort key; createdAt is the trustworthy
  // audit value. See "serverTimestamp and the pending-write window" below.
  createdAtMs: 1761609600000,          // Number, Date.now() at submit
  createdAt:   <serverTimestamp>,      // Timestamp
  updatedAt:   <serverTimestamp>,      // Timestamp, bumped on edit-save

  // Inputs, exactly as submitted.
  jobPosting:       '…',       // string, capped (see below)
  applicantContext: '',        // string, '' when the user added none

  // Outputs. Mirrors the live editor state, so edits are reflected here.
  coverLetter: '…',            // markdown
  resume:      '…',            // markdown

  sessionId: 'abc123',         // string | null, as returned by /apply
}
```

**Size cap.** A Firestore document is limited to 1 MiB. A realistic record is
5–20 KB, but a pathological paste (someone dumping a whole careers page)
could exceed it and make the write fail *after* a paid Bedrock generation has
already succeeded. Truncate `jobPosting` to 200 KB before writing and mark it
with a trailing `\n\n[truncated]`. Never let a storage failure lose the
generated output — see error handling below.

**No `original` snapshot.** The decision was "auto-save, then update on
edit", so only the current text is stored. If an immutable record of what
Bedrock originally produced is wanted later, add `original: { coverLetter,
resume }` written once at create time and never updated; bump
`schemaVersion`.

### serverTimestamp and the pending-write window

`firebase.firestore.FieldValue.serverTimestamp()` resolves to `null` in the
local snapshot until the server acknowledges the write. A list ordered on
`createdAt` would therefore sort the just-saved record unpredictably and
render its label as "Invalid Date" for a moment. Order and label off
`createdAtMs` (a plain client-side `Date.now()` number), and keep
`createdAt` for audit only.

## Security rules

The repo has **no `firestore.rules` file** — rules are configured in the
Firebase console, the same out-of-repo-config situation as the Amplify
redirects. Follow the precedent set by
[amplify-redirects.md](amplify-redirects.md): commit the intended rules here
as the source of truth and keep this document in sync when the console
changes.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId}/jobApplications/{applicationId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

  }
}
```

Before shipping, **check the project's current default rule**. If the
database is still in test mode (`allow read, write: if true`) or fully
locked (`if false`), the block above must be merged in deliberately —
test mode would expose every record publicly, and the locked default would
silently reject every write.

Note that nothing here is secret in the repo-publication sense: the records
contain pasted job postings and generated application material, scoped to
one user. No credentials are stored.

## Multi-user readiness

The tool is **already multi-user**: `RequireAuth` admits any signed-in Google
account and there is no allowlist anywhere in `src/`. What is single-user is
the *knowledge base* — David's master resume is hardcoded into the Lambda's
system prompt
([applyforjobs-bedrock-deploy.md](applyforjobs-bedrock-deploy.md#L99-L113)).
The stated goal is for other users to supply their own.

### What this storage design already gives you

Per-user isolation is **structural rather than query-based**. Records live at
a path containing the uid, so there is no `userId` column to filter on and no
query that can accidentally span users. The rule
`request.auth.uid == userId` is enforced by Firestore itself, so a modified
client cannot read across accounts. Everything under `users/{uid}/` is
namespaced for free, which is also where a per-user knowledge base belongs:

```
users/{uid}/jobApplications/{id}   ← this document
users/{uid}/knowledgeBase/master   ← the future per-user resume corpus
```

Widen the rule to cover both with a recursive match:

```
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### What "securely" does and does not mean here

- **Does**: encrypted in transit (TLS) and at rest with Google-managed keys;
  cross-user reads blocked server-side by rules, not by client code.
- **Does not**: this is not end-to-end encrypted. Google can read it, and so
  can anyone with Firebase console access to the project — i.e. the project
  owner can read every user's saved resumes and postings. If that is not
  acceptable once real users exist, say so in the privacy copy rather than
  trying to solve it with client-side encryption, which would break the
  server-side generation flow anyway.
- **The rules are the only defense.** Before other users exist, move
  the rules out of the console: commit `firestore.rules` plus a `firebase.json`
  and deploy with `firebase deploy --only firestore:rules`, so the isolation
  guarantee is reviewable in a PR instead of being one misclick in test mode
  away from exposing other people's PII.
- Once there are real users, add **shape and size validation** to the rules
  as well — cap string lengths and reject unexpected fields, so one account
  cannot exhaust the project's shared free-tier storage.

### The actual blocker for per-user knowledge bases

Not storage — **identity at the Lambda**. `/apply` authenticates with a single
shared `x-api-key`, so the backend cannot tell who is calling and therefore
cannot pick the right knowledge base. Two ways out:

1. **Client sends its own knowledge base** in the `/apply` request body,
   reading it from `users/{uid}/knowledgeBase/master`. No token verification,
   no new service, no backend auth work — and it is not a "trusting the
   client" hole, because a user can only ever send their *own* corpus and can
   only affect their *own* generation. The cost is prompt caching: the system
   prompt stops being a single static blob and becomes one cache entry per
   user. At a few KB per resume that is acceptable. **Recommended.**
2. **Lambda verifies the Firebase ID token** and loads the corpus server-side.
   Correct and necessary if the corpus must ever be read outside the browser,
   but it means JWK verification in the Lambda plus a server-side store to
   keep in sync with Firestore.

Either way the storage decision in this document holds, which is the main
reason to be comfortable with it: the per-user KB lands as a sibling path
under `users/{uid}/` with no new service.

### Unrelated gap that multi-user makes worse

`VITE_AWS_APPLY_API_KEY` is inlined into the public JS bundle at build time —
that is how Vite handles `VITE_`-prefixed vars, and it is what the
`check:env` guard in `CLAUDE.md` is describing. The login gate does not
protect it: the key ships to every visitor whether or not they sign in, so
anyone can extract it and call `/apply` directly against your Bedrock spend.
Today the 100/day usage-plan quota caps the damage. With real users that
quota becomes a shared bucket one abuser can drain for everyone, and
per-user rate limiting is impossible while the key is shared. This is
pre-existing and out of scope for history storage, but it should be fixed
before inviting other users — and option 2 above (ID-token verification)
would solve it as a side effect.

## Front-end changes

### 1. Get the uid into the component

`toollist.jsx` builds `element: <ApplyForJobs />` — a pre-constructed element
with no props — so the component cannot currently see the signed-in user.
`RequireAuth` already receives `user`. Have it inject:

```jsx
// RequireAuth.jsx — the gate already has the user, so hand it to the tool.
return React.cloneElement(children, { user });
```

This is generic and benefits any future auth-gated tool. Preferred over
reading `auth.currentUser` inside `ApplyForJobs`, which races with auth
hydration and bypasses the `user` state `App` already maintains.

### 2. New module: `src/components/tools/applyforjobs/history.js`

Keep all Firestore access in one module so `index.jsx` stays a view. Use the
**compat API** (`db.collection(...)`), consistent with the rest of the repo —
do not introduce modular v9 calls here.

```js
const collectionFor = (uid) =>
    db.collection('users').doc(uid).collection('jobApplications');

subscribeToApplications(uid, onChange)  // orderBy('createdAtMs','desc').limit(50).onSnapshot
createApplication(uid, record)          // .add(...) -> returns docRef.id
updateApplicationOutputs(uid, id, { coverLetter, resume })  // .doc(id).update(...)
deleteApplication(uid, id)              // .doc(id).delete()
```

`limit(50)` bounds reads; add pagination only if the list ever outgrows it.

### 3. `index.jsx` — submit form

Add two optional inputs above the job-posting textarea:

- `Company` (`id="company"`)
- `Position` (`id="position"`)

Both optional — a blank value must not block submit, since the existing
`disabled={loading || !jobPosting.trim()}` rule is the only gate. Render a
missing value as `—` in the list label rather than producing a ragged
`"2026-10-28 -  "`.

These fields are **label-only for now**. Feeding them into the `/apply`
prompt to improve the generation is a reasonable follow-up but is a backend
change and is out of scope here.

### 4. `index.jsx` — save lifecycle

**On successful generation**, immediately after `setResult(...)`:

```
createApplication(uid, { company, position, jobPosting, applicantContext,
                         coverLetter, resume, sessionId })
  → store the returned id in state as `savedId`
```

**On edit**, the result textareas stay editable. Debounce writes at ~1500 ms
of idle typing and flush on `startOver` and on unmount, calling
`updateApplicationOutputs`. Without a debounce, every keystroke is a write —
bad for the 20k/day free quota and pointless.

**On error**, a failed save must never look like a failed generation. Show a
non-blocking inline notice ("Couldn't save this to your history") and leave
the result on screen and downloadable. Do not clear `result`, and do not
reuse the red `error` alert that currently means "generation failed".

**When unauthenticated**, skip persistence entirely. In practice `RequireAuth`
makes this unreachable, but the component should not throw if `user` is
absent — that would break any test or future unauthenticated embed.

### 5. `index.jsx` — history menu and detail view

Per the spec: a menu, a summary list, and a read-only detail view.

- A react-bootstrap `Dropdown` labeled **"Past applications"** in the page
  header, next to the `<h3>`. Items read
  `{datetime} - {company} {position}`, formatted from `createdAtMs` with
  `toLocaleString()`. Show an empty state ("No saved applications yet")
  rather than an empty menu.
- Selecting an item switches the page into a **read-only detail view** with a
  "Back" button, replacing the form/result panel. Not a modal — the PDF flow
  opens a popup window and the documents are long.
- The detail view shows, in order: company/position/date header, the saved
  job posting, the applicant context (omit the section when empty), the cover
  letter, and the resume.
- **Read-only means rendered, not disabled textareas.** Run the stored
  markdown through the existing `marked` + `DOMPurify` pair already imported
  in this file and render into a `div`. That both enforces non-editability and
  visually distinguishes history from the live editor. Reuse the sanitize
  call — stored text is user-supplied and must not be injected raw.
- Per-document **print/PDF buttons** reusing the existing `downloadPdf(title,
  markdown)` helper unchanged, one for the cover letter and one for the
  resume.
- A **Delete** button with a confirmation step. On delete, return to the
  form view if the deleted record is the one being viewed.

No new route is introduced — the history view is component state under the
existing `/tools/applyforjobs` URL. This deliberately avoids touching the
`PAGES` map in `src/App.test.jsx`, which requires a unique heading per new
URL.

## Testing impact

The shared Firestore mock in
[src/test/setup.jsx:17-23](../src/test/setup.jsx#L17-L23) only implements
`collection().onSnapshot` and `collection().add` — enough for `NWmap`, not
enough for this feature. It must grow a chainable `doc()`, nested
`collection()`, `orderBy()`, `limit()`, `update()` and `delete()`, or the new
code will throw on `db.collection('users').doc(uid)`. Keep it chainable and
generic so it does not become applyforjobs-specific.

New `npm run test:ui` coverage to add:

1. A successful generation writes a record (assert the `add` payload carries
   company, position, both inputs and both outputs).
2. A failed write still renders the result and shows the non-blocking notice.
3. The dropdown lists saved records in reverse-chronological order with the
   `{datetime} - {company} {position}` label.
4. The detail view renders inputs and outputs and exposes **no** editable
   control (assert no `textbox` role in the detail panel).
5. Delete removes the record and returns to the form view.

Existing MSW handlers in `src/test/server.js` already cover `/apply`; no new
network handler is needed, since persistence never leaves Firestore.

## Cost

Firestore's free Spark tier covers 1 GiB stored, 50k document reads, 20k
writes and 20k deletes per day. At ~15 KB per application that is roughly
70,000 saved applications before the storage tier matters, against a user
base of one. Expected cost: **$0**, indefinitely. The debounce on edit-saves
is the only thing standing between normal use and the write quota, which is
why it is not optional.

## Implementation checklist

- [x] `firestore.rules` + `firebase.json` committed, using the wider recursive
      `/users/{userId}/{document=**}` match, and diffed against the live console
      ruleset. The old ruleset granted `allow read` on `/{document=**}` (global
      unauthenticated read) and permitted no writes outside NWmap's path, so it
      both exposed data and made this feature impossible. **Still outstanding:**
      deploy it — see [firestore-rules.md](firestore-rules.md)
- [x] `RequireAuth` injects `user` into its child
- [x] `history.js` Firestore module (compat API)
- [x] Company / position fields on the form
- [x] Auto-save on success + debounced edit-save + non-blocking save-error UI
- [x] Past-applications dropdown and read-only detail view with print + delete
- [x] Extend the Firestore mock in `src/test/setup.jsx`
- [x] Component tests (five cases above)
- [x] Update the "Out of scope" list in `applyforjobs-bedrock-deploy.md` to
      point here
- [x] Note the new Firestore collection in the Architecture section of
      `CLAUDE.md`

## Out of scope

- Re-running a saved posting as a fresh submission.
- Feeding company/position into the Bedrock prompt.
- Server-side persistence / Firebase ID-token verification in the Lambda.
  Revisit only if the records ever need to be readable outside the browser.
- Full-text search over saved postings.

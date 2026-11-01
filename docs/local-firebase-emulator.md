# Testing against the local Firebase emulators

How to run the app locally with auth and Firestore served by the Firebase
Emulator Suite instead of the real `thedavidhanks-559b0` project.

Use this when you are working on anything that reads or writes Firestore —
`/tools/applyforjobs` saved application history, `/tools/nwmap` map points — or
when you want to verify [`firestore.rules`](../firestore.rules) before
deploying it. Nothing you do in emulator mode touches the real project.

## Why bother

Two reasons specific to this repo:

1. **`firestore.rules` is unverified.** It was reconstructed from the source,
   not exported from the Firebase console, and `firebase deploy --only
   firestore:rules` **replaces the console ruleset wholesale**. The emulator
   loads the same file, so a rule that denies something the app needs fails
   here instead of in production. See the banner comment in the rules file.
2. **Generations cost money.** Saved history records are only written after a
   successful `/apply` call, which is a real Bedrock invocation against a
   100/day usage plan. Emulator mode does not change that — the Lambda is still
   remote — but it does mean you can delete and re-read records freely without
   polluting the real database.

## One-time setup

**JDK 21 or newer** is required — the Firestore emulator is a Java process, and
current `firebase-tools` refuses to start on anything older. Debian bookworm
ships JDK 17 in its main repos, which is *not* sufficient.

```bash
java -version   # must report 21 or higher
```

If it does not, install a JDK 21+ runtime by whatever means suits your machine
(`apt install openjdk-21-jre-headless` where available, Homebrew, SDKMAN, or an
[Adoptium Temurin](https://adoptium.net/) tarball). `firebase-tools` itself is
already a devDependency, so `npm install` is all else that is needed.

## Running it

Two terminals.

```bash
# Terminal 1 — emulators (firestore :8080, auth :9099, UI :4000)
npm run emulators

# Terminal 2 — dev server pointed at them
npm run dev:emulator
```

Then open the app, and the emulator UI at <http://127.0.0.1:4000> alongside it
to watch documents appear.

`npm run dev:emulator` is just `npm run dev` with `VITE_FIREBASE_EMULATOR=true`.
Plain `npm run dev` still talks to the real project, so the switch is explicit
and opt-in.

### Signing in

The auth emulator does not talk to Google. Clicking **Login** opens the
emulator's own account picker, where you can add a test user; it issues a real
ID token with a real `uid`, which is what the security rules check.

This makes multi-user isolation easy to test, which is worth doing given the
per-user plans in
[applyforjobs-history.md](applyforjobs-history.md#multi-user-readiness):
create two test users, save an application as each, and confirm neither can see
the other's. The emulator UI shows every document, so you can also confirm the
records really are namespaced under `users/{uid}/jobApplications`.

### Verifying the rules automatically

With the emulators running:

```bash
npm run check:rules
```

[`scripts/check-firestore-rules.ts`](../scripts/check-firestore-rules.ts)
exercises ten allow/deny cases against the live emulator — owner access,
cross-user denial, the recursive rule's coverage of the future knowledge base,
and NWmap's read/write policy. It fakes auth with unsigned JWTs, which the
emulator accepts without verifying signatures, so no sign-in is needed.

It is deliberately **not** part of `npm run verify`, for the same reason
`check:routes` is not: it depends on something outside the build (a running
emulator rather than the network).

Note the emulator reads `firestore.rules` **once at startup** and does not
hot-reload it. After editing the rules, restart `npm run emulators` before
re-running the check, or you will be testing the old ruleset.

### State is thrown away

The emulators start empty and discard everything on exit. To keep data between
runs:

```bash
npx firebase emulators:start --project thedavidhanks-559b0 \
  --import=./.emulator-data --export-on-exit
```

`.emulator-data/` is local scratch — do not commit it.

## How the wiring works

- [`src/firebase.js`](../src/firebase.js) reads `VITE_FIREBASE_EMULATOR` and,
  when it is exactly `'true'`, calls `db.useEmulator()` and `auth.useEmulator()`
  immediately after initialization and before any read or write. Unset, the
  file behaves exactly as it did before.
- In emulator mode a missing `VITE_FIREBASE_API_KEY` is tolerated and replaced
  with a placeholder, since the emulators never validate it. Outside emulator
  mode the original startup throw is unchanged.
- `VITE_FIREBASE_EMULATOR` is listed in `OPTIONAL_VARS` in
  [`scripts/check-env.ts`](../scripts/check-env.ts). That script treats every
  `VITE_*` the source reads as **required**, so without the exemption an unset
  flag would fail `npm run verify` and the Amplify `preBuild` step. Add future
  optional flags there too, and keep the list short — the strict default is the
  point of the script.
- Ports live in the `emulators` block of [`firebase.json`](../firebase.json).
  Change them there and in `src/firebase.js` together.

## Caveats

- **The `/apply` and `/askme` Lambdas are not emulated.** They are real AWS
  calls with real keys and real cost, in emulator mode as much as outside it.
- **Emulator rules are not console rules.** A green run here proves the
  committed `firestore.rules` works; it says nothing about what the console
  currently enforces. Reconciling the two is still a manual step.
- The Vitest suite does not use the emulators at all — it mocks
  `src/firebase.js` wholesale in `src/test/setup.jsx`. Emulator mode is for
  manual testing in a browser.

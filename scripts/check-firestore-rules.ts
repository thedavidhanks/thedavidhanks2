#!/usr/bin/env node
/**
 * Asserts that firestore.rules actually permits what the app does, and denies
 * what it must not, by exercising a running Firestore emulator.
 *
 * Why this exists: firestore.rules was reconstructed from the source rather
 * than exported from the Firebase console, and `firebase deploy --only
 * firestore:rules` replaces the console ruleset wholesale. A mistake in the
 * file is therefore a production outage -- most obviously for NWmap, whose
 * pre-existing /Games/{gameId}/Points collection predates the rules file and
 * is easy to forget. These cases encode the intended policy so a regression
 * fails here instead of after a deploy.
 *
 * Auth is faked with unsigned JWTs: the emulator reads token claims without
 * verifying signatures, so no auth emulator round-trip is needed.
 *
 * Usage:
 *   npm run emulators          # in another terminal
 *   npm run check:rules
 *
 * Deliberately NOT part of `npm run verify` -- it needs a running emulator,
 * the same reason check:routes is excluded for needing the network.
 * See docs/local-firebase-emulator.md.
 */

const PROJECT = 'thedavidhanks-559b0'
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`

/** The game document id hardcoded in src/components/nwmap.jsx. */
const NWMAP_POINTS = '/Games/PM2ahWu01w0wb5KQcoV8/Points'

const b64 = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

/** An unsigned ID token the emulator will accept and read `sub` from. */
function tokenFor(uid: string): string {
  const now = Math.floor(Date.now() / 1000)
  return [
    b64({ alg: 'none', typ: 'JWT' }),
    b64({
      iss: `https://securetoken.google.com/${PROJECT}`,
      aud: PROJECT,
      sub: uid,
      user_id: uid,
      auth_time: now,
      iat: now,
      exp: now + 3600,
      firebase: { identities: {}, sign_in_provider: 'password' },
    }),
    '',
  ].join('.')
}

/** `uid` of null means a signed-out request. */
async function request(
  method: 'GET' | 'POST',
  path: string,
  uid: string | null,
  fields: object = { probe: { stringValue: 'check-rules' } },
): Promise<number> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (uid) headers.Authorization = `Bearer ${tokenFor(uid)}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: method === 'POST'
      ? JSON.stringify({ fields })
      : undefined,
  })
  return res.status
}

type Case = {
  name: string
  method: 'GET' | 'POST'
  path: string
  uid: string | null
  allow: boolean
  /** Firestore REST typed-value fields for a POST; defaults to a tiny probe. */
  fields?: object
}

const str = (stringValue: string) => ({ stringValue })
const list = (...values: string[]) => ({ arrayValue: { values: values.map(str) } })

/**
 * A saved application as history.js writes it once /application returns a fit
 * report: `recommendations` is a nested map with string and array members.
 * Mirrors the shape in docs/handoff/APPLICATION_API.md.
 */
const RECORD_WITH_RECOMMENDATIONS = {
  schemaVersion: { integerValue: '1' },
  company: str('Northwind'),
  coverLetter: str('# cover'),
  resume: str('# resume'),
  sessionId: str('s-1'),
  recommendations: {
    mapValue: {
      fields: {
        fit: { integerValue: '62' },
        gaps: str('- **a:** b'),
        strengths: { nullValue: null },
        position: str('Role\n\n---'),
        recommendedSkills: list('**x:** y'),
        recommendedCourses: list(),
      },
    },
  },
}

/** Same record when the job completed with `recommendations: null`. */
const RECORD_WITHOUT_RECOMMENDATIONS = {
  ...RECORD_WITH_RECOMMENDATIONS,
  recommendations: { nullValue: null },
}

const CASES: Case[] = [
  // Per-user application history: owner has full access, nobody else does.
  { name: 'owner writes own jobApplications', method: 'POST', path: '/users/alice/jobApplications', uid: 'alice', allow: true },
  { name: 'owner reads own jobApplications', method: 'GET', path: '/users/alice/jobApplications', uid: 'alice', allow: true },
  { name: 'other user cannot read them', method: 'GET', path: '/users/alice/jobApplications', uid: 'bob', allow: false },
  { name: 'signed-out cannot read them', method: 'GET', path: '/users/alice/jobApplications', uid: null, allow: false },
  { name: 'other user cannot write them', method: 'POST', path: '/users/alice/jobApplications', uid: 'bob', allow: false },

  // Saved history now carries `recommendations` (map, or null). The rules do not
  // validate fields, so these guard against someone adding validation later
  // that forgets the field -- and confirm isolation holds for the larger record.
  { name: 'owner writes record with recommendations', method: 'POST', path: '/users/alice/jobApplications', uid: 'alice', allow: true, fields: RECORD_WITH_RECOMMENDATIONS },
  { name: 'owner writes record with null recommendations', method: 'POST', path: '/users/alice/jobApplications', uid: 'alice', allow: true, fields: RECORD_WITHOUT_RECOMMENDATIONS },
  { name: 'other user cannot write such a record', method: 'POST', path: '/users/alice/jobApplications', uid: 'bob', allow: false, fields: RECORD_WITH_RECOMMENDATIONS },

  // The /users rule is recursive so the planned per-user knowledge base is
  // already covered. See docs/applyforjobs-history.md ("Multi-user readiness").
  { name: 'recursive rule covers knowledgeBase', method: 'POST', path: '/users/alice/knowledgeBase', uid: 'alice', allow: true },
  { name: 'other user cannot read knowledgeBase', method: 'GET', path: '/users/alice/knowledgeBase', uid: 'bob', allow: false },

  // NWmap, pre-existing. The route is not auth-gated and subscribes on mount,
  // so signed-out read must keep working; writes set addedBy from the signed-in
  // user, so they require auth.
  { name: 'NWmap points readable signed-out', method: 'GET', path: NWMAP_POINTS, uid: null, allow: true },
  { name: 'NWmap points writable signed-in', method: 'POST', path: NWMAP_POINTS, uid: 'alice', allow: true },
  { name: 'NWmap points not writable signed-out', method: 'POST', path: NWMAP_POINTS, uid: null, allow: false },

  // The game id is pinned, not wildcarded, matching the ruleset this replaced.
  // Guards against someone loosening it back to /Games/{gameId}/Points, which
  // would let any signed-in user create points under arbitrary game documents.
  { name: 'other game documents are not writable', method: 'POST', path: '/Games/some-other-game/Points', uid: 'alice', allow: false },
  { name: 'other game documents are not readable', method: 'GET', path: '/Games/some-other-game/Points', uid: null, allow: false },
]

const reachable = await fetch(`http://${HOST}/`).then(() => true).catch(() => false)
if (!reachable) {
  console.error(`check-rules: no Firestore emulator at ${HOST}.`)
  console.error('Start one with `npm run emulators` (see docs/local-firebase-emulator.md).')
  process.exit(1)
}

let failed = 0
for (const testCase of CASES) {
  const status = await request(testCase.method, testCase.path, testCase.uid, testCase.fields)
  const allowed = status >= 200 && status < 300
  const pass = allowed === testCase.allow
  if (!pass) failed++
  const want = testCase.allow ? 'ALLOW' : 'DENY'
  const got = allowed ? 'ALLOW' : 'DENY'
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${testCase.name.padEnd(42)} want=${want.padEnd(5)} got=${got.padEnd(5)} (HTTP ${status})`,
  )
}

if (failed > 0) {
  console.error(`\ncheck-rules: ${failed} of ${CASES.length} case(s) failed.`)
  process.exit(1)
}
console.log(`\ncheck-rules: all ${CASES.length} cases passed.`)

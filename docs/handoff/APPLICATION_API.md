# Application Package API — front-end contract

> **Source of truth:** the `lambda-answer-skills-with-bedrock` repo
> (`README.md` → *Asynchronous Application Package*). This file is a copy aimed
> at the UI. If the two disagree, that repo wins — regenerate this file rather
> than editing it in place.
>
> **Status:** `POST /application` is current. `POST /apply` is deprecated but
> still live and still called by the deployed front-end, so it keeps working
> until you cut over.

Two endpoints, both API-key protected, both CORS-enabled for any origin.

| Endpoint | Purpose |
|---|---|
| `POST /application` | Submit a job posting. Returns immediately with a `jobId`. |
| `GET /application/{jobId}` | Poll for status, and collect the package once it's done. |

**Why it's asynchronous:** generation takes ~46 seconds and the output length is
unbounded. API Gateway's integration timeout can't cover that, so submission and
retrieval are separate calls. There is no synchronous variant that returns the
fit report, and there won't be one.

## Configuration

```
VITE_AWS_APPLICATION_API_URL   # .../Prod/application
VITE_AWS_APPLICATION_API_KEY   # sent as the X-Api-Key header
```

Both values come from the deployer out of band — do not commit them. Every
request to both endpoints needs `X-Api-Key`; a missing or wrong key gets a
`403` from API Gateway before any handler runs, with an unhelpful body.

Rate limits on the prod usage plan are 10 req/sec (burst 20) and **2000
requests/day**. QA is 5/sec (burst 10) and 400/day. Polling spends that budget —
see [Polling](#polling).

## `POST /application` — submit

```http
POST /application
Content-Type: application/json
X-Api-Key: <key>

{
  "jobPosting": "https://example.com/job-posting",
  "applicantContext": "Focus on serverless work.",
  "sessionId": "optional-uuid"
}
```

| Field | Required | Notes |
|---|---|---|
| `jobPosting` | yes | Raw posting text **or** an `https://` URL. The server fetches URLs itself, so there's no CORS problem for you. |
| `applicantContext` | no | Free text steering emphasis. |
| `sessionId` | no | The caller's conversation ID. Generated server-side when omitted and returned unchanged on the result. |

An `includeRecommendations` key is **ignored, not rejected** — a leftover from
`/apply`. Don't send it; don't worry if an old build does.

### `202 Accepted`

```json
{ "jobId": "3f2a9c14-...", "status": "pending", "pollAfterSeconds": 10 }
```

→ [`fixtures/post-application-202.json`](fixtures/post-application-202.json)

This returns in well under a second. No model call has happened yet.

**`jobId` and `sessionId` are different things.** `jobId` identifies this one
generation and is what you poll. `sessionId` is the conversation and comes back
on the completed result. Don't poll with the `sessionId`.

### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{"error": "jobPosting is required"}` | Missing, empty, or whitespace-only `jobPosting`. No job is created. |
| `400` | `{"error": "Invalid request body"}` | Body isn't parseable JSON. |
| `403` | API Gateway default | Missing or invalid API key. |
| `500` | `{"error": "Failed to start application job"}` | Couldn't record or dispatch the job. Safe to retry. |

→ [`fixtures/post-application-400.json`](fixtures/post-application-400.json)

## `GET /application/{jobId}` — poll

```http
GET /application/3f2a9c14-...
X-Api-Key: <key>
```

**`200` for every job that exists**, whatever its state. The `status` field —
not the HTTP code — tells you where it is.

| `status` | Meaning | Extra fields |
|---|---|---|
| `pending` | Queued, not started | — |
| `running` | Model call in flight | — |
| `complete` | Done | `completedAt`, `sessionId`, `coverLetter`, `resume`, `recommendations` |
| `failed` | Gave up | `completedAt`, `error` |

`jobId`, `status`, and `createdAt` are present on all four.

```json
{ "jobId": "3f2a9c14-...", "status": "running", "createdAt": "2026-10-28T19:32:36.482913+00:00" }
```

→ [`fixtures/get-application-pending.json`](fixtures/get-application-pending.json),
[`fixtures/get-application-running.json`](fixtures/get-application-running.json)

`pending` and `running` carry no progress information. There is no percentage
and no ETA, so an indeterminate spinner with elapsed time is the honest UI.
`pending` can persist for a few seconds after submission and, if the worker
fails to check in, a job may stay `pending` for its whole run and still
complete — don't treat a long `pending` as stuck.

### Complete

```json
{
  "jobId": "3f2a9c14-...",
  "status": "complete",
  "createdAt": "2026-10-28T19:32:36.482913+00:00",
  "completedAt": "2026-10-28T19:33:22.117406+00:00",
  "sessionId": "8c41d7e2-...",
  "coverLetter": "# David Hanks, P.E.\n| ...",
  "resume": "# David Hanks, P.E.\n| ...",
  "recommendations": { }
}
```

→ [`fixtures/get-application-complete.json`](fixtures/get-application-complete.json)

`coverLetter` and `resume` are **complete rendered markdown documents** — byte
for byte what `/apply` returns today. They include a name/contact header built
as a markdown table, and the cover letter has a formatted date. Render them with
a markdown renderer that handles tables, or offer them as downloads. They are
not fragments to splice into your own layout.

### Failed and missing

```json
{ "jobId": "...", "status": "failed", "createdAt": "...", "completedAt": "...", "error": "Generation failed" }
```

`error` is always a generic string — `"Generation failed"` or `"Failed to start
generation"`. Real detail is in CloudWatch by design, so there is nothing
user-actionable to surface beyond "it didn't work, try again."

A `404 {"error": "Job not found"}` means the `jobId` is unknown **or** expired.
Jobs are kept 7 days, then deleted; an expired job is indistinguishable from one
that never existed, so both are `404` rather than `410`. If you persist a
`jobId` in `localStorage` to resume a poll across reloads, handle `404` as
"this result is gone" rather than as an error.

→ [`fixtures/get-application-failed.json`](fixtures/get-application-failed.json),
[`fixtures/get-application-404.json`](fixtures/get-application-404.json)

## Polling

The `202` tells you the interval: `pollAfterSeconds`, currently **10**. Read it
from the response rather than hardcoding it.

Wait `pollAfterSeconds` before the *first* poll too — the job will not be done
sooner. Typical run is ~46s, so expect roughly 5 polls.

**Why this matters:** polling once a second would spend ~46 requests of the
daily quota on a single package. At 2000/day that's about 43 packages before
prod starts returning `429`. At 10s it's ~5 requests each.

Suggested behaviour: fixed 10s interval, give up after ~5 minutes with a timeout
message, and stop polling entirely on `complete`, `failed`, or `404`. Clear the
interval on unmount — a React `useEffect` that leaks a timer here will keep
burning quota in a background tab.

## The `recommendations` object

This is the new part — the fit report, as structured JSON rather than markdown,
specifically so the UI can lay it out.

```json
"recommendations": {
  "fit": 62,
  "gaps": "- **Node.js/Fastify ...:** ...\n- **Kafka ...:** ...",
  "strengths": "- **5+ years full-stack ...:** ...",
  "recommendedSkills": ["**Node.js + Fastify REST API development:** ..."],
  "recommendedCourses": ["**Apache Kafka for Beginners** — Udemy ..."],
  "recommendedExperience": ["**Build a Node.js/Fastify microservice ...:** ..."],
  "position": "Senior Full Stack Engineer — Northwind Health",
  "scoreRationale": "David meets the core hard requirements solidly: ...",
  "resumeRecommendations": ["**Add TypeScript as a named, primary language:** ..."]
}
```

| Field | Type | Absent as | Notes |
|---|---|---|---|
| `fit` | int 0–100 | — | Always present when the object is. Clamped server-side. |
| `gaps` | string | — | Always present when the object is. |
| `strengths` | string | `null` | |
| `position` | string | `null` | Role + company, intended as the report heading. |
| `scoreRationale` | string | `null` | 2–3 sentences explaining the score. |
| `recommendedSkills` | string[] | `[]` | One element per bullet. |
| `recommendedCourses` | string[] | `[]` | Roughly `Credential — Provider`, but not guaranteed. |
| `recommendedExperience` | string[] | `[]` | One element per suggested project. |
| `resumeRecommendations` | string[] | `[]` | One element per presentation change. |

Keys are camelCase, matching the envelope. **There is no top-level `fitScore`** —
`recommendations.fit` is the only score.

### Three things that will break a naive UI

**1. `recommendations` can be `null` on a `complete` job.** If the model fails to
produce a usable score or gaps section, the whole object is `null` and the job
still completes with its cover letter and resume. A partial report is not a
failure. Guard every access; don't assume `status === 'complete'` implies a
report exists.
→ [`fixtures/get-application-complete-no-recommendations.json`](fixtures/get-application-complete-no-recommendations.json)

**2. Every string field is markdown, not plain text.** Despite the field names,
these are model-authored markdown. In real output `gaps` and `strengths` arrive
as **bullet lists**, and array elements routinely open with a `**bold label:**`.
Run every one of these strings through your markdown renderer. Rendering them as
plain text shows literal asterisks to the user; rendering them as HTML without
sanitising is an injection risk, since this text originates from a fetched job
posting.

**3. Strings may carry trailing markdown artifacts.** The model sometimes appends
a `---` horizontal rule or stray newlines to a section, and these are passed
through verbatim — stripping them server-side is lossy. The real capture in
`fixtures/get-application-complete.json` has `"position": "Senior Full Stack
Engineer — Northwind Health\n\n---"`. If you drop `position` straight into an
`<h2>`, you get a stray rule under your heading. Trim trailing whitespace and a
trailing `---` before using any of these as a short label.

Arrays degrade the other way: if the model answers a bullet section in prose
instead of a list, you get a **single-element array containing the whole
paragraph**, not an empty one. Don't assume array elements are short.

### Suggested rendering

`position` as the heading, `fit` as the headline number with `scoreRationale`
beneath it, then `strengths` and `gaps` as two prose/bullet blocks, then the four
arrays as lists. Elements in the arrays are a sentence to a short paragraph each,
not chips — don't design for one-word tags.

## Fixtures

Everything in [`fixtures/`](fixtures/) is a real captured response body (the
parsed JSON body, not the API Gateway envelope). Build and test the whole UI
against these before you have a key — they cover the success path and every
degenerate case worth handling.

| File | Use it for |
|---|---|
| `post-application-202.json` | Submit success |
| `post-application-400.json` | Validation error |
| `get-application-pending.json` / `-running.json` | In-progress states |
| `get-application-complete.json` | The full happy path, with a real markdown-heavy report |
| `get-application-complete-no-recommendations.json` | `recommendations: null` on a complete job |
| `get-application-failed.json` | Failure state |
| `get-application-404.json` | Unknown or expired job |

The complete fixtures are from a genuine ~46s run against a real posting.
Personal contact details and the employer name have been replaced with
placeholders; the markdown structure, the `---` artifacts, and the text lengths
are untouched, because those are exactly what the UI has to survive.

## Migrating from `/apply`

`POST /apply` still returns `{ sessionId, coverLetter, resume }` synchronously
and is unchanged. The cutover is:

1. Point at `POST /application`, read `jobId` from the `202`.
2. Add the polling loop against `GET /application/{jobId}`.
3. Take `coverLetter` and `resume` from the `complete` response — same shape,
   same rendering, no change needed there.
4. Add the `recommendations` UI.
5. Swap the API key: `/application` has its own QA and prod keys and usage
   plans.

Don't call both. The `/application` response is a superset.

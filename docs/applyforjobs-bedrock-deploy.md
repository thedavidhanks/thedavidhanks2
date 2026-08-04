# Apply for Jobs — AWS Bedrock backend deploy

This document is the deploy spec for the backend that powers the
`/tools/applyforjobs` route in the front-end. The front-end is already wired
to call this endpoint; the only thing standing between MVP and production is
the AWS-side build-out described below.

## Architecture

```
Browser (Amplify-hosted React SPA)
    │  POST /apply  (x-api-key)
    ▼
API Gateway (REST, regional, us-east-1)
    │
    ▼
Lambda (Node 22, ~30 s timeout)
    │  Bedrock InvokeModel  (or InvokeAgent)
    ▼
Bedrock — Claude Sonnet 4.6 (or Opus 4.7 for higher quality)
    │  optional: knowledge base in S3 + OpenSearch Serverless
    ▼
Response: { sessionId, coverLetter, resume }
```

The simplest MVP is `bedrock-runtime:InvokeModel` against a Claude model
with a system prompt that contains David's master resume verbatim. Upgrade
to a Bedrock Agent + Knowledge Base only when the resume corpus grows past
what fits comfortably in a system prompt or you want retrieval.

Mirror the deploy of the existing "Ask Me" Lambda
(`https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask`) — same
API Gateway pattern, same usage-plan-based API key.

## Endpoint

- **Method**: `POST`
- **Path**: `/apply`
- **Auth**: API Gateway API key in header `x-api-key`
- **CORS**: allow the Amplify-hosted origin (and `http://localhost:5173`
  for dev). Allowed headers must include `Content-Type, x-api-key`.

### Request

```json
{
  "jobPosting": "string (required) — pasted job description text or URL",
  "applicantContext": "string (optional) — extra hints, target tone, role focus",
  "sessionId": "string (optional) — reuse to maintain context across follow-ups"
}
```

### Response (200)

```json
{
  "sessionId": "string",
  "coverLetter": "string (markdown)",
  "resume": "string (markdown)"
}
```

### Error responses

- `400` — missing/empty `jobPosting`. Body: `{ "error": "jobPosting is required" }`
- `429` — usage plan throttle exceeded.
- `500` — Bedrock call failed. Body: `{ "error": "Generation failed" }`

## Lambda

- **Runtime**: Node 22.x
- **Memory**: 512 MB
- **Timeout**: 30 s (Bedrock generations of two long markdown docs can take
  10–20 s on Sonnet)
- **IAM**: `bedrock:InvokeModel` on the chosen Claude model ARN; CloudWatch
  Logs write
- **Env vars**:
  - `BEDROCK_MODEL_ID` (e.g. `anthropic.claude-sonnet-4-6-20251010-v1:0`)
  - `BEDROCK_REGION` (e.g. `us-east-1`)

The handler should:

1. Parse and validate the body.
2. If a URL was pasted instead of job text, fetch and strip to plain text
   server-side (don't trust the browser to do this — CORS will block).
3. Build the prompt (see below).
4. Call `bedrock-runtime:InvokeModel` with prompt caching enabled on the
   system prompt (the resume corpus is the cacheable bit).
5. Parse the assistant's structured response into `coverLetter` + `resume`.
6. Return `{ sessionId, coverLetter, resume }` with CORS headers.

### Prompt caching

The system prompt (persona + David's master resume) is the same on every
call — mark it as a cache breakpoint with `cache_control: { type: "ephemeral" }`.
Hit rate should be near 100% within the cache TTL, cutting per-call cost
significantly.

## Bedrock prompt design

**System prompt** (cached):

> You are an expert career coach helping David Hanks tailor his cover
> letter and resume to specific job postings. You have access to David's
> master resume and project history (below). When given a job posting,
> produce: (1) a concise cover letter (≤350 words) that connects David's
> background to the role's specific requirements, and (2) a tailored
> one-page resume in markdown that emphasizes the most relevant experience
> and de-emphasizes the rest. Use plain markdown. Never invent
> experience David doesn't have.
>
> ## David's master resume
> [paste full resume here — keep this static so it caches]

**User message**:

> Job posting:
> ```
> {jobPosting}
> ```
>
> Additional applicant context (optional):
> ```
> {applicantContext or "(none)"}
> ```
>
> Respond with two markdown sections, exactly:
>
> `# COVER_LETTER`
> ...
>
> `# RESUME`
> ...

The Lambda parses on those literal headers and ships the two pieces back
to the front-end.

## API key

Issue an API key in API Gateway, attach it to a usage plan associated with
the `/apply` resource. The key is set in the front-end `.env` as
`VITE_AWS_APPLY_API_KEY` and sent in the `x-api-key` request header.

## Throttling

Recommended on the usage plan:

- Rate: 5 req/sec
- Burst: 10
- Daily quota: 100 (tune up as usage grows)

## Front-end wiring (already in place)

After deploy, set the front-end's API URL constant in
[src/components/tools/applyforjobs/index.jsx](../src/components/tools/applyforjobs/index.jsx)
(`API_URL` near the top — TODO comment there) and add
`VITE_AWS_APPLY_API_KEY` to `.env`.

## Out of scope (future)

- Verifying the Firebase ID token in Lambda for true per-user auth (today
  the front-end gates the route by Firebase login; the API key is a shared
  secret).
- PDF/DOCX downloads (front-end currently downloads `.md`).
- Persisting prior generations per user in DynamoDB.

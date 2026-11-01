# Amplify rewrites and redirects

`amplify.yml` cannot express redirects. Amplify Hosting's rewrite rules live in
app configuration (console → **Hosting → Rewrites and redirects**, or the
`customRules` field on the app), which means they are invisible to code review,
absent from this repo's history, and easy to clobber by accident. This file is
the source of truth for what those rules are supposed to be and why.

If you change the rules in the console, update this file in the same sitting.

## The rule set

Two rules, in this order:

| # | Source | Target | Type |
| --- | --- | --- | --- |
| 1 | `https://thedavidhanks.com` | `https://www.thedavidhanks.com` | `302` (Redirect — Temporary) |
| 2 | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|jpeg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | `200` (Rewrite) |

As JSON, which is what `aws amplify update-app --custom-rules` takes and what
the console's **Open text editor** expects:

```json
[
  {
    "source": "https://thedavidhanks.com",
    "status": "302",
    "target": "https://www.thedavidhanks.com"
  },
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "status": "200",
    "target": "/index.html"
  }
]
```

**Rule 1 is the apex-to-www redirect and it must stay first.** It is easy to
miss that this lives in `customRules` rather than in Domain management, and
because every write replaces the entire list, a change that "just" sets the SPA
rule will silently delete it and break the bare domain. Order matters for the
same reason first-match-wins always does: rule 2's regex matches the path `/`,
so promoting it above rule 1 would shadow the apex redirect entirely.

The regex matches any path with **no** extension, plus any path whose extension
is not in the asset allow-list. Everything in the allow-list falls through to
the origin, so `/assets/index-abc123.js` keeps its real `200` and a genuinely
missing `/assets/nope.js` keeps its real `404`. That second half matters: if a
missing `.js` were rewritten to `/index.html`, the browser would report a
MIME-type error ("Expected a JavaScript module script but the server responded
with text/html") instead of a clean 404, which is much harder to diagnose.

Rules are evaluated **top-down, first match wins**
([docs](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html)),
so if you ever add a second rule, mind the order — a leading wildcard shadows
everything after it.

### Status codes

Amplify's `status` enum is `200`, `301`, `302`, `404`, and `404-200`. The AWS
CLI reference describes `404` as "a 404 redirect rule" and `404-200` as "a 404
rewrite rule"; the console labels them "404 (Redirect)" and "404 (Rewrite)".

**`404-200` does not produce an HTTP 200, whatever the name suggests.** This is
worth stating plainly because it is a trap. The broken configuration this
document was written to fix *was* `/<*>` → `/index.html` with status `404-200`,
and it served deep links with a hard HTTP 404 — the "rewrite" half is real
(index.html's bytes are served in place, with no redirect hop) but the status
code stays 404. Several sources, including AWS's own enum naming, imply
otherwise. They are wrong, at least for a catch-all source on this app.

So: "change `404` to `404-200`" is a plausible-looking non-fix. Use plain
**`200`**, which is what AWS's own SPA example uses. A `200` rewrite matches on
the incoming request path, whereas the 404 variants only engage once the origin
has already missed — which is also why the `200` rule needs a source pattern
that excludes real asset extensions, rather than a bare `/<*>`.

## Status: applied 2026-10-04

Applied in the console to app `thedavidhanks2`, which means production and dev
at once. Verified with `npm run check:routes` against both
`dev.thedavidhanks.com` and `www.thedavidhanks.com`: **all 15 routes return
200 with no redirect hop**, the real bundle stays `200 text/javascript`,
`/assets/does-not-exist.js` stays `404`, and the apex still 302s to www.

### What was wrong

The SPA fallback was a bare `/<*>` catch-all with status `404-200`
("404 (Rewrite)"), which served index.html's bytes but kept the HTTP 404. Every
URL except `/` returned the shell with a `404` status, so React booted and
rendered the right page while every crawler, uptime check, and `curl` saw a hard
failure. The site looked perfect in a browser, which is exactly why this
survived so long, and why `npm run check:routes` asserts on the status line
rather than on rendered output.

**Rollback target.** The exact rule list in place before the fix:

```json
[
  {
    "source": "https://thedavidhanks.com",
    "status": "302",
    "target": "https://www.thedavidhanks.com"
  },
  {
    "source": "/<*>",
    "status": "404-200",
    "target": "/index.html"
  }
]
```

Before and after, 2026-10-04, identical on dev and www:

```
                               before                                 after
/                              200                                    200
/about                         301 -> /about/ then 404 (index.html)   200, no hop
/tools/nwmap  (and 12 more)    301 -> .../    then 404                200, no hop
/assets/index-<hash>.js        200 text/javascript                    200 text/javascript
/assets/does-not-exist.js      404 text/html  (index.html body)       404, empty body
```

The last line got better as well as staying correct: a missing asset used to come
back as a 404 with the HTML shell as its body, and now it is a plain 404.

## Applying a change

Custom rules are **app-level, not branch-level**. `aws amplify update-branch`
has no redirect parameter at all; `customRules` hangs off the `App` resource.

**This deployment is a single app, `thedavidhanks2`, with `master` and `dev` as
two branches of it** (confirmed in the console, 2026-10-04). So there is one
shared `customRules` list and **any change lands on production and dev at the
same moment** — rewrites cannot be staged on dev first. Plan accordingly:
capture the current rules before saving, because that is the only rollback, and
www is live while you verify.

Look up the app id with:

```sh
aws amplify list-apps --region us-west-2 \
  --query 'apps[].{name:name,id:appId,domain:defaultDomain}' --output table
```

It is deliberately not recorded in this file — this repo is public, and the
command above recovers it in a second.

Read the current rules before overwriting them, because `update-app
--custom-rules` replaces the entire list rather than merging into it:

```sh
aws amplify get-app --region us-west-2 --app-id <APP_ID> \
  --query 'app.customRules' --output json > /tmp/custom-rules.before.json
```

Then apply **the complete list from "The rule set" above — both rules**, not
just the SPA one:

```sh
aws amplify update-app --region us-west-2 --app-id <APP_ID> --custom-rules '[
  {
    "source": "https://thedavidhanks.com",
    "status": "302",
    "target": "https://www.thedavidhanks.com"
  },
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "status": "200",
    "target": "/index.html"
  }
]'
```

`npm run check:routes` asserts the apex redirect survived; to check it by hand:

```sh
curl -sI https://thedavidhanks.com/ | grep -i '^location'   # -> https://www.thedavidhanks.com/
```

Rule changes take effect without a redeploy, but see the caching note below.

## Verifying

```sh
npm run check:routes                                        # dev
npm run check:routes -- --base=https://www.thedavidhanks.com  # master
```

`scripts/check-routes.ts` derives its path list from `src/App.jsx` and the
`endpoint` fields in `toollist.jsx` / `projectlist.jsx`, so a newly added tool
or project is covered automatically. It asserts a final `200` on every route,
reports any redirect hops it had to follow, and separately checks that a real
hashed bundle returns `200 text/javascript`, that `/assets/does-not-exist.js`
returns `404`, and that the apex still redirects to www.

It is **not** part of `npm run verify`. It talks to the live internet and to
production, so wiring it into CI would make unrelated PRs fail on a network
blip or during a deploy. Run it by hand after a rules change.

**Caching gotcha.** `index.html` is served with
`cache-control: public, max-age=0, s-maxage=31536000`, so CloudFront holds it at
the edge for a year. After a config change, stale edge objects can make a
successful fix look like a failure. `check-routes.ts` appends a random query
string to every request for this reason; if you are testing by hand, do the
same (`?cb=$RANDOM`) or trigger an invalidation. Do not conclude the fix failed
on the strength of an edge cache hit.

## The trailing-slash 301 (gone)

Amplify appends a trailing slash to extensionless paths by design. It is the
"clean URL" feature that lets static site generators serve `/about/index.html`
at `/about`
([docs](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html)),
and AWS has said on the issue tracker that it is intended. Under the old
`/<*>` → `404-200` rule it fired on every extensionless path: `/about` →
`301 /about/`, `/about.html` → `301 /about/`, and even `/nonexistent-xyz` →
`301 /nonexistent-xyz/`, although `dist/` has no subdirectories at all. The 301
came from the origin, not from a CloudFront function (`x-cache: Miss from
cloudfront`).

AWS does not document whether custom rules are evaluated before or after that
normalization, and there are reports of the redirect winning even when a
matching rule exists. So this was measured rather than assumed. On this app,
**the `200` rewrite pre-empts it**. After the change, measured 2026-10-04:

| Request | Before | After |
| --- | --- | --- |
| `/about` | `301 → /about/`, then 404 | `200`, no hop |
| `/about/` | `404` | `200` |
| `/about.html` | `301 → /about/` | `200` (soft) |
| `/nonexistent-xyz` | `301 → /nonexistent-xyz/` | `200` (soft) |

The 404 variants only engage after the origin has already missed, and by then
the clean-URL redirect has already fired. A `200` rewrite matches the incoming
path first, which is why switching the status code removed the hop as well.

**Canonical form: no trailing slash.** Every internal link in `src/` is already
written that way (`<Link to="/projects">`, `` <Link to={`/${endpoint}`}> `` in
`BSnavbar.jsx`, `ProjectCard.jsx`, and `ToolCard.jsx`), so no code change is
needed. `/about/` also returns 200 and React Router matches it to the same
route, so old trailing-slash links and bookmarks keep working.

If `check-routes.ts` ever shows a `(via ...)` hop again, it means a rules change
brought the 301 back. Restore the rule set above rather than changing the links.

## Known tradeoff: soft 404s

Now that the fallback returns `200`, a genuinely nonexistent URL like
`/nonexistent-xyz` returns `200` plus whatever the client renders. The same goes
for any path with an extension outside the asset allow-list (`/foo.bar`,
`/about.html`), since the regex deliberately sends those to the SPA too. This is
normal and unavoidable for an SPA, but it is a real loss: the HTTP status can
no longer distinguish a real page from a typo, so monitoring and crawlers can
no longer tell them apart.

Today that renders the navbar above an empty content area — there is no
catch-all route and no error boundary anywhere in `src/`. **[#41](https://github.com/thedavidhanks/thedavidhanks2/issues/41)**
adds both. Until it lands, this fix is not a regression-free win: it trades a
wrong status on every real page for a wrong status on every fake one. The
former is far more damaging, so the trade is worth making now, but #41 is what
actually closes it out.

Also watch for the inverse failure mode: there are reports of the trailing-slash
redirect firing on a static asset first, which then matches the SPA rule and
serves `index.html` in place of the asset. That does not happen here today: the
bundle, `favicon.ico`, and `manifest.json` all come back with their real
content types. The bundle check in `check-routes.ts` asserts a `javascript`
content-type so it gets caught if it ever starts happening.

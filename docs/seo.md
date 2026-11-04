# SEO and link-preview metadata

The site is a client-rendered SPA: every URL is served the same `index.html`
(see `docs/amplify-redirects.md`), and the page content only exists once
JavaScript runs. Metadata therefore lives in two layers.

## Where metadata lives

| Layer | File | Who sees it |
| --- | --- | --- |
| Static head | `index.html` | Everything, including link-preview bots (LinkedIn, Slack, iMessage) and crawlers that never run JS |
| Per-route head | `src/components/PageMeta.jsx`, rendered by each page | Browsers and JS-rendering crawlers (Googlebot) |

**Static head (`index.html`).** The home title and description, a canonical
link to `https://www.thedavidhanks.com/`, `theme-color`, the manifest link,
Open Graph and Twitter card tags, and a schema.org `Person` JSON-LD block.
Because every URL is served this same file, a bot that does not run JS sees the
home page's card and canonical for every route. That is the accepted cost of
not prerendering.

The share image is `public/og-image.png` (1200×630), referenced by absolute URL.
It is a static asset: regenerate it by hand if the name or role changes.

**Per-route head (`PageMeta`).** Each top-level page (`/`, `/about`, `/askme`)
and the two index routes (`/projects`, `/tools`) render
`<PageMeta title description path>`. The project and tool routers wrap every
entry's element in a `PageMeta` built from that entry's `title`, `description`
and `endpoint` in `projectlist.jsx` / `toollist.jsx`, so a new project or tool
gets its own title with no extra work. Titles read `<Page> · David Hanks`
(`pageTitle()` in `src/seo.js`); the home page uses the full `HOME_TITLE`.

React 19 hoists `<title>`, `<meta>` and `<link>` into `<head>` wherever they
render, and removes them on unmount, so no Helmet-style library is involved.
It does **not** dedupe against tags already in the document, so `src/main.jsx`
removes every `[data-static-head]` tag (title, description, canonical) before
the first render. Anything added to the static head that a page also renders
must carry `data-static-head`, or the head ends up with two.

`src/seo.js` holds the site URL, home title and description. `index.html`
repeats the title and description as literal text; `src/seo.test.js` fails if
they drift apart.

## robots.txt and sitemap.xml

Both are written into `public/` by `scripts/build-seo.ts`, which the `build`
npm script runs before `vite build`; Vite then copies them into `dist/`. They
are gitignored because they are generated.

- **sitemap.xml** lists every URL from `scripts/routes.ts`, the same derivation
  `npm run check:routes` probes (top-level `<Route path>`s in `src/App.jsx` plus
  each `endpoint` in the two route tables). A newly routed page is in the next
  build's sitemap automatically. URLs are always the canonical www ones.
- **robots.txt** is `Allow: /` plus a `Sitemap:` line on production, and
  `Disallow: /` everywhere else.

Amplify's SPA rewrite (rule 2 in `docs/amplify-redirects.md`) only lets
allow-listed file extensions reach the origin. `txt` is on the list, so
`robots.txt` is served as written. **`xml` must be on the list too**, or
`/sitemap.xml` is rewritten to `index.html` and answers `200 text/html`.
`npm run check:routes` checks both files' status and content type.

## Keeping dev out of search

Only the production branch may be indexed. The decision is
`isIndexable()` in `scripts/site-env.ts`: true only when `AWS_BRANCH` is
`master`. On every other build (the `dev` branch at `dev.thedavidhanks.com`,
PR previews, CI, a local `npm run build`):

- `vite.config.js` injects `<meta name="robots" content="noindex">` into
  `index.html`, and
- `build-seo.ts` writes the `Disallow: /` robots.txt.

`AWS_BRANCH` was chosen over a `VITE_SITE_ENV`-style variable because Amplify
sets it in every build with no console configuration. A per-branch variable
would have to be set by hand on each branch, and forgetting it fails silently.
If `AWS_BRANCH` is missing, the build falls back to noindex, so a mistake hides
a site rather than exposing a duplicate. The flip side: if the production
branch is ever renamed, update `PRODUCTION_BRANCH` in the same change, or
www will go noindex.

The two signals interact. `Disallow: /` stops crawling, but a disallowed URL
can still be indexed (as a bare link) if other sites link to it, and Google
only reads the `noindex` meta on pages it is allowed to crawl. Together they
keep a dev host that has never been indexed out of the index. If dev pages ever
do show up in search, temporarily serve dev's robots.txt with `Allow: /` so
Google can recrawl them and see `noindex`, or remove them with Search Console's
Removals tool.

## Validating

Locally:

```sh
npm run build                                   # non-production variant
grep -o '<title[^<]*' dist/index.html           # the home title
grep -c 'name="robots"' dist/index.html         # 1 (noindex)
cat dist/robots.txt                             # Disallow: /

AWS_BRANCH=master npm run build                 # production variant
grep -c 'name="robots"' dist/index.html         # 0
cat dist/robots.txt                             # Allow: / + Sitemap:

# The sitemap matches the route checker's list exactly:
diff <(npm run -s check:routes -- --list | sed 's#^#https://www.thedavidhanks.com#') \
     <(grep -o '<loc>[^<]*' dist/sitemap.xml | sed 's/<loc>//' | sort)
```

In `npm run dev`, each route's tab title differs, and in the console
`document.querySelectorAll('head title').length` is `1`. `npm run test:ui`
asserts the same for every route (one title, description and canonical each,
all titles distinct).

Paste the JSON-LD block from `index.html` into
<https://validator.schema.org> after changing it.

After a deploy:

```sh
curl -s https://dev.thedavidhanks.com/robots.txt   # Disallow: /
curl -s https://www.thedavidhanks.com/robots.txt   # Allow: / + Sitemap:
npm run check:routes -- --base=https://www.thedavidhanks.com
```

Then run `https://www.thedavidhanks.com` through <https://www.opengraph.xyz>
or LinkedIn's Post Inspector and confirm the card shows the image, title and
description. LinkedIn caches cards for about a week; Post Inspector forces a
refresh.

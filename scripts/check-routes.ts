#!/usr/bin/env node
/**
 * Asserts that every deployed URL returns HTTP 200 -- not just that the page
 * "looks right" in a browser.
 *
 * This exists because of the SPA-fallback bug: Amplify was configured with a
 * 404 (Redirect) rule instead of a 200 (Rewrite), so every route except `/`
 * returned the index.html shell with a 404 status. React still booted and
 * rendered the correct page, so the site looked perfect while every crawler,
 * uptime check and `curl` saw a hard 404. A visual check cannot catch that
 * class of bug; only the status line can. See docs/amplify-redirects.md.
 *
 * The path list is derived from the same route tables App.jsx renders, so a
 * newly added tool or project is covered the moment it is added and nobody has
 * to remember to update a hardcoded list here.
 *
 * Usage:
 *   node scripts/check-routes.ts                           # checks dev
 *   node scripts/check-routes.ts --base=https://www.thedavidhanks.com
 *   node scripts/check-routes.ts --list                    # print paths, no network
 *   node scripts/check-routes.ts --no-cache-bust
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

const DEFAULT_BASE = 'https://dev.thedavidhanks.com'

const APP = 'src/App.jsx'
const TOOLLIST = 'src/components/tools/toollist.jsx'
const PROJECTLIST = 'src/components/projects/projectlist.jsx'

/**
 * `<Route path="/about" .../>`. The two splat routes (`/tools/*`,
 * `/projects/*`) are mount points for the nested routers; the splat is
 * stripped so we check the index page the nested router serves at its root.
 */
const ROUTE_PATH = /<Route\s+path=["']([^"']+)["']/g

/**
 * `endpoint: 'tools/satisfactory-sink'` -- the full path minus the leading
 * slash. Deliberately NOT `path:`, which holds the bare slug the nested
 * router matches after the parent segment is consumed. Confusing the two is
 * what produced the doubled /projects/projects/<slug> URLs in #36.
 */
const ENDPOINT = /\bendpoint:\s*["']([^"']+)["']/g

/** Hashed bundle emitted by Vite, discovered from the live index.html. */
const BUNDLE = /\/assets\/[A-Za-z0-9._-]+\.js/

/* ------------------------------------------------------------------ *
 * Deriving the path list
 * ------------------------------------------------------------------ */

function read(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

function matchAll(source: string, pattern: RegExp, label: string): string[] {
  const found = [...source.matchAll(pattern)].map((m) => m[1])
  // These files are parsed as text because they cannot be imported: the data
  // holds JSX elements, and the transitive imports pull in .png/.css and
  // src/firebase.js (which throws at module load without VITE_FIREBASE_API_KEY).
  // A silent zero-match would make this script vacuously pass, so refuse.
  if (found.length === 0) {
    throw new Error(
      `No ${label} found in the source. The file was probably reformatted or ` +
        `restructured -- update the pattern in scripts/check-routes.ts.`,
    )
  }
  return found
}

function deployedPaths(): string[] {
  const topLevel = matchAll(read(APP), ROUTE_PATH, 'top-level <Route path>')
    // '/tools/*' -> '/tools'; '/' stays '/'
    .map((p) => (p.endsWith('/*') ? p.slice(0, -2) : p))

  const nested = [
    ...matchAll(read(TOOLLIST), ENDPOINT, 'tool endpoints'),
    ...matchAll(read(PROJECTLIST), ENDPOINT, 'project endpoints'),
  ].map((e) => `/${e}`)

  return [...new Set([...topLevel, ...nested])].sort()
}

/* ------------------------------------------------------------------ *
 * Probing
 * ------------------------------------------------------------------ */

interface Probe {
  status: number
  /** Every Location header followed, in order. Empty when there was no hop. */
  hops: string[]
  contentType: string
}

/**
 * Follows redirects by hand so the intermediate hops stay visible. `curl -L`
 * would hide a 301 behind a final 200, and the trailing-slash redirect is
 * exactly the thing we want reported rather than silently absorbed.
 */
async function probe(url: string, bust: boolean): Promise<Probe> {
  // index.html is served with s-maxage=31536000, so CloudFront holds it at the
  // edge for a year. Without a cache buster a config change can look like it
  // failed when you are really just reading a stale edge object.
  const target = bust ? `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}${Math.random().toString(36).slice(2)}` : url

  const hops: string[] = []
  let current = target

  for (let i = 0; i <= 5; i++) {
    const response = await fetch(current, { redirect: 'manual' })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      hops.push(location)
      current = new URL(location, current).toString()
      continue
    }
    return {
      status: response.status,
      hops,
      contentType: response.headers.get('content-type') ?? '',
    }
  }
  throw new Error(`Redirect loop following ${target}`)
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function flag(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (hit === undefined) return undefined
  const eq = hit.indexOf('=')
  return eq === -1 ? '' : hit.slice(eq + 1)
}

async function main(): Promise<void> {
  const paths = deployedPaths()

  if (flag('list') !== undefined) {
    for (const p of paths) console.log(p)
    return
  }

  const base = (flag('base') || DEFAULT_BASE).replace(/\/$/, '')
  const bust = flag('no-cache-bust') === undefined

  console.log(`Checking ${paths.length} routes against ${base}\n`)

  let failures = 0
  let redirected = 0

  for (const path of paths) {
    const { status, hops } = await probe(`${base}${path}`, bust)
    const ok = status === 200
    if (!ok) failures++
    if (hops.length > 0) redirected++
    const note = hops.length > 0 ? `  (via ${hops.join(' -> ')})` : ''
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${path.padEnd(32)} ${status}${note}`)
  }

  /* Assets must stay outside the rewrite: a real bundle keeps its real 200 and
   * a missing one keeps its real 404. If a missing .js were rewritten to
   * index.html the browser would report a MIME-type error instead of a clean
   * 404, which is far harder to diagnose. */
  console.log('')

  const shell = await (await fetch(`${base}/?cb=${Date.now()}`)).text()
  const bundle = shell.match(BUNDLE)?.[0]
  if (!bundle) {
    console.log('FAIL  could not find a hashed bundle in the served index.html')
    failures++
  } else {
    const real = await probe(`${base}${bundle}`, false)
    const okReal = real.status === 200 && real.contentType.includes('javascript')
    if (!okReal) failures++
    console.log(`${okReal ? 'ok  ' : 'FAIL'}  ${bundle.padEnd(32)} ${real.status} ${real.contentType}`)
  }

  const missing = await probe(`${base}/assets/does-not-exist.js`, false)
  const okMissing = missing.status === 404
  if (!okMissing) failures++
  console.log(
    `${okMissing ? 'ok  ' : 'FAIL'}  ${'/assets/does-not-exist.js'.padEnd(32)} ${missing.status} ${missing.contentType}`,
  )

  /* The apex -> www redirect is a custom rule living in the same app-level
   * list as the SPA rewrite, and every write replaces that list wholesale. It
   * is therefore the single thing most likely to be deleted by accident while
   * editing the rewrite rule, and nothing else here would notice. */
  const apex = await probe('https://thedavidhanks.com/', true)
  const okApex = apex.hops.some((h) => h.startsWith('https://www.thedavidhanks.com'))
  if (!okApex) failures++
  console.log(
    `${okApex ? 'ok  ' : 'FAIL'}  ${'apex -> www'.padEnd(32)} ${apex.hops[0] ?? '(no redirect)'}`,
  )

  console.log('')
  if (redirected > 0) {
    console.log(
      `note: ${redirected} route(s) answered only after a redirect. Every internal\n` +
        `      link in src/ is written without a trailing slash, so each of those is\n` +
        `      a wasted round trip. See docs/amplify-redirects.md.`,
    )
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`)
    process.exit(1)
  }
  console.log('All checks passed.')
}

await main()

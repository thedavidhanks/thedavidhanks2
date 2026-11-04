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
 * The path list is derived from the same route tables App.jsx renders (see
 * scripts/routes.ts, which also feeds the sitemap), so a newly added tool or
 * project is covered the moment it is added and nobody has to remember to
 * update a hardcoded list here.
 *
 * Usage:
 *   node scripts/check-routes.ts                           # checks dev
 *   node scripts/check-routes.ts --base=https://www.thedavidhanks.com
 *   node scripts/check-routes.ts --list                    # print paths, no network
 *   node scripts/check-routes.ts --no-cache-bust
 */

import { deployedPaths } from './routes.ts'

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

const DEFAULT_BASE = 'https://dev.thedavidhanks.com'

/** Hashed bundle emitted by Vite, discovered from the live index.html. */
const BUNDLE = /\/assets\/[A-Za-z0-9._-]+\.js/

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

  /* robots.txt and sitemap.xml (scripts/build-seo.ts) must reach the origin
   * too. Rule 2's regex only lets allow-listed extensions through, so an
   * extension missing from that list is rewritten to index.html: a 200 with an
   * HTML body, which a status check alone would wave through. See
   * docs/seo.md. */
  for (const [file, type] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'xml']]) {
    const seo = await probe(`${base}${file}`, bust)
    const okSeo = seo.status === 200 && seo.contentType.includes(type)
    if (!okSeo) failures++
    console.log(`${okSeo ? 'ok  ' : 'FAIL'}  ${file.padEnd(32)} ${seo.status} ${seo.contentType}`)
  }

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

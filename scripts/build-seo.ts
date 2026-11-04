#!/usr/bin/env node
/**
 * Writes public/sitemap.xml and public/robots.txt. Runs before `vite build`
 * (see the `build` npm script), which copies public/ into dist/ verbatim.
 *
 * Both files are generated, and gitignored, rather than committed:
 *   - the sitemap comes from scripts/routes.ts, the same derivation
 *     check-routes.ts probes, so a new page is listed the moment it is routed;
 *   - robots.txt differs per environment (see site-env.ts), so there is no
 *     single correct copy to commit.
 *
 * Usage:
 *   node scripts/build-seo.ts
 *   AWS_BRANCH=master node scripts/build-seo.ts   # production variant
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { deployedPaths } from './routes.ts'
import { isIndexable } from './site-env.ts'
import { SITE_URL } from '../src/seo.js'

const PUBLIC_DIR = resolve(process.cwd(), 'public')

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sitemap(paths: string[]): string {
  const urls = paths.map((p) => `  <url><loc>${escapeXml(`${SITE_URL}${p}`)}</loc></url>`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

function robots(indexable: boolean): string {
  return indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n'
}

const paths = deployedPaths()
const indexable = isIndexable()

// The sitemap is written on every branch: its URLs are always the canonical
// www ones, and on non-production builds robots.txt does not advertise it.
writeFileSync(resolve(PUBLIC_DIR, 'sitemap.xml'), sitemap(paths))
writeFileSync(resolve(PUBLIC_DIR, 'robots.txt'), robots(indexable))

console.log(
  `build-seo: sitemap.xml lists ${paths.length} URLs; robots.txt ` +
    (indexable
      ? 'allows indexing (production build)'
      : `disallows everything (AWS_BRANCH=${process.env.AWS_BRANCH ?? 'unset'}, not production)`),
)

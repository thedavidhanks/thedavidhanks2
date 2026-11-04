/**
 * The list of URLs the site serves, derived from the same route tables
 * App.jsx renders: the top-level <Route path>s in src/App.jsx plus every
 * `endpoint` in the tool and project tables. Shared by check-routes.ts (which
 * probes each one against a live deploy) and build-seo.ts (which writes them
 * into sitemap.xml), so the two can never disagree about what exists.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = 'src/App.jsx'
const TOOLLIST = 'src/components/tools/toollist.jsx'
const PROJECTLIST = 'src/components/projects/projectlist.jsx'

/**
 * `<Route path="/about" .../>`. The two splat routes (`/tools/*`,
 * `/projects/*`) are mount points for the nested routers; the splat is
 * stripped so the index page the nested router serves at its root is listed.
 */
const ROUTE_PATH = /<Route\s+path=["']([^"']+)["']/g

/**
 * `endpoint: 'tools/satisfactory-sink'` -- the full path minus the leading
 * slash. Deliberately NOT `path:`, which holds the bare slug the nested
 * router matches after the parent segment is consumed. Confusing the two is
 * what produced the doubled /projects/projects/<slug> URLs in #36.
 */
const ENDPOINT = /\bendpoint:\s*["']([^"']+)["']/g

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
        `restructured -- update the pattern in scripts/routes.ts.`,
    )
  }
  return found
}

export function deployedPaths(): string[] {
  const topLevel = matchAll(read(APP), ROUTE_PATH, 'top-level <Route path>')
    // '/tools/*' -> '/tools'; '/' stays '/'
    .map((p) => (p.endsWith('/*') ? p.slice(0, -2) : p))

  const nested = [
    ...matchAll(read(TOOLLIST), ENDPOINT, 'tool endpoints'),
    ...matchAll(read(PROJECTLIST), ENDPOINT, 'project endpoints'),
  ].map((e) => `/${e}`)

  return [...new Set([...topLevel, ...nested])].sort()
}

/**
 * Decides whether this build may be indexed by search engines.
 *
 * Only the production branch serves the canonical www host. Everything else
 * -- the dev branch at dev.thedavidhanks.com, PR previews, CI, a local
 * `npm run build` -- gets `<meta name="robots" content="noindex">` (injected by
 * vite.config.js) and a `Disallow: /` robots.txt (written by build-seo.ts).
 *
 * The signal is AWS_BRANCH, which Amplify sets in every build with no console
 * configuration. A VITE_* variable was rejected because it would have to be
 * set per branch by hand, and forgetting it on dev is silent. Defaulting to
 * noindex when AWS_BRANCH is absent means a misconfiguration hides a preview
 * rather than exposing one. To build the production variant locally:
 *
 *   AWS_BRANCH=master npm run build
 *
 * See docs/seo.md.
 */

export const PRODUCTION_BRANCH = 'master'

export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.AWS_BRANCH === PRODUCTION_BRANCH
}

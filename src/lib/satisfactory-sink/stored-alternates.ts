/**
 * Parse the raw localStorage value for the unlocked-alternates set.
 *
 * localStorage throws in Safari private mode and when the quota is full, and
 * the stored value can be anything a previous version (or the user's
 * devtools) left behind. Every failure mode degrades to "nothing unlocked"
 * (an empty set) rather than taking the page down.
 */
export function readStoredIds(raw: string | null): Set<string> {
  try {
    if (!raw) return new Set()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((id) => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

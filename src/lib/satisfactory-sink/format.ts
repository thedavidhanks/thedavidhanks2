/**
 * Shared by the plan tables and the flow diagram, so the same quantity never
 * reads two ways in two places on one screen.
 *
 * Mirrors the `round` helper inside formatPlan() in maximize.ts: fix to 4
 * decimals, then let Number() drop the trailing zeros so whole numbers read
 * as `48` and not `48.0000`. Everything the solver returns is a rate and may
 * be fractional — `2.0645 x Smart Plating` is a machine at a partial clock
 * rate, not "2" — so nothing here is ever rounded to an integer. See docs
 * §11.5.
 */
export function fmt(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return Number(value.toFixed(4)).toString()
}

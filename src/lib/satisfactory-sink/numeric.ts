/**
 * Floating-point housekeeping shared by the solver and the flow graph.
 *
 * Simplex leaves `1e-16`-scale dust on variables that are really zero, and the
 * proportional split in flow.ts multiplies and divides that dust further. Both
 * need the same notion of "close enough to zero to not exist", or the plan and
 * the graph drawn from it disagree about which recipes are in it.
 */

/** Anything smaller than this is treated as exactly zero. */
export const ZERO = 1e-7

/** Snap simplex dust to zero and trim the rest to 9 decimal places. */
export function clean(value: number): number {
  if (Math.abs(value) < ZERO) return 0
  return Math.round(value * 1e9) / 1e9
}

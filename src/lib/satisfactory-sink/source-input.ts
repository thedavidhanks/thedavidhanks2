/**
 * Pure validation/parsing logic for the ItemPicker's per-row quantity and
 * weight text inputs.
 *
 * The component keeps the raw text in a "draft" only while it is invalid (or
 * differs from the committed value); everything here is the pure decision
 * logic that draft state machine is built around - it has no knowledge of
 * React state and never touches `drafts` or the parent's `value`.
 */
import type { SourceProduct } from './types.ts'

/** Which per-row text field a piece of input belongs to. */
export type SourceInputField = 'quantity' | 'weight'

/** Result of parsing a quantity/weight text field. */
export interface ParsedPositive {
  /** True when the text was blank - a deliberately empty field, not invalid. */
  empty: boolean
  /** The parsed number, present only when `empty` is false and `valid` is true. */
  value: number | undefined
  /** False when the text is non-blank and does not parse to a positive finite number. */
  valid: boolean
}

/* --- Parsing --- */

/**
 * Parse a quantity/weight text field.
 *
 * Blank is always allowed (it means "no quantity" / "default weight"); a value
 * the solver would reject (zero, negative, NaN) is reported as invalid rather
 * than silently dropped.
 */
export function parsePositive(text: string): ParsedPositive {
  const trimmed = String(text).trim()
  if (trimmed === '') return { empty: true, value: undefined, valid: true }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { empty: false, value: undefined, valid: false }
  }
  return { empty: false, value: parsed, valid: true }
}

/** True for a number that `buildSource` would accept in place of a default. */
function isPositiveFinite(value: number | undefined): value is number {
  return Number.isFinite(value) && (value as number) > 0
}

/* --- Building --- */

/**
 * Build a SourceProduct from raw quantity/weight numbers.
 *
 * A SourceProduct must never carry a non-positive quantity - the solver
 * validates it - so the key is omitted entirely when there is no quantity.
 */
export function buildSource(
  item: string,
  quantity: number | undefined,
  weight: number | undefined,
): SourceProduct {
  return {
    item,
    ...(isPositiveFinite(quantity) ? { quantity } : {}),
    weight: isPositiveFinite(weight) ? weight : 1,
  }
}

/* --- Field patches --- */

/**
 * Decide what patch a quantity text field should commit to the parent, or
 * `null` when the text is invalid - the caller should hold the input in a
 * draft instead and leave the committed source untouched.
 */
export function resolveQuantityPatch(text: string): { quantity: number | undefined } | null {
  const { empty, value, valid } = parsePositive(text)
  if (empty) return { quantity: undefined }
  if (valid) return { quantity: value }
  return null
}

/**
 * Decide what patch a weight text field should commit to the parent, or
 * `null` when the text is invalid. A blank weight always resolves to 1.
 */
export function resolveWeightPatch(text: string): { weight: number } | null {
  const { empty, value, valid } = parsePositive(text)
  if (empty) return { weight: 1 }
  if (valid) return { weight: value as number }
  return null
}

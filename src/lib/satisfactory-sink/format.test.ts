import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { fmt } from './format.ts'
import { formatPlan } from './maximize.ts'
import type { Plan } from './types.ts'

describe('fmt', () => {
  test('trims trailing zeros so whole numbers read as e.g. "48"', () => {
    assert.equal(fmt(48), '48')
    assert.equal(fmt(48.0), '48')
  })

  test('fixes to 4 decimal places', () => {
    assert.equal(fmt(2.06450001), '2.0645')
    assert.equal(fmt(1 / 3), '0.3333')
  })

  test('drops trailing zeros left over after fixing to 4 decimals', () => {
    assert.equal(fmt(2.5), '2.5')
    assert.equal(fmt(2.1), '2.1')
  })

  test('rounds dust below 4 decimals down to zero', () => {
    assert.equal(fmt(0.000049), '0')
  })

  test('returns the em dash for non-numbers and non-finite values', () => {
    assert.equal(fmt(NaN), '—')
    assert.equal(fmt(Infinity), '—')
    assert.equal(fmt(-Infinity), '—')
    // @ts-expect-error exercising the runtime guard for non-number input
    assert.equal(fmt('48'), '—')
    // @ts-expect-error exercising the runtime guard for non-number input
    assert.equal(fmt(null), '—')
    // @ts-expect-error exercising the runtime guard for non-number input
    assert.equal(fmt(undefined), '—')
  })

  test('does not round to an integer, even for values very close to one', () => {
    assert.equal(fmt(1.99999), '2') // fixes to "2.0000" -> Number() -> 2, correctly
    assert.equal(fmt(1.9999), '1.9999') // below the rounding threshold, stays fractional
  })
})

/**
 * `fmt` must stay consistent with the `round` helper defined inside
 * formatPlan() in maximize.ts - both exist so the same quantity never reads
 * two ways in two places on one screen (the plan tables/flow diagram via
 * `fmt`, the CLI text report via `round`). This drift is the real regression
 * risk, so exercise `round` indirectly through `formatPlan`'s output rather
 * than reimplementing it in the test.
 */
describe('fmt agrees with maximize.ts formatPlan()\'s internal `round`', () => {
  const planWith = (totalPoints: number, pointsPerSourceUnit: number): Plan => ({
    status: 'optimal',
    totalPoints,
    pointsPerSourceUnit,
    sources: [],
    declined: [],
    recipes: [],
    sinks: [],
    wasted: [],
    flow: { nodes: [], edges: [] },
  })

  const casesSharedWithRound = [48, 2.0645, 2.06450001, 1 / 3, 2.5, 0.000049]

  for (const value of casesSharedWithRound) {
    test(`agree on ${value}`, () => {
      const text = formatPlan(planWith(value, value))
      const expected = fmt(value)
      assert.match(text, new RegExp(`Total sink points : ${expected.replace(/[.]/g, '\\.')}\\n`))
      assert.match(
        text,
        new RegExp(`Points per source : ${expected.replace(/[.]/g, '\\.')}\\n`),
      )
    })
  }
})

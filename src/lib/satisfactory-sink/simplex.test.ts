import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { solveLp } from './simplex.ts'

const near = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, got ${actual}`)

describe('solveLp', () => {
  test('solves a textbook maximization', () => {
    // max 3x + 5y  s.t.  x <= 4, 2y <= 12, 3x + 2y <= 18   ->  36 at (2, 6)
    // Variables: [x, y, s1, s2, s3]
    const result = solveLp({
      c: [3, 5, 0, 0, 0],
      A: [
        [1, 0, 1, 0, 0],
        [0, 2, 0, 1, 0],
        [3, 2, 0, 0, 1],
      ],
      b: [4, 12, 18],
    })

    assert.equal(result.status, 'optimal')
    near(result.objective, 36)
    near(result.x[0], 2)
    near(result.x[1], 6)
  })

  test('handles negative right-hand sides', () => {
    // -x - y = -5, maximize x  ->  x = 5
    const result = solveLp({ c: [1, 0], A: [[-1, -1]], b: [-5] })

    assert.equal(result.status, 'optimal')
    near(result.objective, 5)
  })

  test('tolerates redundant constraints', () => {
    const result = solveLp({
      c: [1, 1],
      A: [
        [1, 1],
        [2, 2],
        [1, 1],
      ],
      b: [4, 8, 4],
    })

    assert.equal(result.status, 'optimal')
    near(result.objective, 4)
  })

  test('detects infeasibility', () => {
    const result = solveLp({
      c: [1, 1],
      A: [
        [1, 1],
        [1, 1],
      ],
      b: [1, 2],
    })

    assert.equal(result.status, 'infeasible')
  })

  test('detects unboundedness', () => {
    // x - y = 1 with x, y >= 0 and objective x can grow forever.
    const result = solveLp({ c: [1, 0], A: [[1, -1]], b: [1] })

    assert.equal(result.status, 'unbounded')
  })

  test('handles a problem with no constraints', () => {
    assert.equal(solveLp({ c: [1], A: [], b: [] }).status, 'unbounded')
    assert.equal(solveLp({ c: [-1], A: [], b: [] }).status, 'optimal')
  })

  test('survives a degenerate problem that tempts cycling', () => {
    // Beale's classic cycling example, in equality form.
    const result = solveLp({
      c: [0.75, -150, 0.02, -6, 0, 0, 0],
      A: [
        [0.25, -60, -0.04, 9, 1, 0, 0],
        [0.5, -90, -0.02, 3, 0, 1, 0],
        [0, 0, 1, 0, 0, 0, 1],
      ],
      b: [0, 0, 1],
    })

    assert.equal(result.status, 'optimal')
    near(result.objective, 0.05)
  })
})

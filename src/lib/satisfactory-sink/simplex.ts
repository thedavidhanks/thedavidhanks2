/**
 * A small, dependency-free two-phase primal simplex solver.
 *
 * Solves:   maximize  c . x
 *           subject to  A x = b
 *                       x >= 0
 *
 * The sink-point problem is tiny (tens to low hundreds of rows), so a dense
 * tableau is more than fast enough and much easier to audit than a sparse
 * revised simplex.
 */

export interface LpProblem {
  /** Objective coefficients (length n). The solver maximizes `c . x`. */
  c: number[]
  /** Constraint matrix, m rows of length n. */
  A: number[][]
  /** Right-hand side (length m). May be negative; rows are normalized. */
  b: number[]
}

export type LpStatus = 'optimal' | 'infeasible' | 'unbounded'

export interface LpSolution {
  status: LpStatus
  /** Objective value at the optimum. 0 when not `optimal`. */
  objective: number
  /** Optimal variable values. Empty when not `optimal`. */
  x: number[]
  iterations: number
}

const EPS = 1e-9

/** Gauss-Jordan pivot on T[row][col], including the objective row (index m). */
function pivot(T: number[][], m: number, width: number, row: number, col: number): void {
  const pivotValue = T[row][col]
  const target = T[row]
  for (let j = 0; j <= width; j++) target[j] /= pivotValue
  target[col] = 1 // guard against drift

  for (let i = 0; i <= m; i++) {
    if (i === row) continue
    const factor = T[i][col]
    if (factor === 0) continue
    const source = T[i]
    for (let j = 0; j <= width; j++) source[j] -= factor * target[j]
    source[col] = 0
  }
}

/**
 * Rewrite the objective row so it holds reduced costs (z_j - c_j) for the
 * current basis, with the running objective value in the RHS column.
 */
function setObjectiveRow(
  T: number[][],
  basis: number[],
  m: number,
  width: number,
  cost: number[],
): void {
  const objective = T[m]
  for (let j = 0; j < width; j++) objective[j] = -cost[j]
  objective[width] = 0

  for (let i = 0; i < m; i++) {
    const basicCost = cost[basis[i]]
    if (basicCost === 0) continue
    const row = T[i]
    for (let j = 0; j <= width; j++) objective[j] += basicCost * row[j]
  }
}

/**
 * Run simplex iterations until optimal or unbounded.
 * `allowed` restricts which columns may enter the basis (used to keep
 * artificial variables out of the basis during phase 2).
 */
function iterate(
  T: number[][],
  basis: number[],
  m: number,
  width: number,
  allowed: (col: number) => boolean,
  maxIterations: number,
): { unbounded: boolean; iterations: number } {
  const objective = T[m]
  let iterations = 0

  while (iterations < maxIterations) {
    // Anti-cycling: Dantzig's rule is fast but can stall on degenerate
    // vertices, which production graphs produce a lot of. Bland's rule is
    // slower but provably terminates, so fall back to it if we run long.
    const bland = iterations > maxIterations / 2

    let entering = -1
    let best = -EPS
    for (let j = 0; j < width; j++) {
      if (!allowed(j)) continue
      if (objective[j] < -EPS) {
        if (bland) {
          entering = j
          break
        }
        if (objective[j] < best) {
          best = objective[j]
          entering = j
        }
      }
    }
    if (entering === -1) return { unbounded: false, iterations }

    // Ratio test.
    let leaving = -1
    let bestRatio = Infinity
    for (let i = 0; i < m; i++) {
      const a = T[i][entering]
      if (a <= EPS) continue
      const ratio = T[i][width] / a
      if (ratio < bestRatio - EPS || (ratio < bestRatio + EPS && leaving >= 0 && basis[i] < basis[leaving])) {
        bestRatio = Math.min(ratio, bestRatio)
        leaving = i
      }
    }
    if (leaving === -1) return { unbounded: true, iterations }

    pivot(T, m, width, leaving, entering)
    basis[leaving] = entering
    iterations++
  }

  throw new Error(`simplex: exceeded ${maxIterations} iterations without converging`)
}

export function solveLp(problem: LpProblem, maxIterations = 20000): LpSolution {
  const { c, A, b } = problem
  const m = A.length
  const n = c.length

  if (m === 0) {
    // No constraints: any positive objective coefficient runs away to infinity.
    if (c.some((value) => value > EPS)) return { status: 'unbounded', objective: 0, x: [], iterations: 0 }
    return { status: 'optimal', objective: 0, x: new Array(n).fill(0), iterations: 0 }
  }

  const width = n + m // original variables followed by one artificial per row
  const T: number[][] = []
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(width + 1).fill(0)
    // Normalize so every RHS is non-negative; artificials then form a
    // feasible starting basis.
    const sign = b[i] < 0 ? -1 : 1
    for (let j = 0; j < n; j++) row[j] = sign * A[i][j]
    row[n + i] = 1
    row[width] = sign * b[i]
    T.push(row)
  }
  T.push(new Array<number>(width + 1).fill(0))

  const basis = Array.from({ length: m }, (_, i) => n + i)

  // --- Phase 1: minimize the sum of artificials (i.e. maximize its negation).
  const phase1Cost = new Array<number>(width).fill(0)
  for (let j = n; j < width; j++) phase1Cost[j] = -1
  setObjectiveRow(T, basis, m, width, phase1Cost)

  const phase1 = iterate(T, basis, m, width, () => true, maxIterations)
  let iterations = phase1.iterations

  if (T[m][width] < -1e-7) {
    return { status: 'infeasible', objective: 0, x: [], iterations }
  }

  // Drive any artificial still in the basis (at value 0) back out. A row where
  // that is impossible is linearly dependent on the others -- it is redundant
  // and its all-zero original columns mean later pivots cannot disturb it.
  for (let i = 0; i < m; i++) {
    if (basis[i] < n) continue
    let replacement = -1
    for (let j = 0; j < n; j++) {
      if (Math.abs(T[i][j]) > EPS) {
        replacement = j
        break
      }
    }
    if (replacement >= 0) {
      pivot(T, m, width, i, replacement)
      basis[i] = replacement
    }
  }

  // --- Phase 2: the real objective, with artificials frozen out.
  const phase2Cost = new Array<number>(width).fill(0)
  for (let j = 0; j < n; j++) phase2Cost[j] = c[j]
  setObjectiveRow(T, basis, m, width, phase2Cost)

  const phase2 = iterate(T, basis, m, width, (col) => col < n, maxIterations)
  iterations += phase2.iterations
  if (phase2.unbounded) {
    return { status: 'unbounded', objective: 0, x: [], iterations }
  }

  const x = new Array<number>(n).fill(0)
  for (let i = 0; i < m; i++) {
    if (basis[i] < n) x[basis[i]] = T[i][width]
  }
  // Recompute from x rather than trusting the accumulated RHS.
  let objective = 0
  for (let j = 0; j < n; j++) objective += c[j] * x[j]

  return { status: 'optimal', objective, x, iterations }
}

import type {
  Dataset,
  Item,
  ItemId,
  Plan,
  Problem,
  Recipe,
  SolveMode,
  SourceProduct,
} from './types.ts'
import { solveLp } from './simplex.ts'
import { buildFlowGraph } from './flow.ts'
import { clean } from './numeric.ts'

function indexBy<T extends { id: string }>(rows: T[], label: string): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    if (map.has(row.id)) throw new Error(`duplicate ${label} id: ${row.id}`)
    map.set(row.id, row)
  }
  return map
}

function validate(dataset: Dataset, items: Map<ItemId, Item>): void {
  for (const recipe of dataset.recipes) {
    if (recipe.outputs.length === 0) throw new Error(`recipe ${recipe.id} has no outputs`)
    for (const ingredient of [...recipe.inputs, ...recipe.outputs]) {
      if (!items.has(ingredient.item)) {
        throw new Error(`recipe ${recipe.id} references unknown item: ${ingredient.item}`)
      }
      if (!(ingredient.quantity > 0)) {
        throw new Error(`recipe ${recipe.id} has a non-positive quantity for ${ingredient.item}`)
      }
    }
  }
}

/** Merge duplicate source entries and fill in defaults. */
function normalizeSources(sources: SourceProduct[], items: Map<ItemId, Item>, mode: SolveMode) {
  const merged = new Map<ItemId, { item: ItemId; quantity: number; weight: number }>()
  for (const source of sources) {
    if (!items.has(source.item)) throw new Error(`unknown source item: ${source.item}`)
    const weight = source.weight ?? 1
    if (!(weight > 0)) throw new Error(`source ${source.item} has a non-positive weight`)
    const quantity = source.quantity ?? (mode === 'ratio' ? 0 : 1)
    if (mode === 'fixed' && !(quantity > 0)) {
      throw new Error(`source ${source.item} needs a positive quantity in fixed mode`)
    }
    const existing = merged.get(source.item)
    if (existing) existing.quantity += quantity
    else merged.set(source.item, { item: source.item, quantity, weight })
  }
  if (merged.size === 0) throw new Error('at least one source product is required')
  return [...merged.values()]
}

/**
 * Forward closure: a recipe is usable only once every one of its inputs can be
 * obtained from the sources. Everything outside the closure is dropped before
 * the LP is built, which is what keeps the tableau small when the dataset holds
 * the full recipe book. Runs in O(V + E).
 */
function reachable(dataset: Dataset, sourceIds: ItemId[]) {
  const consumers = new Map<ItemId, Recipe[]>()
  const missing = new Map<string, number>()

  for (const recipe of dataset.recipes) {
    const distinctInputs = new Set(recipe.inputs.map((input) => input.item))
    missing.set(recipe.id, distinctInputs.size)
    for (const input of distinctInputs) {
      const list = consumers.get(input)
      if (list) list.push(recipe)
      else consumers.set(input, [recipe])
    }
  }

  const available = new Set<ItemId>(sourceIds)
  const usable: Recipe[] = []
  const queue: ItemId[] = [...sourceIds]

  // Recipes with no inputs at all are usable from the start.
  for (const recipe of dataset.recipes) {
    if (missing.get(recipe.id) === 0) {
      usable.push(recipe)
      for (const output of recipe.outputs) {
        if (!available.has(output.item)) {
          available.add(output.item)
          queue.push(output.item)
        }
      }
    }
  }

  while (queue.length > 0) {
    const itemId = queue.pop() as ItemId
    for (const recipe of consumers.get(itemId) ?? []) {
      const remaining = (missing.get(recipe.id) as number) - 1
      missing.set(recipe.id, remaining)
      if (remaining !== 0) continue
      usable.push(recipe)
      for (const output of recipe.outputs) {
        if (!available.has(output.item)) {
          available.add(output.item)
          queue.push(output.item)
        }
      }
    }
  }

  return { available, usable }
}

/**
 * Which question the caller meant when they left quantities off.
 *
 * `ratio` is the default only for a single product, where "unlimited supply,
 * best mix" and "one unit" ask the same thing. Naming several products without
 * quantities means "here is what I have, plan for all of it", and a ratio
 * answers something else: the 1-unit budget goes entirely to whichever product
 * scores highest and the rest are dropped, so `"motor" "coal"` would sink the
 * motor and ignore the coal. Ask for a mix explicitly with `mode: 'ratio'`.
 */
export function resolveMode(sources: SourceProduct[], mode?: SolveMode): SolveMode {
  if (mode) return mode
  const distinct = new Set(sources.map((source) => source.item))
  return distinct.size === 1 && sources.every((source) => source.quantity == null)
    ? 'ratio'
    : 'fixed'
}

/**
 * Explain an infeasible LP in the caller's terms. Infeasibility here always
 * traces back to an item that can be neither sunk nor discarded nor consumed,
 * so name those items rather than making the caller guess.
 */
function infeasibleReason(itemList: Item[], usable: Recipe[]): string {
  const consumed = new Set<ItemId>()
  for (const recipe of usable) for (const input of recipe.inputs) consumed.add(input.item)

  const stuck = itemList.filter(
    (item) => item.sinkPoints == null && item.disposable === false && !consumed.has(item.id),
  )
  if (stuck.length === 0) {
    return 'No feasible plan exists: some item can be neither sunk, discarded, nor consumed.'
  }
  const names = stuck.map((item) => item.name).join(', ')
  return `No feasible plan exists. ${names} cannot be sunk, cannot be discarded, and no available recipe consumes ${stuck.length === 1 ? 'it' : 'them'}.`
}

/**
 * Maximize AWESOME Sink points obtainable from a set of source products.
 *
 * The whole problem is one linear program: recipe run counts and sink
 * quantities are the variables, item conservation gives the constraints, and
 * sink points give the objective. See docs/satisfactory-sink-maximizer.md.
 */
export function maximizeSinkPoints(problem: Problem): Plan {
  const { dataset } = problem
  const items = indexBy(dataset.items, 'item')
  indexBy(dataset.recipes, 'recipe')
  validate(dataset, items)

  const mode = resolveMode(problem.sources, problem.mode)
  const sources = normalizeSources(problem.sources, items, mode)
  const scaleTo = mode === 'ratio' ? (problem.scaleTo ?? 1) : 1
  if (!(scaleTo > 0)) throw new Error('scaleTo must be positive')

  const { available, usable } = reachable(
    dataset,
    sources.map((source) => source.item),
  )

  // --- Variable layout -----------------------------------------------------
  const itemList = [...available].map((id) => items.get(id) as Item)
  const rowOf = new Map<ItemId, number>()
  itemList.forEach((item, index) => rowOf.set(item.id, index))

  const sinkable = itemList.filter((item) => item.sinkPoints != null)
  const wastable = itemList.filter((item) => item.sinkPoints == null && item.disposable !== false)

  const recipeBase = 0
  const sinkBase = recipeBase + usable.length
  const wasteBase = sinkBase + sinkable.length
  const supplyBase = wasteBase + wastable.length
  const columns = supplyBase + (mode === 'ratio' ? sources.length : 0)

  const rows = itemList.length + (mode === 'ratio' ? 1 : 0)
  const A: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0))
  const b = new Array<number>(rows).fill(0)
  const c = new Array<number>(columns).fill(0)

  // Item conservation: production - consumption + supply - sunk - wasted = 0.
  usable.forEach((recipe, index) => {
    for (const output of recipe.outputs) {
      A[rowOf.get(output.item) as number][recipeBase + index] += output.quantity
    }
    for (const input of recipe.inputs) {
      A[rowOf.get(input.item) as number][recipeBase + index] -= input.quantity
    }
  })
  sinkable.forEach((item, index) => {
    A[rowOf.get(item.id) as number][sinkBase + index] = -1
    c[sinkBase + index] = item.sinkPoints as number
  })
  wastable.forEach((item, index) => {
    A[rowOf.get(item.id) as number][wasteBase + index] = -1
  })

  if (mode === 'fixed') {
    // Supply is a constant, so it moves to the right-hand side.
    for (const source of sources) b[rowOf.get(source.item) as number] -= source.quantity
  } else {
    // Supply is a variable, normalized so the weighted source budget is 1.
    // This is the Charnes-Cooper trick: maximizing points subject to
    // "one unit of source" is equivalent to maximizing the points/source ratio.
    const budgetRow = itemList.length
    sources.forEach((source, index) => {
      A[rowOf.get(source.item) as number][supplyBase + index] = 1
      A[budgetRow][supplyBase + index] = source.weight
    })
    b[budgetRow] = 1
  }

  const solution = solveLp({ c, A, b })

  if (solution.status !== 'optimal') {
    return {
      status: solution.status,
      totalPoints: 0,
      pointsPerSourceUnit: 0,
      sources: [],
      declined: [],
      recipes: [],
      sinks: [],
      wasted: [],
      flow: { nodes: [], edges: [] },
      reason:
        solution.status === 'unbounded'
          ? 'The recipe set contains a loop that produces sinkable items out of nothing, so points are unlimited. Check for a cycle whose outputs exceed its inputs.'
          : infeasibleReason(itemList, usable),
    }
  }

  const { x } = solution
  const scale = scaleTo

  const usedSources = sources.map((source, index) => ({
    item: source.item,
    name: (items.get(source.item) as Item).name,
    quantity: clean((mode === 'fixed' ? source.quantity : x[supplyBase + index]) * scale),
    weight: source.weight,
    share: 0,
  }))
  const weightedTotal = usedSources.reduce(
    (sum, source) => sum + source.quantity * source.weight,
    0,
  )
  for (const source of usedSources) {
    source.share = weightedTotal > 0 ? clean((source.quantity * source.weight) / weightedTotal) : 0
  }

  const totalPoints = clean(solution.objective * scale)

  const plan: Plan = {
    status: 'optimal',
    totalPoints,
    pointsPerSourceUnit: weightedTotal > 0 ? clean(totalPoints / weightedTotal) : 0,
    sources: usedSources.filter((source) => source.quantity > 0),
    // Only reachable in ratio mode, where the solver is free to spend none of
    // the budget on a product. Report it rather than dropping it silently:
    // "your coal is not in the plan" is the answer, not a rendering accident.
    declined: usedSources
      .filter((source) => source.quantity <= 0)
      .map((source) => ({ item: source.item, name: source.name })),
    recipes: usable
      .map((recipe, index) => ({
        recipe: recipe.id,
        name: recipe.name,
        runs: clean(x[recipeBase + index] * scale),
      }))
      .filter((run) => run.runs > 0)
      .sort((a, b2) => b2.runs - a.runs),
    sinks: sinkable
      .map((item, index) => {
        const quantity = clean(x[sinkBase + index] * scale)
        return {
          item: item.id,
          name: item.name,
          quantity,
          pointsEach: item.sinkPoints as number,
          points: clean(quantity * (item.sinkPoints as number)),
        }
      })
      .filter((entry) => entry.quantity > 0)
      .sort((a, b2) => b2.points - a.points),
    wasted: wastable
      .map((item, index) => ({
        item: item.id,
        name: item.name,
        quantity: clean(x[wasteBase + index] * scale),
      }))
      .filter((entry) => entry.quantity > 0),
    flow: { nodes: [], edges: [] },
  }

  // Built from the finished plan rather than from the tableau, so the graph is
  // a decomposition of exactly the scaled, cleaned numbers printed above it.
  plan.flow = buildFlowGraph(plan, dataset)
  return plan
}

/** Render a plan as human-readable text for the CLI. */
export function formatPlan(plan: Plan): string {
  if (plan.status !== 'optimal') {
    return `${plan.status.toUpperCase()}: ${plan.reason ?? ''}`.trim()
  }

  const lines: string[] = []
  const round = (value: number) => Number(value.toFixed(4)).toString()

  lines.push(`Total sink points : ${round(plan.totalPoints)}`)
  lines.push(`Points per source : ${round(plan.pointsPerSourceUnit)}`)
  lines.push('')
  lines.push('Source products consumed:')
  for (const source of plan.sources) {
    const share = (source.share * 100).toFixed(1)
    lines.push(`  ${round(source.quantity).padStart(10)} x ${source.name}  (${share}% of budget)`)
  }
  if (plan.declined.length > 0) {
    lines.push('')
    lines.push('Not worth feeding (they lower points per source unit):')
    for (const source of plan.declined) lines.push(`  ${source.name.padStart(14)}`)
    lines.push('  Give quantities (e.g. "coal:300") to plan for them anyway.')
  }
  lines.push('')
  lines.push(plan.recipes.length > 0 ? 'Recipes to run (crafts):' : 'Recipes to run: none - sink the raw products')
  for (const run of plan.recipes) {
    lines.push(`  ${round(run.runs).padStart(10)} x ${run.name}`)
  }
  lines.push('')
  lines.push('Feed to the AWESOME Sink:')
  for (const entry of plan.sinks) {
    lines.push(
      `  ${round(entry.quantity).padStart(10)} x ${entry.name}  @ ${entry.pointsEach} = ${round(entry.points)} pts`,
    )
  }
  if (plan.flow.edges.length > 0) {
    const nodeById = new Map(plan.flow.nodes.map((node) => [node.id, node]))
    const labelOf = (id: string) => nodeById.get(id)?.name ?? id
    const width = (pick: (edge: (typeof plan.flow.edges)[number]) => string) =>
      plan.flow.edges.reduce((max, edge) => Math.max(max, pick(edge).length), 0)
    const fromWidth = width((edge) => labelOf(edge.from))
    const itemWidth = width((edge) => edge.itemName)

    lines.push('')
    lines.push('Material flow (source -> sink):')
    for (const edge of plan.flow.edges) {
      const marker = edge.pooled ? ' *' : ''
      lines.push(
        `  ${labelOf(edge.from).padEnd(fromWidth)}  ${round(edge.quantity).padStart(10)} x ` +
          `${edge.itemName.padEnd(itemWidth)}  -> ${labelOf(edge.to)}${marker}`,
      )
    }
    if (plan.flow.edges.some((edge) => edge.pooled)) {
      lines.push('  * shares a pool with other producers; the split shown is one valid one.')
    }
    const offPath = plan.flow.nodes.filter(
      (node) => node.kind === 'recipe' && !node.onSinkPath,
    )
    if (offPath.length > 0) {
      const names = offPath.map((node) => node.name).join(', ')
      lines.push(`  Not on a path to the Sink (run only to get rid of a byproduct): ${names}`)
    }
  }

  if (plan.wasted.length > 0) {
    lines.push('')
    lines.push('Byproducts with nowhere to go (must be vented/dumped):')
    for (const entry of plan.wasted) {
      lines.push(`  ${round(entry.quantity).padStart(10)} x ${entry.name}`)
    }
  }
  return lines.join('\n')
}

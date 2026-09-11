/**
 * Turn a solved plan into a graph you can draw: source products on one side,
 * the AWESOME Sink on the other, every recipe the plan runs in between.
 *
 * The edges are not something the solver hands over. The LP decides how many
 * times to run each recipe and how much of each item to sink; it never decides
 * *which producer's output feeds which consumer*, because that has no effect on
 * the objective. When two recipes make Iron Ingot and three consume it, only
 * the pooled totals are determinate — the split is a free choice.
 *
 * So this is a flow decomposition of the solution: per item, each producer's
 * output is split across the consumers in proportion to their sizes. That
 * conserves flow exactly at every node, is deterministic, and invents no
 * pairing that the data does not support. Where the choice was genuinely free
 * (more than one producer *and* more than one consumer) the edges carry
 * `pooled: true`, so a diagram can render them as a shared pool rather than
 * present one arbitrary split as fact.
 */
import type {
  Dataset,
  FlowEdge,
  FlowGraph,
  FlowNode,
  ItemId,
  Plan,
  Recipe,
} from './types.ts'
import { ZERO, clean } from './numeric.ts'

export const SINK_NODE_ID = 'sink'
export const WASTE_NODE_ID = 'waste'

const sourceNodeId = (item: ItemId) => `source:${item}`
const recipeNodeId = (recipe: string) => `recipe:${recipe}`

/** One end of an item's flow: a node and how much of that item it moves. */
interface Endpoint {
  node: string
  amount: number
}

interface Ledger {
  producers: Endpoint[]
  consumers: Endpoint[]
}

function ledgerFor(ledgers: Map<ItemId, Ledger>, item: ItemId): Ledger {
  const existing = ledgers.get(item)
  if (existing) return existing
  const created: Ledger = { producers: [], consumers: [] }
  ledgers.set(item, created)
  return created
}

/**
 * Net a recipe's inputs against its outputs for each item it touches.
 *
 * Three recipes in the shipped dataset list the same item on both sides
 * (Alternate: Distilled Silica, Alternate: Instant Scrap, Encased Uranium Cell).
 * Taken literally they would draw a self-loop and inflate the item's pool by
 * the recirculating amount, which is not a thing the factory does — the machine
 * consumes what it makes internally.
 */
function netFlows(recipe: Recipe, runs: number): Map<ItemId, number> {
  const net = new Map<ItemId, number>()
  const add = (item: ItemId, amount: number) => net.set(item, (net.get(item) ?? 0) + amount)
  for (const output of recipe.outputs) add(output.item, output.quantity * runs)
  for (const input of recipe.inputs) add(input.item, -input.quantity * runs)
  return net
}

/** Breadth-first reachability over an adjacency map. Cycle-safe by construction. */
function reachableFrom(starts: string[], adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>(starts)
  const queue = [...starts]
  while (queue.length > 0) {
    const node = queue.pop() as string
    for (const next of adjacency.get(node) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

/**
 * Longest-path rank from the sources, for a layered layout.
 *
 * Relaxes depths in waves, capped at the node count. The cap is what makes this
 * safe on a cyclic graph: Alternate: Recycled Plastic and Alternate: Recycled
 * Rubber consume each other's output, so "longest path" is unbounded in
 * principle. Stopping after n waves gives every node on an acyclic path its
 * true depth and every node in a cycle a stable, if arbitrary, one.
 */
function computeDepths(nodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const depth = new Map<string, number>()
  for (const node of nodes) depth.set(node.id, 0)

  for (let wave = 0; wave < nodes.length; wave += 1) {
    let changed = false
    for (const edge of edges) {
      const candidate = (depth.get(edge.from) as number) + 1
      if (candidate > (depth.get(edge.to) as number)) {
        depth.set(edge.to, candidate)
        changed = true
      }
    }
    if (!changed) break
  }
  return depth
}

/**
 * Build the flow graph for a solved plan.
 *
 * `dataset` is needed because a `Plan` carries recipe run counts but not the
 * recipes' ingredient lists. Pass the same dataset the plan was solved against.
 * A non-optimal plan has nothing to draw and yields an empty graph.
 */
export function buildFlowGraph(plan: Plan, dataset: Dataset): FlowGraph {
  if (plan.status !== 'optimal') return { nodes: [], edges: [] }

  const recipesById = new Map<string, Recipe>(dataset.recipes.map((recipe) => [recipe.id, recipe]))
  const nodes: FlowNode[] = []
  const ledgers = new Map<ItemId, Ledger>()

  // --- Nodes, and the per-item ledger of who makes and who takes what --------
  for (const source of plan.sources) {
    const id = sourceNodeId(source.item)
    nodes.push({
      id,
      kind: 'source',
      name: source.name,
      item: source.item,
      quantity: source.quantity,
      depth: 0,
      onSinkPath: false,
    })
    ledgerFor(ledgers, source.item).producers.push({ node: id, amount: source.quantity })
  }

  for (const run of plan.recipes) {
    const recipe = recipesById.get(run.recipe)
    if (!recipe) throw new Error(`flow: plan references unknown recipe ${run.recipe}`)
    const id = recipeNodeId(run.recipe)
    nodes.push({
      id,
      kind: 'recipe',
      name: run.name,
      recipe: run.recipe,
      runs: run.runs,
      machine: recipe.machine,
      depth: 0,
      onSinkPath: false,
    })
    for (const [item, amount] of netFlows(recipe, run.runs)) {
      if (amount > ZERO) ledgerFor(ledgers, item).producers.push({ node: id, amount })
      else if (amount < -ZERO) ledgerFor(ledgers, item).consumers.push({ node: id, amount: -amount })
    }
  }

  if (plan.sinks.length > 0) {
    nodes.push({
      id: SINK_NODE_ID,
      kind: 'sink',
      name: 'AWESOME Sink',
      depth: 0,
      onSinkPath: true,
    })
    for (const entry of plan.sinks) {
      ledgerFor(ledgers, entry.item).consumers.push({
        node: SINK_NODE_ID,
        amount: entry.quantity,
      })
    }
  }

  if (plan.wasted.length > 0) {
    nodes.push({
      id: WASTE_NODE_ID,
      kind: 'waste',
      name: 'Vented / dumped',
      depth: 0,
      onSinkPath: false,
    })
    for (const entry of plan.wasted) {
      ledgerFor(ledgers, entry.item).consumers.push({
        node: WASTE_NODE_ID,
        amount: entry.quantity,
      })
    }
  }

  // --- Edges: split each producer across the consumers, in proportion --------
  const itemName = new Map<ItemId, string>(dataset.items.map((item) => [item.id, item.name]))
  const edges: FlowEdge[] = []

  for (const [item, ledger] of ledgers) {
    const total = ledger.producers.reduce((sum, producer) => sum + producer.amount, 0)
    if (total <= ZERO) continue
    const pooled = ledger.producers.length > 1 && ledger.consumers.length > 1

    for (const producer of ledger.producers) {
      for (const consumer of ledger.consumers) {
        const quantity = clean((producer.amount * consumer.amount) / total)
        if (quantity <= 0) continue
        edges.push({
          from: producer.node,
          to: consumer.node,
          item,
          itemName: itemName.get(item) ?? item,
          quantity,
          pooled,
        })
      }
    }
  }

  // --- Which recipes actually lie on a source -> sink path -------------------
  const forward = new Map<string, string[]>()
  const backward = new Map<string, string[]>()
  const link = (adjacency: Map<string, string[]>, from: string, to: string) => {
    const list = adjacency.get(from)
    if (list) list.push(to)
    else adjacency.set(from, [to])
  }
  for (const edge of edges) {
    link(forward, edge.from, edge.to)
    link(backward, edge.to, edge.from)
  }

  const fromSources = reachableFrom(
    nodes.filter((node) => node.kind === 'source').map((node) => node.id),
    forward,
  )
  const toSink = reachableFrom(
    nodes.some((node) => node.kind === 'sink') ? [SINK_NODE_ID] : [],
    backward,
  )
  for (const node of nodes) {
    node.onSinkPath = fromSources.has(node.id) && toSink.has(node.id)
  }

  const depths = computeDepths(nodes, edges)
  for (const node of nodes) node.depth = depths.get(node.id) as number
  // Terminals belong at the far right whatever the longest path to them was.
  const deepest = nodes.reduce((max, node) => Math.max(max, node.depth), 0)
  for (const node of nodes) {
    if (node.kind === 'sink' || node.kind === 'waste') node.depth = deepest
  }

  edges.sort(
    (a, b) =>
      (depths.get(a.from) as number) - (depths.get(b.from) as number) ||
      b.quantity - a.quantity ||
      a.itemName.localeCompare(b.itemName),
  )

  return { nodes, edges }
}

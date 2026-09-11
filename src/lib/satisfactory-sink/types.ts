export type ItemId = string
export type RecipeId = string

export interface Item {
  id: ItemId
  name: string
  /**
   * Points awarded by the AWESOME Sink for one unit.
   * `null` means the item cannot be sunk at all (fluids, for example).
   */
  sinkPoints: number | null
  /**
   * Can surplus be thrown away for free? Defaults to `true`.
   * Set `false` for items that will back up a belt/pipe and stall the factory
   * if nothing consumes them, which forces the plan to actually use them.
   */
  disposable?: boolean
  /** Free-form grouping, e.g. "ore", "ingot", "fluid". Not used by the solver. */
  category?: string
}

export interface Ingredient {
  item: ItemId
  /** Units per craft. Must be > 0. */
  quantity: number
}

export interface Recipe {
  id: RecipeId
  name: string
  inputs: Ingredient[]
  outputs: Ingredient[]
  /** True for alternate (hard-drive) recipes. Not used by the solver. */
  alternate?: boolean
  /** Producing building, e.g. "Constructor". Not used by the solver. */
  machine?: string
}

export interface Dataset {
  items: Item[]
  recipes: Recipe[]
  /** Game version the numbers were pulled from, e.g. "1.1". */
  gameVersion?: string
}

export interface SourceProduct {
  item: ItemId
  /**
   * How much of this product you have (or, more usefully, its rate in
   * items/min). Defaults to 1 in `fixed` mode; ignored in `ratio` mode.
   */
  quantity?: number
  /**
   * Relative cost of one unit of this product, used as the denominator of
   * "points per source unit". Defaults to 1, i.e. one iron ore costs the same
   * as one coal. Raise it for products you consider expensive.
   */
  weight?: number
}

export type SolveMode = 'fixed' | 'ratio'

export interface Problem {
  dataset: Dataset
  /** The products you are willing to feed in. Others are unavailable. */
  sources: SourceProduct[]
  /**
   * `fixed`  - you have the given quantities; maximize total points.
   * `ratio`  - unlimited supply in any mix; maximize points per source unit
   *            and report the best mix.
   * Defaults to `ratio` for a single product with no quantity - the one case
   * where "best mix" is not a choice - and to `fixed` otherwise, filling in a
   * quantity of 1 for any product that was given without one. Several products
   * named without quantities means "plan for all of these", which a ratio
   * would answer by spending its whole budget on the highest-scoring one.
   */
  mode?: SolveMode
  /** In `ratio` mode, scale the reported plan to this many source units. */
  scaleTo?: number
}

export interface RecipeRun {
  recipe: RecipeId
  name: string
  /** Number of crafts. Fractional is fine: it is a machine clock rate. */
  runs: number
}

export interface SinkEntry {
  item: ItemId
  name: string
  quantity: number
  pointsEach: number
  points: number
}

export interface SourceUse {
  item: ItemId
  name: string
  quantity: number
  weight: number
  /** Share of the weighted source budget spent on this product. */
  share: number
}

export type FlowNodeKind = 'source' | 'recipe' | 'sink' | 'waste'

export interface FlowNode {
  /** `source:iron-ore`, `recipe:iron-ingot`, `sink`, or `waste`. */
  id: string
  kind: FlowNodeKind
  /** Display label: the product name, the recipe name, or the terminal's name. */
  name: string
  /** Source nodes only. */
  item?: ItemId
  /** Recipe nodes only. */
  recipe?: RecipeId
  /** Source nodes: units supplied. */
  quantity?: number
  /** Recipe nodes: crafts, the same figure as the matching `RecipeRun`. */
  runs?: number
  /** Recipe nodes, when the dataset carries it. */
  machine?: string
  /**
   * Longest-path rank from the sources, 0 for a source node. A layout hint for
   * a layered diagram, nothing the graph's meaning depends on.
   */
  depth: number
  /**
   * Reachable from a source *and* able to reach the sink. False marks a branch
   * that only ever terminates at `waste` — a recipe run solely to consume a
   * byproduct the game will not let you discard.
   */
  onSinkPath: boolean
}

export interface FlowEdge {
  /** `FlowNode` id. */
  from: string
  /** `FlowNode` id. */
  to: string
  item: ItemId
  itemName: string
  quantity: number
  /**
   * The item had more than one producer *and* more than one consumer, so this
   * edge is one valid split of a shared pool rather than an observed pairing.
   * Only the pooled totals are determinate; see the note in flow.ts.
   */
  pooled: boolean
}

/**
 * The plan as a graph: sources on the left, the AWESOME Sink on the right, and
 * every recipe the plan runs on a path between them. May contain cycles.
 */
export interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface Plan {
  status: 'optimal' | 'infeasible' | 'unbounded'
  /** Total sink points produced by the plan. */
  totalPoints: number
  /** `totalPoints` divided by the weighted source units consumed. */
  pointsPerSourceUnit: number
  sources: SourceUse[]
  /**
   * Products that were offered but left out of the plan. Only `ratio` mode can
   * decline a product: any share of the budget spent on it would lower the
   * points-per-source-unit average.
   */
  declined: Array<{ item: ItemId; name: string }>
  recipes: RecipeRun[]
  sinks: SinkEntry[]
  /** Surplus that had to be thrown away (unsinkable byproducts). */
  wasted: Array<{ item: ItemId; name: string; quantity: number }>
  /**
   * The same plan as a graph, for drawing it. Empty for a non-optimal plan —
   * always present, so a caller cannot forget to null-check it.
   */
  flow: FlowGraph
  /** Set when `status` is not `optimal`. */
  reason?: string
}

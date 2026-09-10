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
   * items/min). Required in `fixed` mode, ignored in `ratio` mode.
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
   * Defaults to `fixed` when every source has a quantity, otherwise `ratio`.
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

export interface Plan {
  status: 'optimal' | 'infeasible' | 'unbounded'
  /** Total sink points produced by the plan. */
  totalPoints: number
  /** `totalPoints` divided by the weighted source units consumed. */
  pointsPerSourceUnit: number
  sources: SourceUse[]
  recipes: RecipeRun[]
  sinks: SinkEntry[]
  /** Surplus that had to be thrown away (unsinkable byproducts). */
  wasted: Array<{ item: ItemId; name: string; quantity: number }>
  /** Set when `status` is not `optimal`. */
  reason?: string
}

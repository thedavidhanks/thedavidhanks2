/**
 * Pure text helpers for drawing a `plan.flow` graph: what a box is called,
 * what goes underneath it, and how to fit either into the room a renderer
 * gives it.
 *
 * No React, no DOM, no measuring — see layout.ts for the geometry these
 * labels get painted onto.
 */
import type { Dataset, FlowGraph, ItemId, Recipe } from './types.ts'

/* --- Truncation --------------------------------------------------------- */

// Rough advance width per character as a fraction of the font size. SVG cannot
// wrap text and measuring in JS would mean a layout pass per render, so labels
// are clipped to an estimate. Nothing is lost to the clip: every box carries a
// <title> tooltip and the text list below the diagram spells all of it out.
//
// Bold is wider. The box label is 600 weight and the system UI stack the page
// inherits runs ~0.58-0.60 there, so it gets its own ratio — sharing 0.56 let
// the longest labels overrun the box by ~11px into the gutter.
export const CHAR_RATIO = 0.56
export const BOLD_CHAR_RATIO = 0.6

/**
 * Clip `text` to roughly what fits in `available` px at `fontSize`, ellipsing
 * with a single `…` rather than wrapping or overflowing.
 */
export function truncate(
  text: string,
  fontSize: number,
  available: number,
  ratio: number = CHAR_RATIO,
): string {
  const max = Math.floor(available / (fontSize * ratio))
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1))}…`
}

/* --- Node labels ---------------------------------------------------------- */

const ALTERNATE_PREFIX = 'Alternate: '

/**
 * The product a recipe is *for*, as opposed to what falls out of it as well.
 *
 * `outputs[0]` is not it. The dataset comes out of the game's own docs export
 * in whatever order the recipe was authored, and eight multi-output recipes
 * list the byproduct first — Rubber and Plastic both lead with Heavy Oil
 * Residue, the Dark Matter Residue recipes all do. Taking the first output
 * would put two boxes labelled "Heavy Oil Residue" side by side in any crude
 * oil plan, one of which is really the Rubber machine.
 *
 * So: the output the recipe is named after, if there is one, and the first
 * output otherwise. The name match is exact (bar the "Alternate: " prefix), so
 * it either fires on the right product or does not fire at all — the fallback
 * covers "Residual Fuel" making Fuel, where nothing matches.
 */
export function primaryOutput(
  recipe: Recipe | undefined,
  items: Map<ItemId, string>,
): ItemId | undefined {
  const outputs = recipe?.outputs ?? []
  if (outputs.length === 0) return undefined
  const bare = recipe!.name.startsWith(ALTERNATE_PREFIX)
    ? recipe!.name.slice(ALTERNATE_PREFIX.length)
    : recipe!.name
  const named = outputs.find((output) => items.get(output.item) === bare)
  return (named ?? outputs[0]).item
}

export interface NodeLabel {
  label: string
  sub: string
}

/**
 * What each box is called, and what to print under it.
 *
 * A recipe node is labelled with its primary output item, so the box says
 * "Iron Ingot" whether the plan smelted it the normal way or used Alternate:
 * Pure Iron Ingot. The recipe name goes underneath unless it would just repeat
 * the line above it, which is the ordinary case for the standard recipes —
 * "Iron Ingot" made by the "Iron Ingot" recipe needs saying once.
 */
export function describeNodes(graph: FlowGraph, dataset: Dataset): Map<string, NodeLabel> {
  const items = new Map(dataset.items.map((item) => [item.id, item.name]))
  const recipes = new Map(dataset.recipes.map((recipe) => [recipe.id, recipe]))

  return new Map(graph.nodes.map((node) => {
    if (node.kind !== 'recipe') return [node.id, { label: node.name, sub: '' }]

    const recipe = recipes.get(node.recipe as string)
    const output = primaryOutput(recipe, items)
    // Falling back to the recipe name keeps the box labelled if a caller
    // ever passes a dataset the plan was not solved against.
    const label = (output && items.get(output)) || node.name
    return [node.id, { label, sub: node.name === label ? '' : node.name }]
  }))
}

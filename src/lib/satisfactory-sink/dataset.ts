import type { Dataset, Ingredient, Item, ItemId, Recipe } from './types.ts'
import itemsFile from '../../data/satisfactory/items.json' with { type: 'json' }
import recipesFile from '../../data/satisfactory/recipes.json' with { type: 'json' }

function fail(message: string): never {
  throw new Error(`dataset: ${message}`)
}

function asIngredients(raw: unknown, where: string): Ingredient[] {
  if (!Array.isArray(raw)) fail(`${where} must be an array`)
  return raw.map((entry, index) => {
    const row = entry as Record<string, unknown>
    if (typeof row.item !== 'string') fail(`${where}[${index}].item must be a string`)
    if (typeof row.quantity !== 'number' || !(row.quantity > 0)) {
      fail(`${where}[${index}].quantity must be a positive number`)
    }
    return { item: row.item, quantity: row.quantity }
  })
}

/**
 * Validate raw JSON into a `Dataset`. Runtime validation matters here because
 * the data is expected to be regenerated from the wiki or from the game's
 * own `Docs.json`, not hand-maintained.
 */
export function loadDataset(rawItems: unknown, rawRecipes: unknown, gameVersion?: string): Dataset {
  const itemRows = (rawItems as { items?: unknown }).items
  const recipeRows = (rawRecipes as { recipes?: unknown }).recipes
  if (!Array.isArray(itemRows)) fail('items payload must have an `items` array')
  if (!Array.isArray(recipeRows)) fail('recipes payload must have a `recipes` array')

  const items: Item[] = itemRows.map((entry, index) => {
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string') fail(`items[${index}].id must be a string`)
    if (typeof row.name !== 'string') fail(`item ${row.id} is missing a name`)
    if (row.sinkPoints !== null && typeof row.sinkPoints !== 'number') {
      fail(`item ${row.id}.sinkPoints must be a number or null`)
    }
    if (typeof row.sinkPoints === 'number' && row.sinkPoints < 0) {
      fail(`item ${row.id}.sinkPoints must not be negative`)
    }
    return {
      id: row.id,
      name: row.name,
      sinkPoints: row.sinkPoints as number | null,
      disposable: row.disposable === undefined ? undefined : Boolean(row.disposable),
      category: typeof row.category === 'string' ? row.category : undefined,
    }
  })

  const known = new Set<ItemId>(items.map((item) => item.id))

  const recipes: Recipe[] = recipeRows.map((entry, index) => {
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string') fail(`recipes[${index}].id must be a string`)
    if (typeof row.name !== 'string') fail(`recipe ${row.id} is missing a name`)
    const inputs = asIngredients(row.inputs ?? [], `recipe ${row.id} inputs`)
    const outputs = asIngredients(row.outputs, `recipe ${row.id} outputs`)
    if (outputs.length === 0) fail(`recipe ${row.id} has no outputs`)
    for (const ingredient of [...inputs, ...outputs]) {
      if (!known.has(ingredient.item)) fail(`recipe ${row.id} references unknown item ${ingredient.item}`)
    }
    return {
      id: row.id,
      name: row.name,
      inputs,
      outputs,
      alternate: row.alternate === true ? true : undefined,
      machine: typeof row.machine === 'string' ? row.machine : undefined,
    }
  })

  return { items, recipes, gameVersion }
}

/** The dataset checked in under `src/data/satisfactory/`. */
export const satisfactoryDataset: Dataset = loadDataset(
  itemsFile,
  recipesFile,
  (itemsFile as { gameVersion?: string }).gameVersion,
)

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Look an item up by id, exact name, or a loose case/space-insensitive match. */
export function findItem(dataset: Dataset, query: string): Item | undefined {
  const target = slug(query)
  return (
    dataset.items.find((item) => item.id === query || item.name === query) ??
    dataset.items.find((item) => slug(item.id) === target || slug(item.name) === target)
  )
}

/**
 * Look a recipe up by id, exact name, or a loose case/space-insensitive match.
 * The loose match also tolerates a missing `Alternate:` prefix, so "Iron Wire"
 * finds "Alternate: Iron Wire" — nobody types the prefix from memory.
 */
export function findRecipe(dataset: Dataset, query: string): Recipe | undefined {
  const target = slug(query)
  const prefixed = `alternate${target}`
  return (
    dataset.recipes.find((recipe) => recipe.id === query || recipe.name === query) ??
    dataset.recipes.find((recipe) => slug(recipe.id) === target || slug(recipe.name) === target) ??
    dataset.recipes.find(
      (recipe) => slug(recipe.id) === prefixed || slug(recipe.name) === prefixed,
    )
  )
}

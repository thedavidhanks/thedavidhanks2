import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { BOLD_CHAR_RATIO, CHAR_RATIO, describeNodes, primaryOutput, truncate } from './diagram-labels.ts'
import { findRecipe, satisfactoryDataset } from './dataset.ts'
import type { Dataset, FlowGraph, FlowNode, FlowNodeKind, ItemId, Recipe } from './types.ts'

const recipeOf = (id: string, name: string, outputs: ItemId[], inputs: ItemId[] = []): Recipe => ({
  id,
  name,
  inputs: inputs.map((item) => ({ item, quantity: 1 })),
  outputs: outputs.map((item) => ({ item, quantity: 1 })),
})

const node = (
  id: string,
  kind: FlowNodeKind,
  name: string,
  extra: Partial<FlowNode> = {},
): FlowNode => ({ id, kind, name, depth: 0, onSinkPath: true, ...extra })

const datasetOf = (items: Record<ItemId, string>, recipes: Recipe[]): Dataset => ({
  items: Object.entries(items).map(([id, name]) => ({ id, name, sinkPoints: null })),
  recipes,
})

// --- Fixtures ----------------------------------------------------------------

/** Item names keyed by id, standing in for a dataset's item table. */
const itemNames = new Map<ItemId, string>([
  ['iron-ingot', 'Iron Ingot'],
  ['heavy-oil-residue', 'Heavy Oil Residue'],
  ['rubber', 'Rubber'],
  ['plastic', 'Plastic'],
  ['polymer-resin', 'Polymer Resin'],
  ['fuel', 'Fuel'],
])

// --- truncate ------------------------------------------------------------

describe('truncate', () => {
  test('returns the text unchanged when it already fits', () => {
    assert.equal(truncate('Iron Ingot', 11.5, 200), 'Iron Ingot')
  })

  test('returns the text unchanged right at the boundary', () => {
    // available / (fontSize * ratio) = 100 / (10 * 0.56) = 17.85 -> max 17.
    const text = 'x'.repeat(17)
    assert.equal(truncate(text, 10, 100), text)
  })

  test('clips one character past the boundary and adds an ellipsis', () => {
    const text = 'x'.repeat(18)
    const clipped = truncate(text, 10, 100)
    assert.equal(clipped, `${'x'.repeat(16)}…`)
    assert.equal(clipped.length, 17)
  })

  test('never returns an empty string, even with no room at all', () => {
    // available = 0 -> max = 0 -> slice(0, max(1, -1)) = slice(0, 1).
    assert.equal(truncate('Iron Ingot', 10, 0), 'I…')
  })

  test('never returns an empty string with a single-character source', () => {
    assert.equal(truncate('X', 100, 0), 'X…')
  })

  test('uses the default CHAR_RATIO when none is given', () => {
    const withDefault = truncate('x'.repeat(50), 10, 100)
    const withExplicitRatio = truncate('x'.repeat(50), 10, 100, CHAR_RATIO)
    assert.equal(withDefault, withExplicitRatio)
  })

  test('a wider ratio (bold text) fits fewer characters in the same space', () => {
    const text = 'x'.repeat(30)
    const regular = truncate(text, 10, 100, CHAR_RATIO)
    const bold = truncate(text, 10, 100, BOLD_CHAR_RATIO)
    assert.ok(bold.length <= regular.length, `bold "${bold}" should not be longer than regular "${regular}"`)
    assert.notEqual(bold, text, 'the fixture should still need clipping at the bold ratio')
  })

  test('a larger font size fits fewer characters in the same pixel width', () => {
    const text = 'x'.repeat(30)
    const small = truncate(text, 8, 100)
    const large = truncate(text, 20, 100)
    assert.ok(large.length <= small.length)
  })

  test('unicode text is still clipped by character count, not byte length', () => {
    const text = 'Iron Ingot ⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️'
    const clipped = truncate(text, 10, 50)
    assert.ok(clipped.endsWith('…'))
    assert.ok(clipped.length < text.length)
  })
})

// --- primaryOutput ---------------------------------------------------------

describe('primaryOutput', () => {
  test('returns undefined for an undefined recipe', () => {
    assert.equal(primaryOutput(undefined, itemNames), undefined)
  })

  test('returns undefined for a recipe with no outputs', () => {
    assert.equal(primaryOutput(recipeOf('nil', 'Nil', []), itemNames), undefined)
  })

  test('returns the sole output of a single-output recipe even when the name does not match it', () => {
    // The real "Residual Fuel" recipe: its only output is Fuel, and nothing
    // named "Residual Fuel" exists to match, so the fallback carries it.
    assert.equal(primaryOutput(recipeOf('residual-fuel', 'Residual Fuel', ['fuel']), itemNames), 'fuel')
  })

  test('picks the output matching the recipe name when it already leads', () => {
    assert.equal(
      primaryOutput(recipeOf('iron-ingot', 'Iron Ingot', ['iron-ingot']), itemNames),
      'iron-ingot',
    )
  })

  test('picks the output matching the recipe name when the byproduct is listed first', () => {
    // The shape the whole function exists for: "Rubber" lists Heavy Oil
    // Residue before Rubber. Taking outputs[0] would mislabel this box.
    assert.equal(
      primaryOutput(recipeOf('rubber', 'Rubber', ['heavy-oil-residue', 'rubber']), itemNames),
      'rubber',
    )
  })

  test('strips the "Alternate: " prefix before matching the byproduct-first case', () => {
    assert.equal(
      primaryOutput(
        recipeOf('alternate-polymer-resin', 'Alternate: Polymer Resin', ['heavy-oil-residue', 'polymer-resin']),
        itemNames,
      ),
      'polymer-resin',
    )
  })

  test('strips the "Alternate: " prefix even when the match already leads', () => {
    assert.equal(
      primaryOutput(recipeOf('alternate-x', 'Alternate: Iron Ingot', ['iron-ingot']), itemNames),
      'iron-ingot',
    )
  })

  test('falls back to the first output when nothing in a multi-output recipe matches', () => {
    // "Unpackage Heavy Oil Residue" is named after neither Empty Canister nor
    // Heavy Oil Residue, so there is nothing to disambiguate with — outputs[0]
    // is genuinely the best guess left.
    assert.equal(
      primaryOutput(recipeOf('unpackage-x', 'Unpackage Heavy Oil Residue', ['empty-canister', 'heavy-oil-residue']), itemNames),
      'empty-canister',
    )
  })

  test('the prefix strip is exact: a name merely starting with "Alternate" but not the full prefix does not match', () => {
    // "Alternate:NoSpace Iron Ingot" does not begin with "Alternate: " (note
    // the space), so it must not be stripped down to "NoSpace Iron Ingot".
    assert.equal(
      primaryOutput(
        recipeOf('x', 'Alternate:NoSpace Iron Ingot', ['iron-ingot', 'heavy-oil-residue']),
        itemNames,
      ),
      'iron-ingot',
      'with nothing matching the unstripped name, the fallback is still outputs[0]',
    )
  })

  test('an item whose name happens to equal another item id is matched by name, not id', () => {
    // Guards against an implementation that compares recipe.name to output.item
    // instead of looking the item name up.
    const names = new Map<ItemId, string>([
      ['a', 'Widget'],
      ['b', 'a'],
    ])
    assert.equal(primaryOutput(recipeOf('r', 'a', ['a', 'b']), names), 'b')
  })
})

describe('primaryOutput against the shipped dataset', () => {
  const names = new Map(satisfactoryDataset.items.map((item) => [item.id, item.name]))

  test('resolves every multi-output recipe to one of its own outputs', () => {
    const multi = satisfactoryDataset.recipes.filter((recipe) => recipe.outputs.length > 1)
    // A regression guard on the fixture itself: if this dataset is regenerated
    // down to zero multi-output recipes, the disambiguation has nothing left
    // to prove and the rest of this block is vacuous.
    assert.ok(multi.length > 10, 'expected the shipped dataset to have multi-output recipes')
    for (const recipe of multi) {
      const primary = primaryOutput(recipe, names)
      assert.ok(
        recipe.outputs.some((output) => output.item === primary),
        `${recipe.name} resolved to ${primary}, which it does not output`,
      )
    }
  })

  test('correctly names every recipe whose byproduct is listed before its namesake output', () => {
    // The eight recipes the docstring calls out by count: each lists a
    // byproduct (Heavy Oil Residue, Compacted Coal, or Dark Matter Residue)
    // ahead of the product the recipe is actually named for.
    const byproductFirstIds = [
      'rubber',
      'plastic',
      'ionized-fuel',
      'rocket-fuel',
      'ficsonium-fuel-rod',
      'neural-quantum-processor',
      'superposition-oscillator',
      'alternate-polymer-resin',
    ]
    assert.equal(byproductFirstIds.length, 8)
    for (const id of byproductFirstIds) {
      const recipe = satisfactoryDataset.recipes.find((entry) => entry.id === id)
      assert.ok(recipe, `fixture recipe id ${id} is missing from the shipped dataset`)
      assert.ok(recipe!.outputs.length > 1, `${id} is expected to be multi-output`)
      const bare = recipe!.name.replace(/^Alternate: /, '')
      // The byproduct really does lead in the raw data - otherwise this case
      // would not exercise the disambiguation at all.
      assert.notEqual(names.get(recipe!.outputs[0].item), bare, `${id} no longer lists its byproduct first`)
      const primary = primaryOutput(recipe, names)
      assert.equal(names.get(primary), bare, `${recipe!.name} should resolve to "${bare}"`)
    }
  })

  test('Rubber and Plastic resolve to different primary items despite sharing a byproduct', () => {
    // Both recipes emit Heavy Oil Residue as a byproduct. A naive outputs[0]
    // implementation would label both boxes "Heavy Oil Residue".
    const rubber = findRecipe(satisfactoryDataset, 'Rubber')
    const plastic = findRecipe(satisfactoryDataset, 'Plastic')
    assert.ok(rubber && plastic)
    const rubberPrimary = names.get(primaryOutput(rubber, names) as string)
    const plasticPrimary = names.get(primaryOutput(plastic, names) as string)
    assert.equal(rubberPrimary, 'Rubber')
    assert.equal(plasticPrimary, 'Plastic')
    assert.notEqual(rubberPrimary, plasticPrimary)
  })

  test('"Residual Fuel" falls back to its sole output, Fuel, having nothing to match', () => {
    const residualFuel = findRecipe(satisfactoryDataset, 'Residual Fuel')
    assert.ok(residualFuel)
    assert.equal(residualFuel!.outputs.length, 1)
    assert.equal(names.get(primaryOutput(residualFuel, names) as string), 'Fuel')
  })
})

// --- describeNodes -----------------------------------------------------------

describe('describeNodes', () => {
  test('labels a non-recipe node with its own name and no sub-label', () => {
    const graph: FlowGraph = {
      nodes: [node('source:iron-ore', 'source', 'Iron Ore'), node('sink', 'sink', 'AWESOME Sink')],
      edges: [],
    }
    const dataset = datasetOf({ 'iron-ore': 'Iron Ore' }, [])
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get('source:iron-ore'), { label: 'Iron Ore', sub: '' })
    assert.deepEqual(labels.get('sink'), { label: 'AWESOME Sink', sub: '' })
  })

  test('drops the sub-label when the recipe name would just repeat the product name', () => {
    const dataset = datasetOf(
      { 'iron-ingot': 'Iron Ingot' },
      [recipeOf('iron-ingot', 'Iron Ingot', ['iron-ingot'])],
    )
    const graph: FlowGraph = {
      nodes: [node('recipe:iron-ingot', 'recipe', 'Iron Ingot', { recipe: 'iron-ingot' })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get('recipe:iron-ingot'), { label: 'Iron Ingot', sub: '' })
  })

  test('keeps the recipe name as a sub-label when it differs from the product it labels the box with', () => {
    const dataset = datasetOf(
      { 'iron-ingot': 'Iron Ingot' },
      [recipeOf('pure-iron-ingot', 'Alternate: Pure Iron Ingot', ['iron-ingot'])],
    )
    const graph: FlowGraph = {
      nodes: [node('recipe:pure-iron-ingot', 'recipe', 'Alternate: Pure Iron Ingot', { recipe: 'pure-iron-ingot' })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get('recipe:pure-iron-ingot'), {
      label: 'Iron Ingot',
      sub: 'Alternate: Pure Iron Ingot',
    })
  })

  test('labels a byproduct-first recipe box with the namesake product, not outputs[0]', () => {
    const dataset = datasetOf(
      { 'heavy-oil-residue': 'Heavy Oil Residue', rubber: 'Rubber' },
      [recipeOf('rubber', 'Rubber', ['heavy-oil-residue', 'rubber'])],
    )
    const graph: FlowGraph = {
      nodes: [node('recipe:rubber', 'recipe', 'Rubber', { recipe: 'rubber' })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get('recipe:rubber'), { label: 'Rubber', sub: '' })
  })

  test('falls back to the node name when the recipe id is missing from the dataset', () => {
    // Defensive case documented on the function: a caller passing a dataset
    // the plan was not solved against should not crash or blank the label.
    const dataset = datasetOf({ 'iron-ingot': 'Iron Ingot' }, [])
    const graph: FlowGraph = {
      nodes: [node('recipe:ghost', 'recipe', 'Some Ghost Recipe', { recipe: 'ghost' })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get('recipe:ghost'), { label: 'Some Ghost Recipe', sub: '' })
  })

  test('falls back to the node name when the recipe has no outputs at all', () => {
    const dataset = datasetOf(
      { 'iron-ingot': 'Iron Ingot' },
      [recipeOf('empty', 'Empty Recipe', [])],
    )
    const graph: FlowGraph = {
      nodes: [node('recipe:empty', 'recipe', 'Empty Recipe', { recipe: 'empty' })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get('recipe:empty'), { label: 'Empty Recipe', sub: '' })
  })

  test('produces one label per node, independent of how many edges connect them', () => {
    const dataset = datasetOf(
      { ore: 'Ore', ingot: 'Ingot' },
      [recipeOf('smelt', 'Smelt', ['ingot'], ['ore'])],
    )
    const graph: FlowGraph = {
      nodes: [
        node('source:ore', 'source', 'Ore'),
        node('recipe:smelt', 'recipe', 'Smelt', { recipe: 'smelt' }),
        node('waste', 'waste', 'Vented / dumped'),
      ],
      edges: [
        { from: 'source:ore', to: 'recipe:smelt', item: 'ore', itemName: 'Ore', quantity: 10, pooled: false },
        { from: 'recipe:smelt', to: 'waste', item: 'ingot', itemName: 'Ingot', quantity: 10, pooled: false },
      ],
    }
    const labels = describeNodes(graph, dataset)
    assert.equal(labels.size, 3)
    assert.deepEqual(labels.get('recipe:smelt'), { label: 'Ingot', sub: 'Smelt' })
    assert.deepEqual(labels.get('waste'), { label: 'Vented / dumped', sub: '' })
  })
})

describe('describeNodes against the shipped dataset', () => {
  test('the ordinary standard recipe for an item drops its own name as a sub-label', () => {
    // "Iron Ingot" the recipe makes "Iron Ingot" the item - the ordinary case
    // the docstring calls out as needing to say the name only once.
    const dataset = satisfactoryDataset
    const recipe = findRecipe(dataset, 'Iron Ingot')
    assert.ok(recipe)
    const graph: FlowGraph = {
      nodes: [node(`recipe:${recipe!.id}`, 'recipe', recipe!.name, { recipe: recipe!.id })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get(`recipe:${recipe!.id}`), { label: 'Iron Ingot', sub: '' })
  })

  test('an alternate recipe keeps its own name as a sub-label under the product it makes', () => {
    const dataset = satisfactoryDataset
    const recipe = findRecipe(dataset, 'Alternate: Pure Iron Ingot')
    assert.ok(recipe, 'expected the shipped dataset to carry Alternate: Pure Iron Ingot')
    const graph: FlowGraph = {
      nodes: [node(`recipe:${recipe!.id}`, 'recipe', recipe!.name, { recipe: recipe!.id })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get(`recipe:${recipe!.id}`), {
      label: 'Iron Ingot',
      sub: 'Alternate: Pure Iron Ingot',
    })
  })

  test('the Rubber recipe box is labelled Rubber, not its Heavy Oil Residue byproduct', () => {
    const dataset = satisfactoryDataset
    const recipe = findRecipe(dataset, 'Rubber')
    assert.ok(recipe)
    const graph: FlowGraph = {
      nodes: [node(`recipe:${recipe!.id}`, 'recipe', recipe!.name, { recipe: recipe!.id })],
      edges: [],
    }
    const labels = describeNodes(graph, dataset)
    assert.deepEqual(labels.get(`recipe:${recipe!.id}`), { label: 'Rubber', sub: '' })
  })
})

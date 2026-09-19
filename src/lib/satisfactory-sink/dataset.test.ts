import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { loadDataset, findItem, findRecipe, satisfactoryDataset } from './dataset.ts'

// --- Fixtures ----------------------------------------------------------------

const validItemsRaw = {
  items: [
    { id: 'ore', name: 'Iron Ore', sinkPoints: 1 },
    { id: 'ingot', name: 'Iron Ingot', sinkPoints: 2 },
    { id: 'exhaust', name: 'Exhaust Fumes', sinkPoints: null },
  ],
}

const validRecipesRaw = {
  recipes: [
    {
      id: 'smelt-iron-ingot',
      name: 'Iron Ingot',
      inputs: [{ item: 'ore', quantity: 1 }],
      outputs: [{ item: 'ingot', quantity: 1 }],
    },
  ],
}

describe('loadDataset - happy path', () => {
  test('builds a Dataset from valid raw JSON', () => {
    const dataset = loadDataset(validItemsRaw, validRecipesRaw, '1.1')
    assert.equal(dataset.items.length, 3)
    assert.equal(dataset.recipes.length, 1)
    assert.equal(dataset.gameVersion, '1.1')
    assert.deepEqual(dataset.recipes[0], {
      id: 'smelt-iron-ingot',
      name: 'Iron Ingot',
      inputs: [{ item: 'ore', quantity: 1 }],
      outputs: [{ item: 'ingot', quantity: 1 }],
      alternate: undefined,
      machine: undefined,
    })
  })

  test('gameVersion is optional and defaults to undefined', () => {
    const dataset = loadDataset(validItemsRaw, validRecipesRaw)
    assert.equal(dataset.gameVersion, undefined)
  })

  test('a recipe with no inputs field defaults to an empty inputs array', () => {
    const rawRecipes = {
      recipes: [{ id: 'mine-ore', name: 'Mine Ore', outputs: [{ item: 'ore', quantity: 1 }] }],
    }
    const dataset = loadDataset(validItemsRaw, rawRecipes)
    assert.deepEqual(dataset.recipes[0].inputs, [])
  })

  test('alternate is only ever true or undefined, never a truthy passthrough', () => {
    const rawRecipes = {
      recipes: [
        {
          id: 'alt-recipe',
          name: 'Alt Recipe',
          alternate: 'yes', // truthy, but not === true
          outputs: [{ item: 'ore', quantity: 1 }],
        },
      ],
    }
    const dataset = loadDataset(validItemsRaw, rawRecipes)
    assert.equal(dataset.recipes[0].alternate, undefined)
  })

  test('machine passes through only when it is a string', () => {
    const rawRecipes = {
      recipes: [
        {
          id: 'smelt',
          name: 'Smelt',
          machine: 'Smelter',
          outputs: [{ item: 'ore', quantity: 1 }],
        },
        {
          id: 'no-machine',
          name: 'No Machine',
          machine: 42,
          outputs: [{ item: 'ore', quantity: 1 }],
        },
      ],
    }
    const dataset = loadDataset(validItemsRaw, rawRecipes)
    assert.equal(dataset.recipes[0].machine, 'Smelter')
    assert.equal(dataset.recipes[1].machine, undefined)
  })

  test('disposable coerces any truthy/falsy value to a boolean, and is undefined when absent', () => {
    const rawItems = {
      items: [
        { id: 'a', name: 'A', sinkPoints: 1, disposable: 'yes' },
        { id: 'b', name: 'B', sinkPoints: 1, disposable: 0 },
        { id: 'c', name: 'C', sinkPoints: 1 },
      ],
    }
    const dataset = loadDataset(rawItems, { recipes: [] })
    assert.equal(dataset.items[0].disposable, true)
    assert.equal(dataset.items[1].disposable, false)
    assert.equal(dataset.items[2].disposable, undefined)
  })
})

describe('loadDataset - top-level shape errors', () => {
  test('rejects an items payload with no `items` array', () => {
    assert.throws(() => loadDataset({}, validRecipesRaw), /items payload must have an `items` array/)
  })

  test('rejects an items payload whose `items` is not an array', () => {
    assert.throws(
      () => loadDataset({ items: 'not-an-array' }, validRecipesRaw),
      /items payload must have an `items` array/,
    )
  })

  test('rejects a recipes payload with no `recipes` array', () => {
    assert.throws(() => loadDataset(validItemsRaw, {}), /recipes payload must have a `recipes` array/)
  })

  test('an empty `items` array is accepted as long as there are no recipes referencing anything', () => {
    const dataset = loadDataset({ items: [] }, { recipes: [] })
    assert.deepEqual(dataset.items, [])
    assert.deepEqual(dataset.recipes, [])
  })

  test('null raw payloads throw a TypeError rather than the dataset-specific error', () => {
    // Property access on null/undefined blows up before the module's own
    // `Array.isArray` guard ever runs - unlike a non-object primitive such as
    // a string or number, which merely reads back an `undefined` property.
    assert.throws(() => loadDataset(null, validRecipesRaw), TypeError)
    assert.throws(() => loadDataset(validItemsRaw, undefined), TypeError)
  })
})

describe('loadDataset - item validation', () => {
  test('rejects an item missing an id', () => {
    const rawItems = { items: [{ name: 'No Id', sinkPoints: 1 }] }
    assert.throws(() => loadDataset(rawItems, { recipes: [] }), /items\[0\]\.id must be a string/)
  })

  test('rejects an item missing a name', () => {
    const rawItems = { items: [{ id: 'foo', sinkPoints: 1 }] }
    assert.throws(() => loadDataset(rawItems, { recipes: [] }), /item foo is missing a name/)
  })

  test('rejects a non-numeric, non-null sinkPoints', () => {
    const rawItems = { items: [{ id: 'foo', name: 'Foo', sinkPoints: '1' }] }
    assert.throws(
      () => loadDataset(rawItems, { recipes: [] }),
      /item foo\.sinkPoints must be a number or null/,
    )
  })

  test('rejects a missing sinkPoints field entirely (undefined is not null)', () => {
    const rawItems = { items: [{ id: 'foo', name: 'Foo' }] }
    assert.throws(
      () => loadDataset(rawItems, { recipes: [] }),
      /item foo\.sinkPoints must be a number or null/,
    )
  })

  test('rejects a negative sinkPoints', () => {
    const rawItems = { items: [{ id: 'foo', name: 'Foo', sinkPoints: -1 }] }
    assert.throws(
      () => loadDataset(rawItems, { recipes: [] }),
      /item foo\.sinkPoints must not be negative/,
    )
  })

  test('accepts a zero sinkPoints (zero is not negative)', () => {
    const rawItems = { items: [{ id: 'foo', name: 'Foo', sinkPoints: 0 }] }
    const dataset = loadDataset(rawItems, { recipes: [] })
    assert.equal(dataset.items[0].sinkPoints, 0)
  })

  test('does not reject duplicate item ids', () => {
    // There is no uniqueness check on item ids: two rows with the same id both
    // survive into `dataset.items`, and only the *last* one wins the internal
    // `known` Set used to validate recipe references. `findItem`/`findRecipe`
    // (Array#find) will silently prefer the *first* of the two instead. This
    // documents the current (permissive) behavior rather than asserting it is
    // desirable.
    const rawItems = {
      items: [
        { id: 'dup', name: 'First Dup', sinkPoints: 1 },
        { id: 'dup', name: 'Second Dup', sinkPoints: 2 },
      ],
    }
    const dataset = loadDataset(rawItems, { recipes: [] })
    assert.equal(dataset.items.length, 2)
    assert.equal(findItem(dataset, 'dup')?.name, 'First Dup')
  })
})

describe('loadDataset - recipe validation', () => {
  test('rejects a recipe missing an id', () => {
    const rawRecipes = { recipes: [{ name: 'No Id', outputs: [{ item: 'ore', quantity: 1 }] }] }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipes\[0\]\.id must be a string/,
    )
  })

  test('rejects a recipe missing a name', () => {
    const rawRecipes = { recipes: [{ id: 'r1', outputs: [{ item: 'ore', quantity: 1 }] }] }
    assert.throws(() => loadDataset(validItemsRaw, rawRecipes), /recipe r1 is missing a name/)
  })

  test('rejects inputs that are not an array', () => {
    const rawRecipes = {
      recipes: [{ id: 'r1', name: 'R1', inputs: 'ore', outputs: [{ item: 'ore', quantity: 1 }] }],
    }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 inputs must be an array/,
    )
  })

  test('rejects a missing outputs field', () => {
    const rawRecipes = { recipes: [{ id: 'r1', name: 'R1' }] }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 outputs must be an array/,
    )
  })

  test('rejects an empty outputs array', () => {
    const rawRecipes = { recipes: [{ id: 'r1', name: 'R1', outputs: [] }] }
    assert.throws(() => loadDataset(validItemsRaw, rawRecipes), /recipe r1 has no outputs/)
  })

  test('rejects an ingredient with a non-string item', () => {
    const rawRecipes = { recipes: [{ id: 'r1', name: 'R1', outputs: [{ item: 42, quantity: 1 }] }] }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 outputs\[0\]\.item must be a string/,
    )
  })

  test('rejects a zero quantity', () => {
    const rawRecipes = {
      recipes: [{ id: 'r1', name: 'R1', outputs: [{ item: 'ore', quantity: 0 }] }],
    }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 outputs\[0\]\.quantity must be a positive number/,
    )
  })

  test('rejects a negative quantity', () => {
    const rawRecipes = {
      recipes: [{ id: 'r1', name: 'R1', outputs: [{ item: 'ore', quantity: -5 }] }],
    }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 outputs\[0\]\.quantity must be a positive number/,
    )
  })

  test('rejects a non-numeric quantity', () => {
    const rawRecipes = {
      recipes: [{ id: 'r1', name: 'R1', outputs: [{ item: 'ore', quantity: '1' }] }],
    }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 outputs\[0\]\.quantity must be a positive number/,
    )
  })

  test('rejects an input referencing an unknown item', () => {
    const rawRecipes = {
      recipes: [
        {
          id: 'r1',
          name: 'R1',
          inputs: [{ item: 'unobtainium', quantity: 1 }],
          outputs: [{ item: 'ore', quantity: 1 }],
        },
      ],
    }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 references unknown item unobtainium/,
    )
  })

  test('rejects an output referencing an unknown item', () => {
    const rawRecipes = {
      recipes: [{ id: 'r1', name: 'R1', outputs: [{ item: 'unobtainium', quantity: 1 }] }],
    }
    assert.throws(
      () => loadDataset(validItemsRaw, rawRecipes),
      /recipe r1 references unknown item unobtainium/,
    )
  })

  test('does not reject duplicate recipe ids', () => {
    // Same permissiveness as duplicate item ids: nothing checks recipe id
    // uniqueness, so both rows survive into `dataset.recipes` and
    // `findRecipe` (Array#find) prefers the first.
    const rawRecipes = {
      recipes: [
        { id: 'dup', name: 'First Dup', outputs: [{ item: 'ore', quantity: 1 }] },
        { id: 'dup', name: 'Second Dup', outputs: [{ item: 'ingot', quantity: 1 }] },
      ],
    }
    const dataset = loadDataset(validItemsRaw, rawRecipes)
    assert.equal(dataset.recipes.length, 2)
    assert.equal(findRecipe(dataset, 'dup')?.name, 'First Dup')
  })
})

describe('findItem', () => {
  const dataset = loadDataset(validItemsRaw, { recipes: [] })

  test('matches by exact id', () => {
    assert.equal(findItem(dataset, 'ore')?.name, 'Iron Ore')
  })

  test('matches by exact name', () => {
    assert.equal(findItem(dataset, 'Iron Ore')?.id, 'ore')
  })

  test('matches case- and space-insensitively via the loose slug match', () => {
    assert.equal(findItem(dataset, 'iron ore')?.id, 'ore')
    assert.equal(findItem(dataset, 'IRONORE')?.id, 'ore')
    assert.equal(findItem(dataset, 'iron-ore')?.id, 'ore')
  })

  test('does not do substring/partial matching', () => {
    assert.equal(findItem(dataset, 'Iron'), undefined)
    assert.equal(findItem(dataset, 'Ingo'), undefined)
  })

  test('returns undefined for a miss', () => {
    assert.equal(findItem(dataset, 'Unobtainium'), undefined)
  })

  test('returns undefined for an empty string query', () => {
    assert.equal(findItem(dataset, ''), undefined)
  })
})

describe('findRecipe (dataset.test.ts complement to cli.test.ts)', () => {
  // cli.test.ts already covers: matching by id/exact-name/loose-name, the
  // missing-"Alternate:"-prefix tolerance, and a plain miss. This file covers
  // the remaining branches: exact id/name beating the loose fallback,
  // non-alternate recipes not getting the "alternate" prefix treatment, and
  // an empty-string query.
  const dataset = loadDataset(validItemsRaw, validRecipesRaw)

  test('matches by exact id', () => {
    assert.equal(findRecipe(dataset, 'smelt-iron-ingot')?.name, 'Iron Ingot')
  })

  test('matches by exact name', () => {
    assert.equal(findRecipe(dataset, 'Iron Ingot')?.id, 'smelt-iron-ingot')
  })

  test('a plain (non-alternate) recipe is not found via the alternate-prefix fallback', () => {
    // "Ingot" alone is neither an exact nor a loose match for "Iron Ingot",
    // and prefixing "alternate" to it does not help since this recipe is not
    // an alternate at all.
    assert.equal(findRecipe(dataset, 'Ingot'), undefined)
  })

  test('returns undefined for an empty string query', () => {
    assert.equal(findRecipe(dataset, ''), undefined)
  })

  test('exact id match wins even when another recipe would loose-match the same query', () => {
    const ambiguous = loadDataset(validItemsRaw, {
      recipes: [
        { id: 'iron ingot', name: 'Something Else', outputs: [{ item: 'ingot', quantity: 1 }] },
        { id: 'other', name: 'Iron Ingot', outputs: [{ item: 'ingot', quantity: 1 }] },
      ],
    })
    // Query exactly equals the first recipe's id, so the id/name exact-match
    // pass must win over the second recipe's exact name match.
    assert.equal(findRecipe(ambiguous, 'iron ingot')?.name, 'Something Else')
  })
})

describe('satisfactoryDataset', () => {
  test('loads successfully at import time and is non-empty', () => {
    assert.ok(satisfactoryDataset.items.length > 0)
    assert.ok(satisfactoryDataset.recipes.length > 0)
  })

  test('carries a gameVersion string', () => {
    assert.equal(typeof satisfactoryDataset.gameVersion, 'string')
    assert.ok(satisfactoryDataset.gameVersion!.length > 0)
  })

  test('every item has a non-empty id and name, and a valid sinkPoints', () => {
    for (const item of satisfactoryDataset.items) {
      assert.ok(item.id.length > 0, `empty id for item ${JSON.stringify(item)}`)
      assert.ok(item.name.length > 0, `empty name for item ${item.id}`)
      assert.ok(
        item.sinkPoints === null || (typeof item.sinkPoints === 'number' && item.sinkPoints >= 0),
        `invalid sinkPoints for item ${item.id}`,
      )
    }
  })

  test('every recipe has at least one output and only references known items', () => {
    const knownIds = new Set(satisfactoryDataset.items.map((item) => item.id))
    for (const recipe of satisfactoryDataset.recipes) {
      assert.ok(recipe.outputs.length > 0, `recipe ${recipe.id} has no outputs`)
      for (const ingredient of [...recipe.inputs, ...recipe.outputs]) {
        assert.ok(
          knownIds.has(ingredient.item),
          `recipe ${recipe.id} references unknown item ${ingredient.item}`,
        )
        assert.ok(
          ingredient.quantity > 0,
          `recipe ${recipe.id} has a non-positive ingredient quantity for ${ingredient.item}`,
        )
      }
    }
  })

  test('item ids are unique in the shipped dataset', () => {
    // loadDataset itself does not enforce this (see the duplicate-id tests
    // above), so this is a property of the checked-in data, not the loader.
    const ids = satisfactoryDataset.items.map((item) => item.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  test('recipe ids are unique in the shipped dataset', () => {
    const ids = satisfactoryDataset.recipes.map((recipe) => recipe.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  test('findItem and findRecipe work against the real dataset', () => {
    assert.equal(findItem(satisfactoryDataset, 'Iron Ore')?.id, 'iron-ore')
    assert.equal(findRecipe(satisfactoryDataset, 'Screws')?.id, 'screws')
  })
})

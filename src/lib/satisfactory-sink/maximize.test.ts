import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { maximizeSinkPoints, formatPlan, resolveMode } from './maximize.ts'
import { satisfactoryDataset } from './dataset.ts'
import { assertFlowBalances } from './flow-assertions.ts'
import type { Dataset, Plan } from './types.ts'

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${expected}, got ${actual} (tolerance ${tolerance})`,
  )

const runsOf = (plan: Plan, recipeId: string) =>
  plan.recipes.find((run) => run.recipe === recipeId)?.runs ?? 0

const sunkOf = (plan: Plan, itemId: string) =>
  plan.sinks.find((entry) => entry.item === itemId)?.quantity ?? 0

/**
 * A plan is only trustworthy if it actually balances: every item produced or
 * supplied must be consumed, sunk, or wasted. This catches solver bugs that a
 * bare objective-value assertion would miss.
 */
function assertConsistent(plan: Plan, dataset: Dataset): void {
  const net = new Map<string, number>()
  const add = (item: string, amount: number) => net.set(item, (net.get(item) ?? 0) + amount)

  for (const source of plan.sources) add(source.item, source.quantity)
  for (const run of plan.recipes) {
    const recipe = dataset.recipes.find((candidate) => candidate.id === run.recipe)
    assert.ok(recipe, `plan references unknown recipe ${run.recipe}`)
    for (const output of recipe.outputs) add(output.item, output.quantity * run.runs)
    for (const input of recipe.inputs) add(input.item, -input.quantity * run.runs)
  }
  for (const entry of plan.sinks) add(entry.item, -entry.quantity)
  for (const entry of plan.wasted) add(entry.item, -entry.quantity)

  for (const [item, balance] of net) {
    assert.ok(Math.abs(balance) < 1e-6, `item ${item} does not balance: net ${balance}`)
  }

  const pointsFromSinks = plan.sinks.reduce((sum, entry) => sum + entry.points, 0)
  near(pointsFromSinks, plan.totalPoints, 1e-6)
  for (const run of plan.recipes) assert.ok(run.runs >= 0, 'recipe runs must be non-negative')

  assertFlowBalances(plan, dataset)
}

// --- Fixtures ---------------------------------------------------------------

/** The worked example from the brief, using its 6 Rod + 12 Screw plate recipe. */
const ironFixture: Dataset = {
  items: [
    { id: 'ore', name: 'Iron Ore', sinkPoints: 1 },
    { id: 'ingot', name: 'Iron Ingot', sinkPoints: 2 },
    { id: 'plate', name: 'Iron Plate', sinkPoints: 6 },
    { id: 'rod', name: 'Iron Rod', sinkPoints: 4 },
    { id: 'screw', name: 'Screw', sinkPoints: 2 },
    { id: 'rip', name: 'Reinforced Iron Plate', sinkPoints: 120 },
  ],
  recipes: [
    { id: 'r-ingot', name: 'Iron Ingot', inputs: [{ item: 'ore', quantity: 1 }], outputs: [{ item: 'ingot', quantity: 1 }] },
    { id: 'r-plate', name: 'Iron Plate', inputs: [{ item: 'ingot', quantity: 3 }], outputs: [{ item: 'plate', quantity: 2 }] },
    { id: 'r-rod', name: 'Iron Rod', inputs: [{ item: 'ingot', quantity: 1 }], outputs: [{ item: 'rod', quantity: 1 }] },
    { id: 'r-screw', name: 'Screw', inputs: [{ item: 'rod', quantity: 1 }], outputs: [{ item: 'screw', quantity: 4 }] },
    {
      id: 'r-rip',
      name: 'Reinforced Iron Plate',
      inputs: [
        { item: 'rod', quantity: 6 },
        { item: 'screw', quantity: 12 },
      ],
      outputs: [{ item: 'rip', quantity: 1 }],
    },
  ],
}

/** Two sources that are only worth combining up to the scarcer one. */
const powderFixture: Dataset = {
  items: [
    { id: 'coal', name: 'Coal', sinkPoints: 3 },
    { id: 'sulfur', name: 'Sulfur', sinkPoints: 11 },
    { id: 'powder', name: 'Black Powder', sinkPoints: 14 },
  ],
  recipes: [
    {
      id: 'r-powder',
      name: 'Black Powder',
      inputs: [
        { item: 'coal', quantity: 1 },
        { item: 'sulfur', quantity: 1 },
      ],
      outputs: [{ item: 'powder', quantity: 2 }],
    },
  ],
}

/**
 * Two products whose chains never touch: a Motor is best sunk raw, and coal is
 * worth 24/unit only as crystals. Because they are independent, "the best mix"
 * is a degenerate question - any coal in a one-unit budget only drags the
 * average below the Motor's 1520 - while "I have one of each" plainly wants
 * both used. The shipped-dataset "motor coal" case in miniature.
 */
const independentFixture: Dataset = {
  items: [
    { id: 'motor', name: 'Motor', sinkPoints: 1520 },
    { id: 'coal', name: 'Coal', sinkPoints: 2 },
    { id: 'crystal', name: 'Time Crystal', sinkPoints: 960 },
  ],
  recipes: [
    {
      id: 'r-crystal',
      name: 'Time Crystal',
      inputs: [{ item: 'coal', quantity: 40 }],
      outputs: [{ item: 'crystal', quantity: 1 }],
    },
  ],
}

/**
 * Two recipes competing for the same scarce input. Recipe B has the better
 * points-per-source-unit ratio in isolation (33.3 vs 25), so a greedy
 * "pick the best chain" algorithm commits to it and scores 424. The optimum
 * ignores B completely and scores 500.
 */
const competingFixture: Dataset = {
  items: [
    { id: 'ore', name: 'Ore', sinkPoints: 1 },
    { id: 'coal', name: 'Coal', sinkPoints: 3 },
    { id: 'x', name: 'Widget X', sinkPoints: 50 },
    { id: 'y', name: 'Widget Y', sinkPoints: 200 },
  ],
  recipes: [
    {
      id: 'r-x',
      name: 'Widget X',
      inputs: [
        { item: 'coal', quantity: 1 },
        { item: 'ore', quantity: 1 },
      ],
      outputs: [{ item: 'x', quantity: 1 }],
    },
    {
      id: 'r-y',
      name: 'Widget Y',
      inputs: [
        { item: 'coal', quantity: 1 },
        { item: 'ore', quantity: 5 },
      ],
      outputs: [{ item: 'y', quantity: 1 }],
    },
  ],
}

// --- Tests ------------------------------------------------------------------

describe('resolveMode', () => {
  test('a single product with no quantity is the only ratio default', () => {
    assert.equal(resolveMode([{ item: 'ore' }]), 'ratio')
    // Naming the same product twice is still one product, so still a ratio.
    assert.equal(resolveMode([{ item: 'ore' }, { item: 'ore' }]), 'ratio')
  })

  test('several products with no quantities mean "plan for all of these"', () => {
    assert.equal(resolveMode([{ item: 'motor' }, { item: 'coal' }]), 'fixed')
    assert.equal(
      resolveMode([{ item: 'iron-ore' }, { item: 'coal' }, { item: 'limestone' }]),
      'fixed',
    )
  })

  test('a partly quantified list is fixed, not a ratio that ignores the numbers', () => {
    assert.equal(resolveMode([{ item: 'iron-ore', quantity: 600 }, { item: 'coal' }]), 'fixed')
    assert.equal(resolveMode([{ item: 'ore', quantity: 1 }]), 'fixed')
  })

  test('an explicit mode always wins', () => {
    assert.equal(resolveMode([{ item: 'motor' }, { item: 'coal' }], 'ratio'), 'ratio')
    assert.equal(resolveMode([{ item: 'ore' }], 'fixed'), 'fixed')
  })
})

describe('maximizeSinkPoints', () => {
  test('independent products named without quantities are all used', () => {
    // Regression: this used to default to ratio mode, spend the whole one-unit
    // budget on the Motor and drop the coal entirely, reporting 1520.
    const plan = maximizeSinkPoints({
      dataset: independentFixture,
      sources: [{ item: 'motor' }, { item: 'coal' }],
    })

    assert.equal(plan.status, 'optimal')
    assert.deepEqual(
      plan.sources.map((source) => source.item).sort(),
      ['coal', 'motor'],
      'both products must appear in the plan',
    )
    assert.deepEqual(plan.declined, [])
    near(plan.totalPoints, 1544) // 1520 raw Motor + 1/40th of a 960-point crystal
    near(sunkOf(plan, 'motor'), 1)
    near(runsOf(plan, 'r-crystal'), 0.025)
    assertConsistent(plan, independentFixture)
  })

  test('a quantity given alongside a bare product is honored, not ignored', () => {
    const plan = maximizeSinkPoints({
      dataset: independentFixture,
      sources: [{ item: 'motor' }, { item: 'coal', quantity: 40 }],
    })

    near(plan.sources.find((source) => source.item === 'coal')?.quantity ?? 0, 40)
    near(plan.totalPoints, 1520 + 960)
    assertConsistent(plan, independentFixture)
  })

  test('ratio mode still declines a product, and now says which', () => {
    const plan = maximizeSinkPoints({
      dataset: independentFixture,
      sources: [{ item: 'motor' }, { item: 'coal' }],
      mode: 'ratio',
    })

    near(plan.pointsPerSourceUnit, 1520)
    assert.equal(plan.sources.length, 1)
    assert.equal(plan.sources[0].item, 'motor')
    assert.deepEqual(plan.declined, [{ item: 'coal', name: 'Coal' }])
    assertConsistent(plan, independentFixture)
  })

  test('fixed mode never declines a product', () => {
    const plan = maximizeSinkPoints({
      dataset: independentFixture,
      sources: [
        { item: 'motor', quantity: 1 },
        { item: 'coal', quantity: 1 },
      ],
    })
    assert.deepEqual(plan.declined, [])
  })


  test('sinks the raw product when no recipe can improve on it', () => {
    const dataset: Dataset = { items: [{ id: 'ore', name: 'Ore', sinkPoints: 7 }], recipes: [] }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'ore', quantity: 10 }] })

    assert.equal(plan.status, 'optimal')
    near(plan.totalPoints, 70)
    near(plan.pointsPerSourceUnit, 7)
    assert.deepEqual(plan.recipes, [])
    near(sunkOf(plan, 'ore'), 10)
    assertConsistent(plan, dataset)
  })

  test('reproduces the worked example: 13.33 points per iron ore', () => {
    const plan = maximizeSinkPoints({ dataset: ironFixture, sources: [{ item: 'ore' }], mode: 'ratio' })

    assert.equal(plan.status, 'optimal')
    near(plan.pointsPerSourceUnit, 120 / 9)
    assertConsistent(plan, ironFixture)
  })

  test('scaleTo renders the ratio plan at a usable size', () => {
    const plan = maximizeSinkPoints({
      dataset: ironFixture,
      sources: [{ item: 'ore' }],
      mode: 'ratio',
      scaleTo: 9,
    })

    near(plan.totalPoints, 120)
    near(plan.sources[0].quantity, 9)
    near(runsOf(plan, 'r-rip'), 1)
    near(runsOf(plan, 'r-ingot'), 9)
    near(runsOf(plan, 'r-rod'), 9) // 6 straight to the plate, 3 turned into 12 screws
    near(runsOf(plan, 'r-screw'), 3)
    near(sunkOf(plan, 'rip'), 1)
    assertConsistent(plan, ironFixture)
  })

  test('beats every single-item chain by combining intermediates', () => {
    const plan = maximizeSinkPoints({ dataset: ironFixture, sources: [{ item: 'ore' }], mode: 'ratio' })
    const chains = [1, 2, 4, 4, 8] // raw ore, ingot, plate, rod, screw -- points per ore
    assert.ok(plan.pointsPerSourceUnit > Math.max(...chains))
  })

  test('ratio mode reports the best source mix, not just the best product', () => {
    const plan = maximizeSinkPoints({
      dataset: powderFixture,
      sources: [{ item: 'coal' }, { item: 'sulfur' }],
      mode: 'ratio',
    })

    near(plan.pointsPerSourceUnit, 14) // 28 points per 1 coal + 1 sulfur
    assert.equal(plan.sources.length, 2)
    for (const source of plan.sources) near(source.share, 0.5)
    assertConsistent(plan, powderFixture)
  })

  test('fixed mode combines what it can and sinks the leftovers raw', () => {
    const plan = maximizeSinkPoints({
      dataset: powderFixture,
      sources: [
        { item: 'coal', quantity: 10 },
        { item: 'sulfur', quantity: 4 },
      ],
    })

    near(runsOf(plan, 'r-powder'), 4) // limited by sulfur
    near(sunkOf(plan, 'powder'), 8)
    near(sunkOf(plan, 'coal'), 6) // the surplus coal still goes to the sink
    near(plan.totalPoints, 8 * 14 + 6 * 3)
    near(plan.pointsPerSourceUnit, 130 / 14)
    assertConsistent(plan, powderFixture)
  })

  test('source weights change which mix is optimal', () => {
    const plan = maximizeSinkPoints({
      dataset: powderFixture,
      sources: [{ item: 'coal' }, { item: 'sulfur', weight: 5 }],
      mode: 'ratio',
    })

    // Budget 1 buys y sulfur and y coal for powder plus (1 - 6y) spare coal.
    // Points = 28y + 3(1 - 6y) = 3 + 10y, maximized at y = 1/6.
    near(plan.pointsPerSourceUnit, 3 + 10 / 6)
    near(plan.sources.find((s) => s.item === 'sulfur')?.quantity ?? 0, 1 / 6)
    assertConsistent(plan, powderFixture)
  })

  test('beats the greedy best-ratio chain when recipes compete for a scarce input', () => {
    const sources = [
      { item: 'ore', quantity: 10 },
      { item: 'coal', quantity: 10 },
    ]
    const plan = maximizeSinkPoints({ dataset: competingFixture, sources })

    // Greedy would run Widget Y (200/6 = 33.3 per unit) and score 424.
    near(plan.totalPoints, 500)
    near(plan.pointsPerSourceUnit, 25)
    near(runsOf(plan, 'r-x'), 10)
    assert.equal(runsOf(plan, 'r-y'), 0)
    assertConsistent(plan, competingFixture)
  })

  test('switches to the higher-ratio recipe once the constraint changes', () => {
    // With ore no longer scarce relative to coal, Widget Y is the right call.
    const plan = maximizeSinkPoints({
      dataset: competingFixture,
      sources: [
        { item: 'ore', quantity: 50 },
        { item: 'coal', quantity: 10 },
      ],
    })

    near(runsOf(plan, 'r-y'), 10)
    near(plan.totalPoints, 2000)
    assertConsistent(plan, competingFixture)
  })

  test('declines a recipe that would destroy value', () => {
    const dataset: Dataset = {
      items: [
        { id: 'ore', name: 'Ore', sinkPoints: 10 },
        { id: 'junk', name: 'Junk', sinkPoints: 1 },
      ],
      recipes: [
        { id: 'r-junk', name: 'Junk', inputs: [{ item: 'ore', quantity: 1 }], outputs: [{ item: 'junk', quantity: 2 }] },
      ],
    }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'ore', quantity: 5 }] })

    near(plan.totalPoints, 50)
    assert.equal(runsOf(plan, 'r-junk'), 0)
  })

  test('handles an unsinkable byproduct by dumping it', () => {
    const dataset: Dataset = {
      items: [
        { id: 'ore', name: 'Ore', sinkPoints: 5 },
        { id: 'widget', name: 'Widget', sinkPoints: 100 },
        { id: 'slag', name: 'Slag', sinkPoints: null },
      ],
      recipes: [
        {
          id: 'r-widget',
          name: 'Widget',
          inputs: [{ item: 'ore', quantity: 2 }],
          outputs: [
            { item: 'widget', quantity: 1 },
            { item: 'slag', quantity: 1 },
          ],
        },
      ],
    }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'ore', quantity: 10 }] })

    near(plan.totalPoints, 500)
    near(plan.wasted.find((entry) => entry.item === 'slag')?.quantity ?? 0, 5)
    assertConsistent(plan, dataset)
  })

  test('avoids a recipe whose byproduct cannot be disposed of', () => {
    const dataset: Dataset = {
      items: [
        { id: 'ore', name: 'Ore', sinkPoints: 5 },
        { id: 'widget', name: 'Widget', sinkPoints: 100 },
        { id: 'sludge', name: 'Sludge', sinkPoints: null, disposable: false },
      ],
      recipes: [
        {
          id: 'r-widget',
          name: 'Widget',
          inputs: [{ item: 'ore', quantity: 2 }],
          outputs: [
            { item: 'widget', quantity: 1 },
            { item: 'sludge', quantity: 1 },
          ],
        },
      ],
    }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'ore', quantity: 10 }] })

    assert.equal(plan.status, 'optimal')
    assert.equal(runsOf(plan, 'r-widget'), 0)
    near(plan.totalPoints, 50)
  })

  test('reports infeasible when a forced input has nowhere to go', () => {
    const dataset: Dataset = {
      items: [{ id: 'water', name: 'Water', sinkPoints: null, disposable: false }],
      recipes: [],
    }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'water', quantity: 100 }] })

    assert.equal(plan.status, 'infeasible')
    assert.match(plan.reason ?? '', /feasible/i)
    // The reason should name the culprit, not make the caller guess.
    assert.match(plan.reason ?? '', /Water/)
  })

  test('reports unbounded when the recipe set makes points out of nothing', () => {
    const dataset: Dataset = {
      items: [
        { id: 'ore', name: 'Ore', sinkPoints: 1 },
        { id: 'gold', name: 'Gold', sinkPoints: 10 },
      ],
      recipes: [{ id: 'r-free', name: 'Free Gold', inputs: [], outputs: [{ item: 'gold', quantity: 1 }] }],
    }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'ore', quantity: 1 }] })

    assert.equal(plan.status, 'unbounded')
    assert.match(plan.reason ?? '', /loop|unlimited/i)
  })

  test('ignores recipes it cannot reach from the given sources', () => {
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'limestone' }],
      mode: 'ratio',
    })

    assert.equal(plan.status, 'optimal')
    // Encased Industrial Beam also needs Steel Beam, which needs iron and coal.
    assert.equal(runsOf(plan, 'encased-industrial-beam'), 0)
    near(plan.pointsPerSourceUnit, 4) // 3 limestone -> 1 concrete at 12 points
    assertConsistent(plan, satisfactoryDataset)
  })

  test('adding a second product never makes the per-unit result worse in ratio mode', () => {
    const ironOnly = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'iron-ore' }],
      mode: 'ratio',
    })
    const withCoal = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'iron-ore' }, { item: 'coal' }],
      mode: 'ratio',
    })

    assert.equal(ironOnly.status, 'optimal')
    assert.equal(withCoal.status, 'optimal')
    assert.ok(withCoal.pointsPerSourceUnit >= ironOnly.pointsPerSourceUnit - 1e-9)
    assertConsistent(withCoal, satisfactoryDataset)
  })

  test('shipped dataset beats raw sinking for every single ore', () => {
    for (const id of ['iron-ore', 'copper-ore', 'limestone', 'coal', 'sulfur']) {
      const item = satisfactoryDataset.items.find((candidate) => candidate.id === id)
      const plan = maximizeSinkPoints({
        dataset: satisfactoryDataset,
        sources: [{ item: id }],
        mode: 'ratio',
      })
      assert.equal(plan.status, 'optimal', `${id} should be solvable`)
      assert.ok(
        plan.pointsPerSourceUnit >= (item?.sinkPoints ?? 0) - 1e-9,
        `${id}: ${plan.pointsPerSourceUnit} should beat raw ${item?.sinkPoints}`,
      )
      assertConsistent(plan, satisfactoryDataset)
    }
  })

  test('the generated dataset is internally consistent', () => {
    const ids = new Set<string>()
    for (const item of satisfactoryDataset.items) {
      assert.ok(!ids.has(item.id), `duplicate item id ${item.id}`)
      ids.add(item.id)
      assert.ok(item.sinkPoints === null || item.sinkPoints > 0, `${item.id} has 0 sink points`)
    }

    const recipeIds = new Set<string>()
    for (const recipe of satisfactoryDataset.recipes) {
      assert.ok(!recipeIds.has(recipe.id), `duplicate recipe id ${recipe.id}`)
      recipeIds.add(recipe.id)
      assert.ok(recipe.outputs.length > 0, `${recipe.id} produces nothing`)
      assert.ok(recipe.machine, `${recipe.id} has no machine`)
      for (const side of [recipe.inputs, recipe.outputs]) {
        for (const ingredient of side) {
          assert.ok(ids.has(ingredient.item), `${recipe.id} references unknown ${ingredient.item}`)
          assert.ok(ingredient.quantity > 0, `${recipe.id} has a non-positive quantity`)
        }
      }
    }

    // A regression guard on the extractor: if the fluid cm3 -> m3 conversion is
    // ever dropped, water shows up as 1000 per craft instead of 1.
    const concrete = satisfactoryDataset.recipes.find((r) => r.id === 'alternate-wet-concrete')
    assert.ok(concrete, 'expected the Wet Concrete alternate recipe')
    near(concrete.inputs.find((i) => i.item === 'water')?.quantity ?? 0, 5)
  })

  test('no source product can be turned into unlimited points', () => {
    // An unbounded result would mean the recipe graph has a loop that creates
    // sinkable material out of nothing -- either a data bug or a game exploit.
    for (const item of satisfactoryDataset.items) {
      const plan = maximizeSinkPoints({
        dataset: satisfactoryDataset,
        sources: [{ item: item.id }],
        mode: 'ratio',
      })
      assert.notEqual(plan.status, 'unbounded', `${item.id} yields unbounded points`)
    }
  })

  test('dropping alternate recipes never helps', () => {
    const base = satisfactoryDataset.recipes.filter((recipe) => !recipe.alternate)
    assert.ok(base.length < satisfactoryDataset.recipes.length, 'expected alternate recipes')

    for (const id of ['iron-ore', 'copper-ore', 'coal']) {
      const withAll = maximizeSinkPoints({
        dataset: satisfactoryDataset,
        sources: [{ item: id }],
        mode: 'ratio',
      })
      const standard = maximizeSinkPoints({
        dataset: { ...satisfactoryDataset, recipes: base },
        sources: [{ item: id }],
        mode: 'ratio',
      })

      assert.equal(standard.status, 'optimal')
      assert.ok(
        withAll.pointsPerSourceUnit >= standard.pointsPerSourceUnit - 1e-9,
        `${id}: alternates should not lower the optimum`,
      )
      assertConsistent(standard, { ...satisfactoryDataset, recipes: base })
    }
  })

  test('rejects malformed problems', () => {
    const dataset: Dataset = { items: [{ id: 'ore', name: 'Ore', sinkPoints: 1 }], recipes: [] }
    assert.throws(() => maximizeSinkPoints({ dataset, sources: [] }), /at least one source/)
    assert.throws(() => maximizeSinkPoints({ dataset, sources: [{ item: 'nope' }] }), /unknown source/)
    assert.throws(
      () => maximizeSinkPoints({ dataset, sources: [{ item: 'ore', quantity: 0 }], mode: 'fixed' }),
      /positive quantity/,
    )
    assert.throws(
      () =>
        maximizeSinkPoints({
          dataset: { items: dataset.items, recipes: [{ id: 'bad', name: 'Bad', inputs: [], outputs: [{ item: 'ghost', quantity: 1 }] }] },
          sources: [{ item: 'ore', quantity: 1 }],
        }),
      /unknown item/,
    )
  })
})

describe('formatPlan', () => {
  test('renders an optimal plan', () => {
    const plan = maximizeSinkPoints({ dataset: ironFixture, sources: [{ item: 'ore' }], mode: 'ratio', scaleTo: 9 })
    const text = formatPlan(plan)

    assert.match(text, /Total sink points : 120/)
    assert.match(text, /Reinforced Iron Plate/)
  })

  test('names the products a ratio declined instead of hiding them', () => {
    const plan = maximizeSinkPoints({
      dataset: independentFixture,
      sources: [{ item: 'motor' }, { item: 'coal' }],
      mode: 'ratio',
    })
    const text = formatPlan(plan)

    assert.match(text, /Not worth feeding/)
    assert.match(text, /Coal/)
  })

  test('renders a failure', () => {
    const dataset: Dataset = {
      items: [{ id: 'water', name: 'Water', sinkPoints: null, disposable: false }],
      recipes: [],
    }
    const plan = maximizeSinkPoints({ dataset, sources: [{ item: 'water', quantity: 1 }] })
    assert.match(formatPlan(plan), /^INFEASIBLE/)
  })
})

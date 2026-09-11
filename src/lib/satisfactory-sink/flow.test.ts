import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { maximizeSinkPoints } from './maximize.ts'
import { satisfactoryDataset } from './dataset.ts'
import { assertFlowBalances } from './flow-assertions.ts'
import { SINK_NODE_ID, WASTE_NODE_ID } from './flow.ts'
import type { Dataset, Plan } from './types.ts'

const edgeBetween = (plan: Plan, from: string, to: string, item?: string) =>
  plan.flow.edges.filter(
    (edge) => edge.from === from && edge.to === to && (item === undefined || edge.item === item),
  )

const nodeOf = (plan: Plan, id: string) => plan.flow.nodes.find((node) => node.id === id)

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${expected}, got ${actual} (tolerance ${tolerance})`,
  )

// --- Fixtures ---------------------------------------------------------------

/** ore -> ingot -> plate -> Sink. One producer and one consumer at every step. */
const chainFixture: Dataset = {
  items: [
    { id: 'ore', name: 'Ore', sinkPoints: 1 },
    { id: 'ingot', name: 'Ingot', sinkPoints: 2 },
    { id: 'plate', name: 'Plate', sinkPoints: 40 },
  ],
  recipes: [
    { id: 'smelt', name: 'Smelt', inputs: [{ item: 'ore', quantity: 1 }], outputs: [{ item: 'ingot', quantity: 1 }] },
    { id: 'press', name: 'Press', inputs: [{ item: 'ingot', quantity: 2 }], outputs: [{ item: 'plate', quantity: 1 }] },
  ],
}

/**
 * Two producers of `mid` and two consumers of it, with the consumers held to
 * fixed sizes by their own scarce second input. The LP fixes the four run
 * counts but says nothing about which producer feeds which consumer — this is
 * the case the proportional split exists for.
 */
const pooledFixture: Dataset = {
  items: [
    { id: 'a', name: 'A', sinkPoints: null },
    { id: 'b', name: 'B', sinkPoints: null },
    { id: 'x', name: 'X', sinkPoints: null },
    { id: 'y', name: 'Y', sinkPoints: null },
    { id: 'mid', name: 'Mid', sinkPoints: null },
    { id: 'out1', name: 'Out One', sinkPoints: 100 },
    { id: 'out2', name: 'Out Two', sinkPoints: 100 },
  ],
  recipes: [
    { id: 'p1', name: 'P1', inputs: [{ item: 'a', quantity: 1 }], outputs: [{ item: 'mid', quantity: 1 }] },
    { id: 'p2', name: 'P2', inputs: [{ item: 'b', quantity: 1 }], outputs: [{ item: 'mid', quantity: 1 }] },
    {
      id: 'c1',
      name: 'C1',
      inputs: [{ item: 'mid', quantity: 1 }, { item: 'x', quantity: 1 }],
      outputs: [{ item: 'out1', quantity: 1 }],
    },
    {
      id: 'c2',
      name: 'C2',
      inputs: [{ item: 'mid', quantity: 1 }, { item: 'y', quantity: 1 }],
      outputs: [{ item: 'out2', quantity: 1 }],
    },
  ],
}

/**
 * A recipe that consumes some of what it makes, as three shipped recipes do.
 * `smelt` is only there to satisfy the solver's forward closure, which enables
 * a recipe only once every input is obtainable; it runs zero times, because
 * Loopy sustains its own ingot input and beats it on ore.
 */
const selfConsumingFixture: Dataset = {
  items: [
    { id: 'ore', name: 'Ore', sinkPoints: 1 },
    { id: 'ingot', name: 'Ingot', sinkPoints: 5 },
  ],
  recipes: [
    { id: 'smelt', name: 'Smelt', inputs: [{ item: 'ore', quantity: 1 }], outputs: [{ item: 'ingot', quantity: 1 }] },
    {
      id: 'loopy',
      name: 'Loopy',
      inputs: [{ item: 'ore', quantity: 2 }, { item: 'ingot', quantity: 1 }],
      outputs: [{ item: 'ingot', quantity: 4 }],
    },
  ],
}

/** Two recipes that consume each other's output, so the flow graph has a cycle. */
const cycleFixture: Dataset = {
  items: [
    { id: 'ore', name: 'Ore', sinkPoints: 1 },
    { id: 'mid', name: 'Mid', sinkPoints: null },
    { id: 'gold', name: 'Gold', sinkPoints: 10 },
  ],
  recipes: [
    { id: 'ra', name: 'RA', inputs: [{ item: 'ore', quantity: 2 }], outputs: [{ item: 'mid', quantity: 1 }] },
    {
      id: 'rb',
      name: 'RB',
      inputs: [{ item: 'mid', quantity: 1 }],
      outputs: [{ item: 'gold', quantity: 1 }, { item: 'ore', quantity: 1 }],
    },
  ],
}

// --- Tests ------------------------------------------------------------------

describe('buildFlowGraph', () => {
  test('draws a straight chain from the source to the Sink', () => {
    const plan = maximizeSinkPoints({
      dataset: chainFixture,
      sources: [{ item: 'ore', quantity: 100 }],
    })
    assertFlowBalances(plan, chainFixture)

    assert.deepEqual(
      plan.flow.nodes.map((node) => node.id).sort(),
      ['recipe:press', 'recipe:smelt', 'sink', 'source:ore'],
    )
    assert.deepEqual(
      plan.flow.edges.map((edge) => `${edge.from} -${edge.quantity} ${edge.item}-> ${edge.to}`),
      [
        'source:ore -100 ore-> recipe:smelt',
        'recipe:smelt -100 ingot-> recipe:press',
        'recipe:press -50 plate-> sink',
      ],
    )
    // Nothing is ambiguous when each item has one producer and one consumer.
    assert.ok(plan.flow.edges.every((edge) => !edge.pooled))
  })

  test('ranks nodes by distance from the source, with the Sink last', () => {
    const plan = maximizeSinkPoints({
      dataset: chainFixture,
      sources: [{ item: 'ore', quantity: 100 }],
    })
    assert.equal(nodeOf(plan, 'source:ore')?.depth, 0)
    assert.equal(nodeOf(plan, 'recipe:smelt')?.depth, 1)
    assert.equal(nodeOf(plan, 'recipe:press')?.depth, 2)
    assert.equal(nodeOf(plan, SINK_NODE_ID)?.depth, 3)
  })

  test('carries the node metadata a diagram needs', () => {
    const plan = maximizeSinkPoints({
      dataset: chainFixture,
      sources: [{ item: 'ore', quantity: 100 }],
    })
    assert.deepEqual(nodeOf(plan, 'source:ore'), {
      id: 'source:ore',
      kind: 'source',
      name: 'Ore',
      item: 'ore',
      quantity: 100,
      depth: 0,
      onSinkPath: true,
    })
    const smelt = nodeOf(plan, 'recipe:smelt')
    assert.equal(smelt?.kind, 'recipe')
    assert.equal(smelt?.recipe, 'smelt')
    assert.equal(smelt?.runs, 100)
    assert.equal(smelt?.name, 'Smelt')
  })

  test('splits a shared pool proportionally and flags the edges', () => {
    const plan = maximizeSinkPoints({
      dataset: pooledFixture,
      sources: [
        { item: 'a', quantity: 100 },
        { item: 'b', quantity: 100 },
        { item: 'x', quantity: 60 },
        { item: 'y', quantity: 140 },
      ],
    })
    assertFlowBalances(plan, pooledFixture)

    // 200 Mid produced 100/100, consumed 60/140: every producer feeds every
    // consumer in proportion, so P1 -> C1 is 100 * 60 / 200.
    const mid = plan.flow.edges.filter((edge) => edge.item === 'mid')
    assert.equal(mid.length, 4)
    assert.ok(mid.every((edge) => edge.pooled), 'a 2x2 pool is ambiguous and must say so')
    near(edgeBetween(plan, 'recipe:p1', 'recipe:c1', 'mid')[0].quantity, 30)
    near(edgeBetween(plan, 'recipe:p1', 'recipe:c2', 'mid')[0].quantity, 70)
    near(edgeBetween(plan, 'recipe:p2', 'recipe:c1', 'mid')[0].quantity, 30)
    near(edgeBetween(plan, 'recipe:p2', 'recipe:c2', 'mid')[0].quantity, 70)

    // The scarce second inputs have one consumer each, so they are unambiguous.
    assert.ok(plan.flow.edges.filter((edge) => edge.item === 'x').every((edge) => !edge.pooled))
  })

  test('nets a recipe that consumes its own output instead of drawing a self-loop', () => {
    const plan = maximizeSinkPoints({
      dataset: selfConsumingFixture,
      sources: [{ item: 'ore', quantity: 100 }],
    })
    assertFlowBalances(plan, selfConsumingFixture)

    // 50 crafts: 100 ore and 50 ingot in, 200 ingot out. The 50 recirculating
    // ingots never leave the machine, so only the net 150 is drawn.
    assert.equal(plan.recipes.find((run) => run.recipe === 'loopy')?.runs, 50)
    assert.equal(edgeBetween(plan, 'recipe:loopy', 'recipe:loopy').length, 0)
    near(edgeBetween(plan, 'recipe:loopy', SINK_NODE_ID, 'ingot')[0].quantity, 150)
  })

  test('terminates on a cyclic plan and keeps both recipes on the sink path', () => {
    const plan = maximizeSinkPoints({
      dataset: cycleFixture,
      sources: [{ item: 'ore', quantity: 100 }],
    })
    assertFlowBalances(plan, cycleFixture)

    // RA makes Mid for RB; RB hands Ore back to RA. A real loop, not a DAG.
    assert.equal(edgeBetween(plan, 'recipe:ra', 'recipe:rb', 'mid').length, 1)
    assert.equal(edgeBetween(plan, 'recipe:rb', 'recipe:ra', 'ore').length, 1)
    assert.ok(plan.flow.nodes.every((node) => node.onSinkPath))
  })

  test('routes an unusable byproduct to the dump node', () => {
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [
        { item: 'raw-quartz', quantity: 300 },
        { item: 'water', quantity: 300 },
      ],
    })
    assertFlowBalances(plan, satisfactoryDataset)

    const dumped = plan.flow.edges.filter((edge) => edge.to === WASTE_NODE_ID)
    assert.ok(dumped.length > 0, 'the surplus water has to go somewhere')
    assert.equal(nodeOf(plan, WASTE_NODE_ID)?.kind, 'waste')
    assert.equal(nodeOf(plan, WASTE_NODE_ID)?.onSinkPath, false)
  })

  test('a non-optimal plan has nothing to draw', () => {
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'power-shard' }],
    })
    assert.equal(plan.status, 'infeasible')
    assert.deepEqual(plan.flow, { nodes: [], edges: [] })
  })
})

describe('the flow graph on the shipped dataset', () => {
  test('reproduces the documented Iron Ore chain', () => {
    const standard = {
      ...satisfactoryDataset,
      recipes: satisfactoryDataset.recipes.filter((recipe) => !recipe.alternate),
    }
    const plan = maximizeSinkPoints({
      dataset: standard,
      sources: [{ item: 'iron-ore' }],
      mode: 'ratio',
      scaleTo: 48,
    })
    assertFlowBalances(plan, standard)

    near(edgeBetween(plan, 'source:iron-ore', 'recipe:iron-ingot', 'iron-ore')[0].quantity, 48)
    // The rods split between screws and rotors without being told to (docs S6).
    near(edgeBetween(plan, 'recipe:iron-rod', 'recipe:screws', 'iron-rod')[0].quantity, 19.0968, 1e-4)
    near(edgeBetween(plan, 'recipe:iron-rod', 'recipe:rotor', 'iron-rod')[0].quantity, 10.3226, 1e-4)
    near(
      edgeBetween(plan, 'recipe:smart-plating', SINK_NODE_ID, 'smart-plating')[0].quantity,
      2.0645,
      1e-4,
    )
  })

  test('every recipe in every single-product plan lies on a source -> sink path', () => {
    // Requirement 4, checked against all 186 shipped items rather than argued.
    for (const item of satisfactoryDataset.items) {
      const plan = maximizeSinkPoints({
        dataset: satisfactoryDataset,
        sources: [{ item: item.id }],
        mode: 'ratio',
      })
      if (plan.status !== 'optimal') continue
      assertFlowBalances(plan, satisfactoryDataset)

      for (const node of plan.flow.nodes) {
        if (node.kind !== 'recipe') continue
        assert.ok(node.onSinkPath, `${item.id}: recipe ${node.name} is not on a path to the Sink`)
      }

      // A source only fails to reach the Sink when the plan earns nothing from
      // it at all -- the 15 fluids that can only be vented. Anything that scores
      // must be connected to the Sink.
      const source = plan.flow.nodes.find((node) => node.kind === 'source')
      if (plan.totalPoints > 0) {
        assert.ok(source?.onSinkPath, `${item.id}: scores points but does not reach the Sink`)
      }
    }
  })

  test('holds up on a large multi-product plan', () => {
    const ores = [
      'iron-ore', 'copper-ore', 'coal', 'limestone', 'caterium-ore', 'raw-quartz',
      'sulfur', 'bauxite', 'crude-oil', 'water', 'nitrogen-gas', 'uranium',
    ]
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: ores.map((item) => ({ item, quantity: 300 })),
    })
    assert.equal(plan.status, 'optimal')
    assertFlowBalances(plan, satisfactoryDataset)

    assert.ok(plan.recipes.length > 20, 'expected a plan big enough to be interesting')
    assert.ok(
      plan.flow.edges.some((edge) => edge.pooled),
      'a plan this size shares pools, and the edges should say so',
    )
    for (const node of plan.flow.nodes) {
      if (node.kind === 'recipe') {
        assert.ok(node.onSinkPath, `recipe ${node.name} is not on a path to the Sink`)
      }
    }
  })
})

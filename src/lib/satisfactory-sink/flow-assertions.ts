/**
 * Shared test assertion for the flow graph.
 *
 * Lives outside `*.test.ts` on purpose: `npm run test:sink` globs that pattern,
 * so a helper named like a test file would either be run as an empty suite or,
 * if imported, run its own tests a second time.
 */
import assert from 'node:assert/strict'

import type { Dataset, Plan } from './types.ts'

/**
 * The graph must be a faithful decomposition of the plan: every node's inflow
 * equals its outflow (sources only emit, the sink and the dump only absorb),
 * and every item's total edge weight matches what the plan says was moved.
 *
 * This is the assertion that catches a wrong proportional split, a dropped
 * self-loop net, or a recipe silently missing from the graph.
 */
export function assertFlowBalances(plan: Plan, dataset: Dataset): void {
  const { nodes, edges } = plan.flow

  if (plan.status !== 'optimal') {
    assert.equal(nodes.length, 0, 'a non-optimal plan has nothing to draw')
    assert.equal(edges.length, 0, 'a non-optimal plan has nothing to draw')
    return
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  assert.equal(byId.size, nodes.length, 'flow node ids must be unique')

  // Requirement: every recipe in the solution is present in the graph.
  for (const run of plan.recipes) {
    const node = byId.get(`recipe:${run.recipe}`)
    assert.ok(node, `recipe ${run.recipe} is missing from the flow graph`)
    assert.equal(node.runs, run.runs, `recipe ${run.recipe} run count disagrees with the plan`)
  }
  assert.equal(
    nodes.filter((node) => node.kind === 'recipe').length,
    plan.recipes.length,
    'the graph has recipe nodes the plan does not run',
  )

  const inflow = new Map<string, number>()
  const outflow = new Map<string, number>()
  const bump = (totals: Map<string, number>, id: string, amount: number) =>
    totals.set(id, (totals.get(id) ?? 0) + amount)

  for (const edge of edges) {
    assert.ok(edge.quantity > 0, `edge ${edge.from} -> ${edge.to} carries nothing`)
    assert.notEqual(edge.from, edge.to, `self-loop on ${edge.from} for ${edge.item}`)
    assert.ok(byId.has(edge.from), `edge from unknown node ${edge.from}`)
    assert.ok(byId.has(edge.to), `edge to unknown node ${edge.to}`)
    bump(outflow, edge.from, edge.quantity)
    bump(inflow, edge.to, edge.quantity)
  }

  for (const node of nodes) {
    if (node.kind === 'source') {
      assert.ok(!inflow.has(node.id), `source ${node.name} should not receive anything`)
      assert.ok(
        Math.abs((outflow.get(node.id) ?? 0) - (node.quantity ?? 0)) < 1e-6,
        `source ${node.name} emits ${outflow.get(node.id)} but supplies ${node.quantity}`,
      )
    }
    if (node.kind === 'sink' || node.kind === 'waste') {
      assert.ok(!outflow.has(node.id), `terminal ${node.name} should not emit anything`)
    }
  }

  // Per item, the graph must move exactly what the plan moved.
  const planned = new Map<string, number>()
  for (const source of plan.sources) bump(planned, source.item, source.quantity)
  const graphed = new Map<string, number>()
  for (const edge of edges) {
    if (byId.get(edge.from)?.kind === 'source') bump(graphed, edge.item, edge.quantity)
  }
  for (const [item, amount] of planned) {
    assert.ok(
      Math.abs((graphed.get(item) ?? 0) - amount) < 1e-6,
      `source item ${item}: graph moves ${graphed.get(item) ?? 0}, plan supplies ${amount}`,
    )
  }

  const intoSink = new Map<string, number>()
  for (const edge of edges) {
    if (byId.get(edge.to)?.kind === 'sink') bump(intoSink, edge.item, edge.quantity)
  }
  for (const entry of plan.sinks) {
    assert.ok(
      Math.abs((intoSink.get(entry.item) ?? 0) - entry.quantity) < 1e-6,
      `sink item ${entry.item}: graph delivers ${intoSink.get(entry.item) ?? 0}, plan sinks ${entry.quantity}`,
    )
  }

  // The assertion that actually pins the proportional split: each recipe node's
  // per-item inflow and outflow must equal what running it that many times
  // consumes and produces, netted. A split that mis-conserves on one side only
  // -- the failure mode if an item's producers and consumers ever disagree --
  // shows up here and nowhere else.
  const recipesById = new Map(dataset.recipes.map((recipe) => [recipe.id, recipe]))
  for (const run of plan.recipes) {
    const recipe = recipesById.get(run.recipe)
    assert.ok(recipe, `plan references unknown recipe ${run.recipe}`)
    const id = `recipe:${run.recipe}`

    const expected = new Map<string, number>()
    for (const output of recipe.outputs) bump(expected, output.item, output.quantity * run.runs)
    for (const input of recipe.inputs) bump(expected, input.item, -input.quantity * run.runs)

    const actual = new Map<string, number>()
    for (const edge of edges) {
      if (edge.from === id) bump(actual, edge.item, edge.quantity)
      if (edge.to === id) bump(actual, edge.item, -edge.quantity)
    }

    for (const item of new Set([...expected.keys(), ...actual.keys()])) {
      assert.ok(
        Math.abs((expected.get(item) ?? 0) - (actual.get(item) ?? 0)) < 1e-6,
        `${run.name}: net ${item} is ${actual.get(item) ?? 0} in the graph, ${expected.get(item) ?? 0} in the plan`,
      )
    }
  }
}

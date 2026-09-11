import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { layoutFlowGraph } from './layout.ts'
import { maximizeSinkPoints } from './maximize.ts'
import { satisfactoryDataset } from './dataset.ts'
import { SINK_NODE_ID } from './flow.ts'
import type { FlowEdge, FlowGraph, FlowNode, FlowNodeKind } from './types.ts'
import type { FlowLayout, LaidOutNode } from './layout.ts'

/** Geometry is exact arithmetic, so this only absorbs float addition. */
const EPS = 1e-9

const node = (
  id: string,
  kind: FlowNodeKind,
  name: string,
  depth: number,
  extra: Partial<FlowNode> = {},
): FlowNode => ({ id, kind, name, depth, onSinkPath: true, ...extra })

const edge = (
  from: string,
  to: string,
  item: string,
  quantity: number,
  extra: Partial<FlowEdge> = {},
): FlowEdge => ({ from, to, item, itemName: item, quantity, pooled: false, ...extra })

const boxOf = (layout: FlowLayout, id: string): LaidOutNode => {
  const box = layout.nodes.find((laid) => laid.id === id)
  assert.ok(box, `no box was laid out for ${id}`)
  return box as LaidOutNode
}

/** Rows of the drawing, keyed by `layer`, in no particular order. */
const rowsOf = (layout: FlowLayout): LaidOutNode[][] => {
  const rows = new Map<number, LaidOutNode[]>()
  for (const box of layout.nodes) {
    const row = rows.get(box.layer)
    if (row) row.push(box)
    else rows.set(box.layer, [box])
  }
  return [...rows.values()]
}

interface Point {
  x: number
  y: number
}

/** [start, control, control, end] — one cubic of a path. */
type Segment = [Point, Point, Point, Point]

/**
 * The cubics of a path, in order: `M x y` followed by one or more `C` triples.
 * An edge that only crosses one gap is still a single cubic, but an edge that
 * threads the channels of the rows in between is a chain of them, so anything
 * that inspects the curve has to walk the whole chain.
 */
const segmentsIn = (path: string): Segment[] => {
  assert.match(path, /^M /, `not a path: "${path}"`)
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const cubics = (path.match(/C/g) ?? []).length
  assert.ok(cubics >= 1, `expected at least one cubic, got "${path}"`)
  assert.equal(numbers.length, 2 + cubics * 6, `malformed path "${path}"`)
  const segments: Segment[] = []
  let start: Point = { x: numbers[0], y: numbers[1] }
  for (let i = 2; i < numbers.length; i += 6) {
    const segment: Segment = [
      start,
      { x: numbers[i], y: numbers[i + 1] },
      { x: numbers[i + 2], y: numbers[i + 3] },
      { x: numbers[i + 4], y: numbers[i + 5] },
    ]
    segments.push(segment)
    start = segment[3]
  }
  return segments
}

/**
 * Every anchor and control point on a path. A cubic is contained by the convex
 * hull of its four points, so checking these bounds the curve itself.
 */
const pointsIn = (path: string): Point[] => segmentsIn(path).flatMap((segment) => segment)

/**
 * The point halfway along a path, by repeated bisection rather than by the
 * layout's own weighted-average shortcut, so this is a real second opinion.
 * On a chain that is the middle of the middle cubic, which is where the layout
 * says it parks the label.
 */
const halfway = (path: string) => {
  const segments = segmentsIn(path)
  const [p0, p1, p2, p3] = segments[Math.floor(segments.length / 2)]
  const half = (a: number, b: number, c: number, d: number) => {
    const [ab, bc, cd] = [(a + b) / 2, (b + c) / 2, (c + d) / 2]
    return ((ab + bc) / 2 + (bc + cd) / 2) / 2
  }
  return { x: half(p0.x, p1.x, p2.x, p3.x), y: half(p0.y, p1.y, p2.y, p3.y) }
}

/** Where a cubic actually is at `t`, evaluated straight from the polynomial. */
const pointAt = ([p0, p1, p2, p3]: Segment, t: number): Point => {
  const u = 1 - t
  const blend = (a: number, b: number, c: number, d: number) =>
    u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
  return { x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) }
}

/**
 * The drawn curve as a dense polyline. "Does this arrow cross that box" is a
 * question about the curve, not about its control points, so it has to be
 * answered by sampling.
 */
const samplePath = (path: string, per = 96): Point[] =>
  segmentsIn(path).flatMap((segment) =>
    Array.from({ length: per + 1 }, (_, i) => pointAt(segment, i / per)),
  )

/** Distance from a point to a line segment; 0 when it sits on it. */
const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * An arrow that stops short of its box, or overshoots into it, reads as broken
 * however pretty the curve is: the endpoint has to sit on the perimeter.
 */
const assertOnPerimeter = (box: LaidOutNode, x: number, y: number, label: string) => {
  assert.ok(
    x >= box.x - EPS && x <= box.x + box.w + EPS && y >= box.y - EPS && y <= box.y + box.h + EPS,
    `${label} (${x}, ${y}) lies outside ${box.id} [${box.x}..${box.x + box.w}, ${box.y}..${box.y + box.h}]`,
  )
  const onSide =
    Math.abs(x - box.x) < EPS ||
    Math.abs(x - (box.x + box.w)) < EPS ||
    Math.abs(y - box.y) < EPS ||
    Math.abs(y - (box.y + box.h)) < EPS
  assert.ok(onSide, `${label} (${x}, ${y}) is buried inside ${box.id} instead of on its edge`)
}

const assertEndpointsAttached = (layout: FlowLayout) => {
  for (const laid of layout.edges) {
    const label = `${laid.from} -> ${laid.to} (${laid.item})`
    assertOnPerimeter(boxOf(layout, laid.from), laid.x1, laid.y1, `${label} start`)
    assertOnPerimeter(boxOf(layout, laid.to), laid.x2, laid.y2, `${label} end`)
    // The path is what actually gets painted; it has to agree with x1/y1/x2/y2.
    const segments = segmentsIn(laid.path)
    const first = segments[0][0]
    const last = segments[segments.length - 1][3]
    assert.deepEqual(first, { x: laid.x1, y: laid.y1 }, `${label} path start`)
    assert.deepEqual(last, { x: laid.x2, y: laid.y2 }, `${label} path end`)
    // A chain has to actually be joined up, or it draws as loose strokes.
    for (let i = 1; i < segments.length; i += 1) {
      assert.deepEqual(segments[i][0], segments[i - 1][3], `${label} segment ${i} does not join`)
    }
  }
}

/** Two boxes in one row may touch, but their x-ranges must not overlap. */
const assertRowsDoNotCollide = (layout: FlowLayout) => {
  for (const row of rowsOf(layout)) {
    for (const box of row) {
      assert.equal(box.y, row[0].y, `${box.id} sits off the baseline of its own row`)
    }
    for (let i = 0; i < row.length; i += 1) {
      for (let j = i + 1; j < row.length; j += 1) {
        const [a, b] = [row[i], row[j]]
        assert.ok(
          a.x + a.w <= b.x + EPS || b.x + b.w <= a.x + EPS,
          `${a.id} [${a.x}, ${a.x + a.w}] overlaps ${b.id} [${b.x}, ${b.x + b.w}] in row ${a.layer}`,
        )
      }
    }
  }
}

const assertBoxesFitCanvas = (layout: FlowLayout) => {
  for (const box of layout.nodes) {
    assert.ok(box.x >= 0 && box.y >= 0, `${box.id} starts off-canvas at (${box.x}, ${box.y})`)
    assert.ok(
      box.x + box.w <= layout.width + EPS && box.y + box.h <= layout.height + EPS,
      `${box.id} spills past the ${layout.width} x ${layout.height} canvas`,
    )
  }
}

/**
 * The reported size has to hold the arrows too, not just the boxes. An edge
 * routed down a channel off the end of a row leans further out than any box
 * does, and an SVG of the reported size would clip it.
 */
const assertPathsFitCanvas = (layout: FlowLayout) => {
  for (const laid of layout.edges) {
    for (const point of samplePath(laid.path)) {
      assert.ok(
        point.x >= -EPS && point.x <= layout.width + EPS,
        `${laid.from} -> ${laid.to} reaches x ${point.x}, outside a ${layout.width}-wide canvas`,
      )
      assert.ok(
        point.y >= -EPS && point.y <= layout.height + EPS,
        `${laid.from} -> ${laid.to} reaches y ${point.y}, outside a ${layout.height}-tall canvas`,
      )
    }
  }
}

/** Grazing a box's outline is fine; anything past this is drawn over it. */
const INSIDE = 1e-6

/**
 * No arrow may be painted across a box it does not connect to.
 *
 * This is the one that matters: a curve drawn over a box that happens to sit
 * under it reads as a connection, and the reader has no way to tell it is not
 * one. The two boxes the edge actually joins are skipped — its anchors sit on
 * their perimeters by design.
 */
const assertPathsAvoidBoxes = (layout: FlowLayout) => {
  const rows = rowsOf(layout)
  for (const laid of layout.edges) {
    const ends = new Set([laid.from, laid.to])
    for (const point of samplePath(laid.path)) {
      for (const row of rows) {
        const [top, bottom] = [row[0].y, row[0].y + row[0].h]
        if (point.y <= top + INSIDE || point.y >= bottom - INSIDE) continue
        for (const box of row) {
          if (ends.has(box.id)) continue
          assert.ok(
            point.x <= box.x + INSIDE || point.x >= box.x + box.w - INSIDE,
            `${laid.from} -> ${laid.to} (${laid.item}) is drawn through ${box.id}: ` +
              `(${point.x.toFixed(1)}, ${point.y.toFixed(1)}) is inside ` +
              `[${box.x}..${box.x + box.w}, ${box.y}..${box.y + box.h}]`,
          )
        }
      }
    }
  }
}

/**
 * A label that has drifted off its own curve is attached to nothing. Measured
 * against the drawn polyline rather than the control points, because that is
 * what the reader sees.
 */
const assertLabelsOnPath = (layout: FlowLayout) => {
  for (const laid of layout.edges) {
    const drawn = samplePath(laid.path, 256)
    let nearest = Infinity
    for (let i = 1; i < drawn.length; i += 1) {
      nearest = Math.min(nearest, distanceToSegment({ x: laid.labelX, y: laid.labelY }, drawn[i - 1], drawn[i]))
    }
    assert.ok(
      nearest < 0.01,
      `${laid.from} -> ${laid.to} label sits ${nearest.toFixed(2)}px off its own curve`,
    )
  }
}

/**
 * Roughly the box FlowDiagram paints a weight label into: one line of 10.5px
 * digits, centred on labelX, at ~0.56em a character. Deliberately the *modest*
 * estimate — an arrow carrying a byproduct gets a second line underneath and
 * this does not model it, because which arrows those are is the renderer's
 * business. Anything this catches is a collision under any reading.
 */
const labelBoxOf = (laid: FlowLayout['edges'][number]) => {
  const digits = Number(laid.quantity.toFixed(4)).toString()
  const width = digits.length * 10.5 * 0.56
  return { x: laid.labelX - width / 2, y: laid.labelY - 6, w: width, h: 12 }
}

/** How far two label boxes overlap, or null when they do not. */
const labelOverlap = (a: ReturnType<typeof labelBoxOf>, b: ReturnType<typeof labelBoxOf>) => {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return x > 0 && y > 0 ? { x, y } : null
}

/**
 * A label overlapping a box is worse than one overlapping a label: FlowDiagram
 * paints the boxes last, so the box wins and the number is silently truncated.
 * A real crude oil plan printed "47.0588" with its leading digit under the Fuel
 * box, leaving "7.0588" on screen — still a plausible rate, and wrong.
 */
const assertLabelsClearBoxes = (layout: FlowLayout) => {
  for (const laid of layout.edges) {
    const rect = labelBoxOf(laid)
    for (const box of layout.nodes) {
      const hit = labelOverlap(rect, { x: box.x, y: box.y, w: box.w, h: box.h })
      assert.ok(
        hit === null,
        `label for ${laid.from} -> ${laid.to} overlaps box ${box.id} by ` +
          `${hit?.x.toFixed(1)} x ${hit?.y.toFixed(1)}px, so the box paints over it`,
      )
    }
  }
}

const assertLabelsDoNotCollide = (layout: FlowLayout) => {
  const boxes = layout.edges.map((laid) => ({ laid, rect: labelBoxOf(laid) }))
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const hit = labelOverlap(boxes[i].rect, boxes[j].rect)
      assert.ok(
        hit === null,
        `labels for ${boxes[i].laid.from} -> ${boxes[i].laid.to} and ` +
          `${boxes[j].laid.from} -> ${boxes[j].laid.to} overlap by ` +
          `${hit?.x.toFixed(1)} x ${hit?.y.toFixed(1)}px`,
      )
    }
  }
}

// --- Fixtures ---------------------------------------------------------------

/** ore -> smelt -> press -> Sink: one box per row, the simplest thing to draw. */
const chainGraph: FlowGraph = {
  nodes: [
    node('source:ore', 'source', 'Ore', 0, { item: 'ore', quantity: 100 }),
    node('recipe:smelt', 'recipe', 'Smelt', 1, { recipe: 'smelt', runs: 100, machine: 'Smelter' }),
    node('recipe:press', 'recipe', 'Press', 2, { recipe: 'press', runs: 50 }),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 3),
  ],
  edges: [
    edge('source:ore', 'recipe:smelt', 'ore', 100),
    edge('recipe:smelt', 'recipe:press', 'ingot', 100),
    edge('recipe:press', SINK_NODE_ID, 'plate', 50),
  ],
}

/**
 * The Alternate: Recycled Plastic / Recycled Rubber pair: each one's output is
 * the other's input, so the graph is genuinely cyclic and no topological order
 * exists. Rubber sits a row below Plastic, so rubber -> plastic points back up.
 */
const recycledGraph: FlowGraph = {
  nodes: [
    node('source:crude-oil', 'source', 'Crude Oil', 0, { item: 'crude-oil', quantity: 300 }),
    node('recipe:recycled-plastic', 'recipe', 'Alternate: Recycled Plastic', 1),
    node('recipe:recycled-rubber', 'recipe', 'Alternate: Recycled Rubber', 2),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 3),
  ],
  edges: [
    edge('source:crude-oil', 'recipe:recycled-plastic', 'fuel', 300),
    edge('recipe:recycled-plastic', 'recipe:recycled-rubber', 'plastic', 120, { pooled: true }),
    // The back edge. Drawn downward it would claim rubber flows forwards.
    edge('recipe:recycled-rubber', 'recipe:recycled-plastic', 'rubber', 90, { pooled: true }),
    edge('recipe:recycled-rubber', SINK_NODE_ID, 'rubber', 30),
  ],
}

/**
 * Two recipes on the deepest row with an edge between them. `depth` saturates
 * like this when a cycle stops the longest-path relaxation from separating the
 * nodes in it — the 12-ore plan has a dozen such edges. There is no vertical
 * room for an arrow between them, so it has to hop through the gap below.
 */
const sameRowGraph: FlowGraph = {
  nodes: [
    node('source:ore', 'source', 'Ore', 0),
    node('recipe:a', 'recipe', 'A', 2),
    node('recipe:b', 'recipe', 'B', 2),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 2),
  ],
  edges: [
    edge('source:ore', 'recipe:a', 'ore', 100),
    edge('recipe:a', 'recipe:b', 'mid', 40),
    edge('recipe:b', SINK_NODE_ID, 'gold', 40),
  ],
}

/**
 * `depth` is a longest-path rank, so a plan can leave gaps in it — here 0, 2, 7
 * with nothing in between. Rows must close up rather than leaving blank bands.
 */
const gappedDepthGraph: FlowGraph = {
  nodes: [
    node('source:ore', 'source', 'Ore', 0),
    node('recipe:mid', 'recipe', 'Mid', 2),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 7),
  ],
  edges: [
    edge('source:ore', 'recipe:mid', 'ore', 10),
    edge('recipe:mid', SINK_NODE_ID, 'plate', 5),
  ],
}

/** Four producers feeding one consumer: the widest row the layout has to space. */
const fanInGraph: FlowGraph = {
  nodes: [
    node('source:a', 'source', 'A', 0),
    node('source:b', 'source', 'B', 0),
    node('source:c', 'source', 'C', 0),
    node('source:d', 'source', 'D', 0),
    node('recipe:mix', 'recipe', 'Mix', 1),
    node('recipe:left', 'recipe', 'Left', 2),
    node('recipe:right', 'recipe', 'Right', 2),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 3),
  ],
  edges: [
    edge('source:a', 'recipe:mix', 'a', 10),
    edge('source:b', 'recipe:mix', 'b', 10),
    edge('source:c', 'recipe:mix', 'c', 10),
    edge('source:d', 'recipe:mix', 'd', 10),
    edge('recipe:mix', 'recipe:left', 'mid', 5, { pooled: true }),
    edge('recipe:mix', 'recipe:right', 'mid', 5, { pooled: true }),
    edge('recipe:left', SINK_NODE_ID, 'out', 5),
    edge('recipe:right', SINK_NODE_ID, 'out', 5),
  ],
}

/**
 * An edge that jumps a row. Ore feeds the three recipes on row 1 *and* Press on
 * row 2, and both terminals are centred over that row, so the straight line
 * from Ore to Press runs down the middle of whatever is sitting there.
 */
const jumpedRowGraph: FlowGraph = {
  nodes: [
    node('source:ore', 'source', 'Ore', 0),
    node('recipe:one', 'recipe', 'One', 1),
    node('recipe:two', 'recipe', 'Two', 1),
    node('recipe:three', 'recipe', 'Three', 1),
    node('recipe:press', 'recipe', 'Press', 2),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 3),
  ],
  edges: [
    edge('source:ore', 'recipe:one', 'ore', 10),
    edge('source:ore', 'recipe:two', 'ore', 20),
    edge('source:ore', 'recipe:three', 'ore', 30),
    // The jump: two rows in one hop, straight over row 1.
    edge('source:ore', 'recipe:press', 'ore', 40),
    edge('recipe:one', 'recipe:press', 'a', 1),
    edge('recipe:two', 'recipe:press', 'b', 2),
    edge('recipe:three', 'recipe:press', 'c', 3),
    edge('recipe:press', SINK_NODE_ID, 'plate', 4),
  ],
}

/**
 * The same jump, upwards. Feedback from row 3 to row 1 has to get past row 2,
 * and a backward edge that tunnels tells the same lie a forward one does.
 */
const longBackEdgeGraph: FlowGraph = {
  nodes: [
    node('source:ore', 'source', 'Ore', 0),
    node('recipe:top', 'recipe', 'Top', 1),
    node('recipe:one', 'recipe', 'One', 2),
    node('recipe:two', 'recipe', 'Two', 2),
    node('recipe:three', 'recipe', 'Three', 2),
    node('recipe:bottom', 'recipe', 'Bottom', 3),
    node(SINK_NODE_ID, 'sink', 'AWESOME Sink', 4),
  ],
  edges: [
    edge('source:ore', 'recipe:top', 'ore', 10),
    edge('recipe:top', 'recipe:one', 'a', 1),
    edge('recipe:top', 'recipe:two', 'b', 2),
    edge('recipe:top', 'recipe:three', 'c', 3),
    edge('recipe:one', 'recipe:bottom', 'd', 1),
    edge('recipe:two', 'recipe:bottom', 'e', 2),
    edge('recipe:three', 'recipe:bottom', 'f', 3),
    // The feedback loop, two rows back up the page.
    edge('recipe:bottom', 'recipe:top', 'recycled', 5, { pooled: true }),
    edge('recipe:bottom', SINK_NODE_ID, 'out', 6),
  ],
}

// --- Tests ------------------------------------------------------------------

describe('layoutFlowGraph', () => {
  test('lays an empty graph out to nothing at all', () => {
    // What a non-optimal plan carries. A caller that renders unconditionally
    // should get a zero-size result, not a padded empty frame.
    assert.deepEqual(layoutFlowGraph({ nodes: [], edges: [] }), {
      width: 0,
      height: 0,
      nodes: [],
      edges: [],
    })
  })

  test('ignores edges when there are no nodes to hang them on', () => {
    const layout = layoutFlowGraph({ nodes: [], edges: [edge('a', 'b', 'x', 1)] })
    assert.deepEqual(layout.edges, [])
    assert.equal(layout.width, 0)
  })

  test('puts every source above the Sink', () => {
    const layout = layoutFlowGraph(chainGraph)
    const sink = boxOf(layout, SINK_NODE_ID)
    const sources = layout.nodes.filter((box) => box.kind === 'source')
    assert.ok(sources.length > 0, 'the fixture is pointless without a source')
    for (const source of sources) {
      assert.ok(source.y < sink.y, `${source.id} is not drawn above the Sink`)
    }
    // Top to bottom in plan order, which is the whole point of the row index.
    assert.deepEqual(
      layout.nodes.slice().sort((a, b) => a.y - b.y).map((box) => box.id),
      ['source:ore', 'recipe:smelt', 'recipe:press', SINK_NODE_ID],
    )
  })

  test('numbers rows contiguously even when depth skips values', () => {
    const layout = layoutFlowGraph(gappedDepthGraph)
    assert.deepEqual(
      layout.nodes.map((box) => [box.id, box.layer]),
      [
        ['source:ore', 0],
        ['recipe:mid', 1],
        [SINK_NODE_ID, 2],
      ],
    )
    // Three rows of boxes, not eight rows with five of them empty.
    assert.equal(layout.height, 12 * 2 + 3 * 48 + 2 * 74)
    assert.equal(boxOf(layout, 'recipe:mid').y - boxOf(layout, 'source:ore').y, 48 + 74)
  })

  test('never overlaps two boxes in the same row', () => {
    for (const graph of [chainGraph, recycledGraph, gappedDepthGraph, fanInGraph]) {
      assertRowsDoNotCollide(layoutFlowGraph(graph))
    }
    // Also with a squeezed configuration, where the gap does the whole job.
    assertRowsDoNotCollide(layoutFlowGraph(fanInGraph, { nodeWidth: 20, nodeGap: 1 }))
  })

  test('gives every box an order matching its position in the row', () => {
    const layout = layoutFlowGraph(fanInGraph)
    for (const row of rowsOf(layout)) {
      const sorted = row.slice().sort((a, b) => a.x - b.x)
      assert.deepEqual(sorted.map((box) => box.order), sorted.map((_, index) => index))
    }
  })

  test('centres a short row against the widest one', () => {
    const layout = layoutFlowGraph(fanInGraph)
    const widest = rowsOf(layout).reduce((max, row) => Math.max(max, row.length), 0)
    assert.equal(widest, 4)
    const mix = boxOf(layout, 'recipe:mix')
    const sources = rowsOf(layout).find((row) => row.length === 4) as LaidOutNode[]
    const left = Math.min(...sources.map((box) => box.x))
    const right = Math.max(...sources.map((box) => box.x + box.w))
    assert.equal(mix.x + mix.w / 2, (left + right) / 2)
  })

  test('fits every box inside the reported canvas', () => {
    for (const graph of [chainGraph, recycledGraph, gappedDepthGraph, fanInGraph]) {
      assertBoxesFitCanvas(layoutFlowGraph(graph))
    }
  })

  test('anchors a forward edge to the bottom of its source and the top of its target', () => {
    const layout = layoutFlowGraph(chainGraph)
    assertEndpointsAttached(layout)

    const smelt = boxOf(layout, 'recipe:smelt')
    const press = boxOf(layout, 'recipe:press')
    const laid = layout.edges.find((e) => e.from === smelt.id && e.to === press.id)
    assert.ok(laid, 'the smelt -> press edge went missing')
    assert.equal(laid?.backward, false)
    assert.equal(laid?.y1, smelt.y + smelt.h, 'a forward edge has to leave the bottom edge')
    assert.equal(laid?.y2, press.y, 'and arrive at the top edge')
  })

  test('fans several arrows out of one box instead of stacking them on a point', () => {
    const layout = layoutFlowGraph(fanInGraph)
    assertEndpointsAttached(layout)

    // Four sources arrive at Mix; four identical anchors would draw as one.
    const mix = boxOf(layout, 'recipe:mix')
    const arriving = layout.edges.filter((laid) => laid.to === mix.id)
    assert.equal(arriving.length, 4)
    assert.equal(new Set(arriving.map((laid) => laid.x2)).size, 4)
    for (const laid of arriving) {
      assert.equal(laid.y2, mix.y)
      assert.ok(laid.x2 > mix.x && laid.x2 < mix.x + mix.w, 'anchors must be inset from the corners')
    }
    // Arrows are ordered by where the other end sits, so they do not cross
    // inside the box they share.
    const byOrigin = arriving
      .slice()
      .sort((a, b) => boxOf(layout, a.from).x - boxOf(layout, b.from).x)
      .map((laid) => laid.x2)
    assert.deepEqual(byOrigin, byOrigin.slice().sort((a, b) => a - b))
  })

  test('terminates on a cyclic graph and draws the back edge pointing back up', () => {
    // Nothing here walks the graph recursively, so a cycle must not hang or
    // throw. If this test ever wedges, that assumption has been broken.
    const layout = layoutFlowGraph(recycledGraph)
    assert.equal(layout.nodes.length, 4)
    assert.equal(layout.edges.length, 4)
    assertRowsDoNotCollide(layout)
    assertEndpointsAttached(layout)

    const back = layout.edges.find(
      (laid) => laid.from === 'recipe:recycled-rubber' && laid.to === 'recipe:recycled-plastic',
    )
    assert.ok(back, 'the rubber -> plastic edge was dropped')
    assert.equal(back?.backward, true)
    assert.ok((back?.path.length ?? 0) > 0, 'a back edge still has to be drawn')

    // It leaves the TOP of the lower box and enters the BOTTOM of the higher
    // one, so the arrow visibly points back up the diagram. Drawn downward it
    // would claim rubber flows the other way.
    const rubber = boxOf(layout, 'recipe:recycled-rubber')
    const plastic = boxOf(layout, 'recipe:recycled-plastic')
    assert.equal(back?.y1, rubber.y)
    assert.equal(back?.y2, plastic.y + plastic.h)
    assert.ok((back?.x1 as number) > rubber.x && (back?.x1 as number) < rubber.x + rubber.w)
    assert.ok((back?.x2 as number) > plastic.x && (back?.x2 as number) < plastic.x + plastic.w)

    // Everything else in the loop still points forwards.
    assert.deepEqual(
      layout.edges.filter((laid) => laid.backward).map((laid) => laid.item),
      ['rubber'],
    )
  })

  test('keeps a back edge inside the gap between the two rows it joins', () => {
    // The whole curve, control points included, has to stay in the empty band
    // between the rows. One that strays into a row is drawn over the boxes
    // sitting in it.
    const layout = layoutFlowGraph(recycledGraph)
    const back = layout.edges.find((laid) => laid.backward) as (typeof layout.edges)[number]
    const plastic = boxOf(layout, 'recipe:recycled-plastic')
    const rubber = boxOf(layout, 'recipe:recycled-rubber')
    for (const point of pointsIn(back.path)) {
      assert.ok(
        point.y >= plastic.y + plastic.h - EPS && point.y <= rubber.y + EPS,
        `back edge strays to y ${point.y}, outside the gap ` +
          `[${plastic.y + plastic.h}..${rubber.y}]`,
      )
    }
  })

  test('hops a same-row edge through the gap below the row, and makes room for it', () => {
    const layout = layoutFlowGraph(sameRowGraph)
    assertEndpointsAttached(layout)
    assertBoxesFitCanvas(layout)

    const hop = layout.edges.find((laid) => laid.from === 'recipe:a' && laid.to === 'recipe:b')
    assert.equal(hop?.backward, true, 'two boxes on one row cannot be a forward edge')

    // Out of one bottom and into the other, dipping below both: the only route
    // that neither overlaps the row nor claims a rank that is not there.
    const a = boxOf(layout, 'recipe:a')
    const b = boxOf(layout, 'recipe:b')
    assert.equal(hop?.y1, a.y + a.h)
    assert.equal(hop?.y2, b.y + b.h)
    const deepest = Math.max(...pointsIn(hop?.path as string).map((point) => point.y))
    assert.ok(deepest > a.y + a.h, 'the hop has to clear the row it starts and ends on')
    assert.ok(deepest <= layout.height, `the dip to ${deepest} is clipped by a ${layout.height} canvas`)
  })

  test('threads an edge that jumps a row through a gap, not over the boxes', () => {
    // The defect this replaces: one near-vertical curve from row 0 to row 2 is
    // painted straight across row 1, and a box that happens to sit at that x
    // reads as being fed by it. The plan says no such thing.
    const layout = layoutFlowGraph(jumpedRowGraph)
    assertEndpointsAttached(layout)
    assertPathsAvoidBoxes(layout)

    const jump = layout.edges.find(
      (laid) => laid.from === 'source:ore' && laid.to === 'recipe:press',
    ) as (typeof layout.edges)[number]
    assert.ok(jump, 'the two-row edge went missing')
    assert.equal(jump.backward, false)

    // It is a chain now, not one cubic: a gap, a channel down row 1, a gap.
    assert.equal(segmentsIn(jump.path).length, 3)

    // Where it crosses row 1 it is in a channel, clear of every box there.
    const middle = layout.nodes.filter((box) => box.layer === 1)
    const crossing = samplePath(jump.path).filter(
      (point) => point.y > middle[0].y && point.y < middle[0].y + middle[0].h,
    )
    assert.ok(crossing.length > 0, 'the edge has to cross row 1 somewhere')
    for (const point of crossing) {
      for (const box of middle) {
        assert.ok(
          point.x <= box.x || point.x >= box.x + box.w,
          `x ${point.x} is over ${box.id} [${box.x}..${box.x + box.w}]`,
        )
      }
    }
    // And it goes down one channel, not weaving between several.
    assert.equal(new Set(crossing.map((point) => point.x.toFixed(6))).size, 1)
  })

  test('threads a backward edge that jumps a row through a gap too', () => {
    const layout = layoutFlowGraph(longBackEdgeGraph)
    assertEndpointsAttached(layout)
    assertPathsAvoidBoxes(layout)

    const back = layout.edges.find(
      (laid) => laid.from === 'recipe:bottom' && laid.to === 'recipe:top',
    ) as (typeof layout.edges)[number]
    assert.equal(back.backward, true)
    assert.equal(segmentsIn(back.path).length, 3)

    // Still out of the top and into the bottom, so it reads as going back up.
    const bottom = boxOf(layout, 'recipe:bottom')
    const top = boxOf(layout, 'recipe:top')
    assert.equal(back.y1, bottom.y)
    assert.equal(back.y2, top.y + top.h)
    // And monotonically upward: a channel that doubled back would read as two
    // arrows rather than one.
    const ys = samplePath(back.path).map((point) => point.y)
    for (let i = 1; i < ys.length; i += 1) assert.ok(ys[i] <= ys[i - 1] + EPS, 'the back edge dips')
  })

  test('leaves an edge that only crosses one gap as a single cubic', () => {
    // Channels are for rows that are in the way. Nothing sits between two
    // adjacent rows, so threading one there would only add a kink.
    for (const graph of [chainGraph, recycledGraph, fanInGraph, sameRowGraph]) {
      for (const laid of layoutFlowGraph(graph).edges) {
        assert.equal(segmentsIn(laid.path).length, 1, `${laid.from} -> ${laid.to} was chained`)
      }
    }
  })

  test('fits every path, not just every box, inside the reported canvas', () => {
    for (const graph of [chainGraph, recycledGraph, gappedDepthGraph, fanInGraph, sameRowGraph, jumpedRowGraph, longBackEdgeGraph]) {
      const layout = layoutFlowGraph(graph)
      assertBoxesFitCanvas(layout)
      assertPathsFitCanvas(layout)
    }
    // A single-box row has no gap between boxes, so a channel through it can
    // only be off one end — the case that pushes past the padding.
    const narrow = layoutFlowGraph(jumpedRowGraph, { nodeWidth: 40, nodeGap: 40, padding: 2 })
    assertBoxesFitCanvas(narrow)
    assertPathsFitCanvas(narrow)
    assertPathsAvoidBoxes(narrow)
  })

  test('keeps every label on the curve it belongs to', () => {
    for (const graph of [chainGraph, recycledGraph, fanInGraph, sameRowGraph, jumpedRowGraph, longBackEdgeGraph]) {
      assertLabelsOnPath(layoutFlowGraph(graph))
    }
  })

  test('parks each weight label halfway along its own curve', () => {
    // A label pinned to the straight-line midpoint drifts off a bulging return
    // loop, so it has to follow the bezier, both ways round.
    for (const graph of [chainGraph, recycledGraph, fanInGraph]) {
      for (const laid of layoutFlowGraph(graph).edges) {
        const expected = halfway(laid.path)
        const label = `${laid.from} -> ${laid.to} label`
        assert.ok(Math.abs(laid.labelX - expected.x) < 1e-9, `${label} x: ${laid.labelX} vs ${expected.x}`)
        assert.ok(Math.abs(laid.labelY - expected.y) < 1e-9, `${label} y: ${laid.labelY} vs ${expected.y}`)
      }
    }
  })

  test('treats an edge inside a single row as a return loop too', () => {
    // Same depth means neither box is downstream of the other on the page, so
    // there is no sane downward curve to draw between them.
    const sameRow: FlowGraph = {
      nodes: [
        node('recipe:one', 'recipe', 'One', 1),
        node('recipe:two', 'recipe', 'Two', 1),
      ],
      edges: [edge('recipe:one', 'recipe:two', 'x', 4)],
    }
    const layout = layoutFlowGraph(sameRow)
    assert.equal(layout.edges[0].backward, true)
    assertEndpointsAttached(layout)
  })

  test('drops edges pointing at nodes that are not in the graph', () => {
    // flow.ts should never emit one, but a dangling id must not crash a render.
    const dangling: FlowGraph = {
      nodes: chainGraph.nodes,
      edges: [
        ...chainGraph.edges,
        edge('recipe:ghost', SINK_NODE_ID, 'ectoplasm', 1),
        edge('source:ore', 'recipe:ghost', 'ore', 1),
      ],
    }
    const layout = layoutFlowGraph(dangling)
    assert.equal(layout.edges.length, 3)
    assert.ok(layout.edges.every((laid) => laid.item !== 'ectoplasm'))
    assertEndpointsAttached(layout)
  })

  test('passes the graph payload through onto the laid-out objects', () => {
    // Layout adds geometry; it must not swallow the data the renderer draws,
    // including `pooled`, which only the renderer knows how to caveat.
    const layout = layoutFlowGraph(chainGraph)
    const smelt = boxOf(layout, 'recipe:smelt')
    assert.equal(smelt.kind, 'recipe')
    assert.equal(smelt.name, 'Smelt')
    assert.equal(smelt.recipe, 'smelt')
    assert.equal(smelt.runs, 100)
    assert.equal(smelt.machine, 'Smelter')
    assert.equal(smelt.depth, 1)
    assert.equal(smelt.onSinkPath, true)

    const pooled = layoutFlowGraph(recycledGraph).edges.filter((laid) => laid.pooled)
    assert.equal(pooled.length, 2)
    for (const laid of pooled) {
      assert.equal(laid.itemName, laid.item)
      assert.ok(laid.quantity > 0)
    }
  })

  test('honours custom sizes rather than the defaults', () => {
    const layout = layoutFlowGraph(chainGraph, {
      nodeWidth: 100,
      nodeHeight: 30,
      layerGap: 20,
      nodeGap: 10,
      padding: 5,
    })
    assert.equal(layout.height, 5 * 2 + 4 * 30 + 3 * 20)
    assert.equal(layout.width, 5 * 2 + 100)
    for (const box of layout.nodes) {
      assert.equal(box.w, 100)
      assert.equal(box.h, 30)
    }
    assertBoxesFitCanvas(layout)
    assertEndpointsAttached(layout)
  })

  test('is stable against the order the nodes arrive in', () => {
    // Rows are seeded alphabetically for exactly this reason: two callers
    // holding the same graph should get the same picture.
    const shuffled: FlowGraph = {
      nodes: [...fanInGraph.nodes].reverse(),
      edges: [...fanInGraph.edges].reverse(),
    }
    const a = layoutFlowGraph(fanInGraph)
    const b = layoutFlowGraph(shuffled)
    const positions = (layout: FlowLayout) =>
      layout.nodes
        .map((box) => `${box.id}@${box.x},${box.y}`)
        .sort()
    assert.deepEqual(positions(b), positions(a))

    // The arrows too, not just the boxes: which channel a long edge takes and
    // which label had to move over are both decided by sorts, and a sort that
    // falls back on the order the edges arrived in would draw two pictures.
    const arrows = (layout: FlowLayout) =>
      layout.edges
        .map((laid) => `${laid.from}->${laid.to} ${laid.path} @${laid.labelX},${laid.labelY}`)
        .sort()
    assert.deepEqual(arrows(b), arrows(a))
  })
})

describe('layoutFlowGraph on a real plan', () => {
  test('draws the shipped Iron Ore plan with sources above the Sink and nothing colliding', () => {
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'iron-ore' }],
      mode: 'ratio',
      scaleTo: 48,
    })
    assert.equal(plan.status, 'optimal')

    const layout = layoutFlowGraph(plan.flow)
    assert.equal(layout.nodes.length, plan.flow.nodes.length)
    assert.equal(layout.edges.length, plan.flow.edges.length)
    assertRowsDoNotCollide(layout)
    assertBoxesFitCanvas(layout)
    assertEndpointsAttached(layout)
    assertPathsAvoidBoxes(layout)
    assertPathsFitCanvas(layout)

    const sink = boxOf(layout, SINK_NODE_ID)
    for (const box of layout.nodes.filter((laid) => laid.kind === 'source')) {
      assert.ok(box.y < sink.y, `${box.id} is not above the Sink`)
    }
    // The Sink is the deepest node, so it owns the bottom row on its own or not.
    assert.equal(sink.layer, Math.max(...layout.nodes.map((box) => box.layer)))
  })

  test('never draws an arrow across a box it does not connect to', () => {
    // Crude oil is the small plan that showed the defect: eleven edges, three
    // of which used to be painted over a box in a row they merely passed. One
    // of them entered the top of a box at the exact x where a genuine edge
    // terminated, which reads as a second producer feeding it.
    const crude = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'crude-oil', quantity: 300 }],
    })
    assert.equal(crude.status, 'optimal')

    for (const options of [{}, { nodeWidth: 220 }]) {
      const layout = layoutFlowGraph(crude.flow, options)
      assertEndpointsAttached(layout)
      assertPathsAvoidBoxes(layout)
      assertPathsFitCanvas(layout)
      assertBoxesFitCanvas(layout)
      assertLabelsOnPath(layout)
    }
  })

  test('keeps the weight labels off each other on a real plan', () => {
    // Every label used to be parked at its own curve's midpoint with nothing
    // watching the others, so the long edges piled theirs into the middle of
    // the drawing on top of whatever was already there.
    const crude = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'crude-oil', quantity: 300 }],
    })
    assert.equal(crude.status, 'optimal')
    assertLabelsDoNotCollide(layoutFlowGraph(crude.flow, { nodeWidth: 220 }))
  })

  test('keeps the weight labels out from under the boxes on a real plan', () => {
    // Caught in a browser, not by any of the above: the boxes are painted after
    // the labels, so an overlap does not look like an overlap, it looks like a
    // shorter number. Same plan and box width the tool page actually uses.
    const crude = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: [{ item: 'crude-oil', quantity: 300 }],
    })
    assert.equal(crude.status, 'optimal')
    assertLabelsClearBoxes(layoutFlowGraph(crude.flow, { nodeWidth: 220 }))
  })

  test('holds its invariants on the twelve-resource plan', () => {
    // The biggest thing the tool can be asked to draw: every raw resource in
    // the dataset at once, cycles and all. Slow layout is a bug here too — the
    // component lays out inside a useMemo on every dataset change.
    const resources = [
      'iron-ore', 'copper-ore', 'coal', 'limestone', 'crude-oil', 'water',
      'caterium-ore', 'raw-quartz', 'sulfur', 'bauxite', 'uranium', 'nitrogen-gas',
    ]
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: resources.map((item) => ({ item, quantity: 300 })),
    })
    assert.equal(plan.status, 'optimal')
    assert.ok(plan.flow.nodes.length > 50, 'expected the plan that stresses the layout')

    const started = performance.now()
    const layout = layoutFlowGraph(plan.flow, { nodeWidth: 220 })
    const elapsed = performance.now() - started
    assert.ok(elapsed < 500, `layout took ${elapsed.toFixed(0)}ms, which is not arithmetic any more`)

    assertRowsDoNotCollide(layout)
    assertBoxesFitCanvas(layout)
    assertEndpointsAttached(layout)
    assertPathsAvoidBoxes(layout)
    assertPathsFitCanvas(layout)
    assertLabelsOnPath(layout)
    assertLabelsClearBoxes(layout)
    assert.ok(
      layout.edges.some((laid) => laid.backward),
      'a plan this size has feedback loops in it; the fixture is wrong if not',
    )
  })

  test('holds its invariants on a large multi-ore plan', () => {
    const ores = ['iron-ore', 'copper-ore', 'coal', 'limestone', 'crude-oil', 'water']
    const plan = maximizeSinkPoints({
      dataset: satisfactoryDataset,
      sources: ores.map((item) => ({ item, quantity: 300 })),
    })
    assert.equal(plan.status, 'optimal')
    assert.ok(plan.flow.nodes.length > 10, 'expected a plan big enough to stress the layout')

    const layout = layoutFlowGraph(plan.flow)
    assertRowsDoNotCollide(layout)
    assertBoxesFitCanvas(layout)
    assertEndpointsAttached(layout)
    assertPathsAvoidBoxes(layout)
    assertPathsFitCanvas(layout)

    // Row indices are dense whatever the plan's depths looked like.
    const layers = [...new Set(layout.nodes.map((box) => box.layer))].sort((a, b) => a - b)
    assert.deepEqual(layers, layers.map((_, index) => index))

    // Direction is decided by the rows, not guessed: a forward edge always
    // crosses into a lower row, a backward one never does.
    for (const laid of layout.edges) {
      const from = boxOf(layout, laid.from)
      const to = boxOf(layout, laid.to)
      assert.equal(laid.backward, to.layer <= from.layer, `${laid.from} -> ${laid.to}`)
    }
  })
})

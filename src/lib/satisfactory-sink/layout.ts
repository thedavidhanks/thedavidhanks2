/**
 * Geometry for drawing a `plan.flow` graph top-to-bottom: sources on the first
 * row, the AWESOME Sink on the last, every recipe the plan runs in between.
 *
 * Pure arithmetic — no React, no DOM, no measuring. Callers get boxes with
 * `x/y/w/h` and edges with an SVG path string, and decide for themselves what
 * to paint into them.
 *
 * Three properties of the input drive most of the decisions here:
 *
 * - **The graph can contain cycles.** Alternate: Recycled Plastic and
 *   Alternate: Recycled Rubber consume each other's output. Nothing below walks
 *   the graph recursively or topologically sorts it; rows come from
 *   `node.depth`, which flow.ts already computed cycle-safely, and the
 *   crossing-reduction sweeps are a fixed number of passes over an array. An
 *   edge that points *back* up the diagram is therefore expected, and is drawn
 *   pointing back up — out of the top of one box and into the bottom of the
 *   other — rather than as a downward arrow that lies about its direction.
 * - **`depth` skips rows, so edges do too.** An edge between adjacent rows has
 *   an empty band to itself, but one that spans several has rows of boxes in
 *   the way, and a curve drawn over a box reads as a connection to it. Long
 *   edges are therefore routed through *channels* — the gaps between the boxes
 *   of each row they cross — so every curve stays inside the gaps rather than
 *   cutting across a row and through whatever boxes happen to sit in it.
 * - **Edges are a decomposition, not observed routing** (see the header of
 *   flow.ts). Layout treats `pooled` as opaque and passes it through; making
 *   that visible is the renderer's job.
 */
import type { FlowEdge, FlowGraph, FlowNode } from './types.ts'

export interface LayoutOptions {
  /** Box width. Uniform: a ragged grid of per-name widths reads worse. */
  nodeWidth?: number
  nodeHeight?: number
  /** Gap between the bottom of one row and the top of the next. */
  layerGap?: number
  /** Gap between boxes within a row. */
  nodeGap?: number
  /** Space left around the whole drawing. */
  padding?: number
  /** Barycenter passes. Two is plenty; this is not Sugiyama. */
  sweeps?: number
}

export interface LaidOutNode extends FlowNode {
  x: number
  y: number
  w: number
  h: number
  /** Row index, 0 at the top. Contiguous, unlike `depth`. */
  layer: number
  /** Position within the row, left to right. */
  order: number
}

export interface LaidOutEdge extends FlowEdge {
  /**
   * SVG path data: one cubic bezier per gap the edge crosses, joined end to
   * end. An edge between adjacent rows is a single cubic; a longer one is a
   * chain that threads a channel through each row in between.
   */
  path: string
  /** Where the arrow leaves the source box. */
  x1: number
  y1: number
  /** Where the arrow meets the target box. */
  x2: number
  y2: number
  /**
   * Where to print the weight label. Always a point *on* `path` — halfway along
   * it, or as near to halfway as it could get without landing on the label of
   * another edge.
   */
  labelX: number
  labelY: number
  /**
   * The edge points at a row at or above its own. Drawn pointing back up (or,
   * within one row, as a hop through the gap below it) rather than downward.
   */
  backward: boolean
}

export interface FlowLayout {
  width: number
  height: number
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
}

const DEFAULTS = {
  nodeWidth: 168,
  nodeHeight: 48,
  layerGap: 74,
  nodeGap: 26,
  padding: 12,
  sweeps: 2,
} as const

/**
 * Where a label may sit along its own path, best first: halfway, then further
 * and further either side of halfway. A label always lands on one of these, so
 * one that had to move is still attached to the curve it belongs to.
 */
const LABEL_SLIDE = [
  0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86, 0.08, 0.92,
] as const

/**
 * Breathing room, in px, between a label and a box it is passing. Labels keep
 * clear of boxes entirely rather than relying on the renderer's halo, which
 * masks a crossing arrow but cannot survive a filled rectangle painted on top.
 */
const LABEL_CLEARANCE = 6

/** One point on a cubic bezier, straight from the polynomial. */
const along = (a: number, c1: number, c2: number, b: number, t: number) => {
  const u = 1 - t
  return u * u * u * a + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b
}

interface Point {
  x: number
  y: number
}

/** One cubic of a path: start, two control points, end. */
type Cubic = [Point, Point, Point, Point]

/**
 * A cubic from `a` to `b` with both control points pulled straight along y.
 *
 * Two things fall out of never moving a control point sideways. The tangent at
 * each end is vertical, so an arrow leaves and arrives square to the box face
 * it touches instead of skewing off it; and the curve's convex hull is no wider
 * than its two endpoints, so a segment sent down a channel cannot bow out of it
 * and back over a box.
 *
 * The pull is capped at the segment's own height. Left uncapped, a squeezed
 * `layerGap` would throw the control points past both ends and bulge the curve
 * out of the band it is supposed to stay inside.
 */
function cubicBetween(a: Point, b: Point): Cubic {
  const span = b.y - a.y
  const pull = Math.min(Math.abs(span), Math.max(18, Math.abs(span) / 2)) * Math.sign(span)
  return [a, { x: a.x, y: a.y + pull }, { x: b.x, y: b.y - pull }, b]
}

/** The waypoints of a route, joined into a chain of cubics. */
const chainThrough = (stops: Point[]): Cubic[] =>
  stops.slice(1).map((stop, index) => cubicBetween(stops[index], stop))

const drawPath = (cubics: Cubic[]): string =>
  `M ${cubics[0][0].x} ${cubics[0][0].y} ` +
  cubics.map(([, c1, c2, end]) => `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`).join(' ')

/**
 * A point `u` of the way along a whole chain, each cubic taking an equal share
 * of `u` regardless of how long it is.
 *
 * Equal shares rather than true arc length because this only has to be
 * *somewhere sensible on the curve*, and arc length would mean integrating a
 * bezier on every edge of an 80-node plan to move a couple of labels. At
 * u = 0.5 it lands in the middle of the middle cubic, which for the ordinary
 * one-cubic edge is the middle of the curve.
 */
function pointOnChain(cubics: Cubic[], u: number): Point {
  const scaled = u * cubics.length
  const index = Math.min(cubics.length - 1, Math.floor(scaled))
  const [a, c1, c2, b] = cubics[index]
  const t = scaled - index
  return { x: along(a.x, c1.x, c2.x, b.x, t), y: along(a.y, c1.y, c2.y, b.y, t) }
}

/**
 * Roughly the room a weight label needs, as a box centred on the label point.
 *
 * Layout has no DOM and no font, so it cannot measure text. What it does have
 * is the number that will be printed, and the renderer prints it at 10.5px in
 * the page's UI stack where a digit advances about 0.56em. The height allows
 * for the second line an arrow carrying a byproduct gets underneath, whether or
 * not this one has it — which way to err is clear, since a label pushed aside
 * unnecessarily costs nothing and one left overlapping is unreadable.
 *
 * An estimate is all this needs to be: it decides which labels are asked to
 * move over, not where anything is drawn.
 */
function labelSize(quantity: number): { w: number; h: number } {
  const printed = Number(quantity.toFixed(4)).toString()
  return { w: Math.max(4, printed.length) * 10.5 * 0.56 + 6, h: 22 }
}

/**
 * Evenly spaced offsets across a box edge, so several arrows leaving one box do
 * not stack into a single point. One edge gets dead centre; n edges get n slots
 * inset from the corners.
 */
function anchorOffsets(count: number, span: number): number[] {
  const usable = Math.min(span, Math.max(span * 0.7, span - 24))
  const start = (span - usable) / 2
  return Array.from({ length: count }, (_, i) => start + (usable * (i + 1)) / (count + 1))
}

/**
 * Order each row to cut crossings: repeatedly re-sort a row by the mean
 * position of its neighbours in the row before it.
 *
 * Neighbours are taken as *undirected* — a backward edge still says these two
 * boxes want to be near each other, and ignoring direction is what keeps this
 * terminating on a cyclic graph.
 */
function reduceCrossings(layers: FlowNode[][], edges: FlowEdge[], sweeps: number): void {
  const layerOf = new Map<string, number>()
  layers.forEach((row, index) => row.forEach((node) => layerOf.set(node.id, index)))

  // neighbours.get(id) -> ids in each adjacent row, both directions.
  const neighbours = new Map<string, string[]>()
  const link = (from: string, to: string) => {
    const list = neighbours.get(from)
    if (list) list.push(to)
    else neighbours.set(from, [to])
  }
  for (const edge of edges) {
    link(edge.from, edge.to)
    link(edge.to, edge.from)
  }

  const positions = new Map<string, number>()
  const reindex = () =>
    layers.forEach((row) => row.forEach((node, index) => positions.set(node.id, index)))
  reindex()

  const sortAgainst = (row: FlowNode[], reference: number) => {
    // A node with no neighbour in the reference row has no opinion, so it keeps
    // the index it already has rather than being flung to one end.
    const keyed = row.map((node, index) => {
      const near = (neighbours.get(node.id) ?? []).filter((id) => layerOf.get(id) === reference)
      if (near.length === 0) return { node, key: index }
      const sum = near.reduce((total, id) => total + (positions.get(id) ?? 0), 0)
      return { node, key: sum / near.length }
    })
    keyed.sort((a, b) => a.key - b.key)
    row.splice(0, row.length, ...keyed.map((entry) => entry.node))
  }

  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    for (let i = 1; i < layers.length; i += 1) sortAgainst(layers[i], i - 1)
    reindex()
    for (let i = layers.length - 2; i >= 0; i -= 1) sortAgainst(layers[i], i + 1)
    reindex()
  }
}

/**
 * Lay a flow graph out as rows of boxes with routed edges between them.
 *
 * An empty graph — which is what a non-optimal plan carries — lays out to
 * nothing at all, so a caller that renders unconditionally gets a zero-size
 * result rather than an empty frame.
 */
export function layoutFlowGraph(graph: FlowGraph, options: LayoutOptions = {}): FlowLayout {
  const { nodeWidth, nodeHeight, layerGap, nodeGap, padding, sweeps } = { ...DEFAULTS, ...options }

  if (graph.nodes.length === 0) return { width: 0, height: 0, nodes: [], edges: [] }

  // --- Rows -----------------------------------------------------------------
  // `depth` is a longest-path rank, so its values can skip numbers (terminals
  // are pushed to the deepest rank whatever path reached them). Map the
  // distinct depths onto contiguous row indices so no blank rows appear.
  const depths = [...new Set(graph.nodes.map((node) => node.depth))].sort((a, b) => a - b)
  const rowOf = new Map<number, number>(depths.map((depth, index) => [depth, index]))
  const layers: FlowNode[][] = depths.map(() => [])
  // Seed each row alphabetically so the result does not depend on node order.
  const seeded = [...graph.nodes].sort((a, b) => a.name.localeCompare(b.name))
  for (const node of seeded) layers[rowOf.get(node.depth) as number].push(node)

  reduceCrossings(layers, graph.edges, sweeps)

  // --- Boxes ----------------------------------------------------------------
  const widest = layers.reduce((max, row) => Math.max(max, row.length), 0)
  const contentWidth = widest * nodeWidth + (widest - 1) * nodeGap
  const placed = new Map<string, LaidOutNode>()
  const nodes: LaidOutNode[] = []
  /** Left edge of each row's first box, which the channels are measured from. */
  const rowLeft: number[] = []

  layers.forEach((row, layer) => {
    const rowWidth = row.length * nodeWidth + (row.length - 1) * nodeGap
    const left = padding + (contentWidth - rowWidth) / 2
    rowLeft.push(left)
    row.forEach((node, order) => {
      const laid: LaidOutNode = {
        ...node,
        x: left + order * (nodeWidth + nodeGap),
        y: padding + layer * (nodeHeight + layerGap),
        w: nodeWidth,
        h: nodeHeight,
        layer,
        order,
      }
      placed.set(node.id, laid)
      nodes.push(laid)
    })
  })

  // --- Edges ----------------------------------------------------------------
  // Which side of a box an arrow uses. The ordinary downward edge leaves a
  // bottom and enters a top. A backward edge is turned upside down instead of
  // being drawn downward, because a downward arrow to a higher row would state
  // the opposite of what the plan does. Every anchor lands on a box edge.
  const routable = graph.edges.filter((edge) => placed.has(edge.from) && placed.has(edge.to))
  const box = (id: string) => placed.get(id) as LaidOutNode
  const centreX = (id: string) => box(id).x + box(id).w / 2
  const backwardEdge = (edge: FlowEdge) => box(edge.to).layer <= box(edge.from).layer
  const sameRow = (edge: FlowEdge) => box(edge.to).layer === box(edge.from).layer
  const exitSide = (edge: FlowEdge) => (backwardEdge(edge) && !sameRow(edge) ? 'top' : 'bottom')
  const entrySide = (edge: FlowEdge) => (backwardEdge(edge) ? 'bottom' : 'top')

  // Anchors are spread along a box's edge in the order the far end sits, so
  // arrows fan out instead of stacking on one point and crossing each other
  // inside the box they share. Exits and entries on the *same* side share one
  // spread, or a box's incoming arrows would land on top of its outgoing ones.
  interface Attachment {
    edge: FlowEdge
    role: 'exit' | 'entry'
    far: string
  }
  const sides = new Map<string, Attachment[]>()
  const attach = (nodeId: string, side: string, attachment: Attachment) => {
    const key = `${nodeId}|${side}`
    const list = sides.get(key)
    if (list) list.push(attachment)
    else sides.set(key, [attachment])
  }
  for (const edge of routable) {
    attach(edge.from, exitSide(edge), { edge, role: 'exit', far: edge.to })
    attach(edge.to, entrySide(edge), { edge, role: 'entry', far: edge.from })
  }

  // flow.ts emits at most one edge per producer/consumer/item, so this names an
  // edge uniquely. It is the tie-break everywhere a sort would otherwise fall
  // back on the order `graph.edges` happened to arrive in, which is not
  // something two callers holding the same plan can be relied on to agree about.
  const nameOf = (edge: FlowEdge) => `${edge.from}|${edge.to}|${edge.item}`
  const byName = (a: FlowEdge, b: FlowEdge) => (nameOf(a) < nameOf(b) ? -1 : nameOf(a) > nameOf(b) ? 1 : 0)

  const slot = new Map<FlowEdge, { exit: number; entry: number }>()
  for (const list of sides.values()) {
    // Two arrows whose far ends sit at the same x — a box with two edges to the
    // same neighbour, or to two boxes each alone on their row — have nothing to
    // choose between them, so they are ordered by name rather than by luck.
    const sorted = [...list].sort(
      (a, b) => centreX(a.far) - centreX(b.far) || byName(a.edge, b.edge),
    )
    const offsets = anchorOffsets(sorted.length, nodeWidth)
    sorted.forEach((attachment, index) => {
      const current = slot.get(attachment.edge) ?? { exit: 0, entry: 0 }
      slot.set(attachment.edge, { ...current, [attachment.role]: offsets[index] })
    })
  }

  // --- Channels -------------------------------------------------------------
  // An edge between adjacent rows has the empty band between them to itself. An
  // edge that spans more than one row does not: drawn as one near-vertical
  // curve it is painted over whatever boxes sit at that x in the rows between,
  // and nothing about the drawing tells a reader that is not a connection.
  //
  // So each row is read as a set of channels — the `nodeGap`-wide lane between
  // each pair of boxes, plus one off either end — and a long edge threads one
  // channel per row it crosses. Rows are packed on a fixed pitch, so channel
  // `i` always starts exactly one gap to the left of where box `i` starts, and
  // a row of n boxes has n + 1 of them.
  const pitch = nodeWidth + nodeGap
  const rowTop = (layer: number) => padding + layer * (nodeHeight + layerGap)
  const channelLeft = (layer: number, channel: number) => rowLeft[layer] + channel * pitch - nodeGap
  /** The channel of `layer` whose centre sits nearest `x`. */
  const nearestChannel = (layer: number, x: number) =>
    Math.max(
      0,
      Math.min(layers[layer].length, Math.round((x - rowLeft[layer] + nodeGap / 2) / pitch)),
    )

  /** The rows an edge has to get past: everything strictly between its ends. */
  const rowsBetween = (from: number, to: number): number[] => {
    if (Math.abs(to - from) < 2) return []
    const step = to > from ? 1 : -1
    const rows: number[] = []
    for (let row = from + step; row !== to; row += step) rows.push(row)
    return rows
  }

  /** Where one long edge crosses one row, and how much it wanted to. */
  interface Crossing {
    row: number
    channel: number
    /** Where a straight line between the anchors would have crossed. */
    ideal: number
    /** Identifies the edge, for a tie-break that does not depend on input order. */
    key: string
    x: number
  }

  interface Route {
    edge: FlowEdge
    backward: boolean
    /** Both ends on one row: no vertical room, so it hops the gap below. */
    hop: boolean
    x1: number
    y1: number
    x2: number
    y2: number
    /** In travel order, so a backward route reads bottom-up like it is drawn. */
    crossings: Crossing[]
  }

  const routes: Route[] = routable.map((edge) => {
    const from = box(edge.from)
    const to = box(edge.to)
    const anchors = slot.get(edge) as { exit: number; entry: number }
    const backward = backwardEdge(edge)
    const hop = sameRow(edge)
    const x1 = from.x + anchors.exit
    const x2 = to.x + anchors.entry
    // Feedback into a higher row — the recycled plastic/rubber case — leaves the
    // top and arrives at the bottom, so it reads as an arrow going back up the
    // diagram, which is what it is. A same-row hop has no top to leave from.
    const y1 = backward && !hop ? from.y : from.y + from.h
    const y2 = backward ? to.y + to.h : to.y

    const crossings = (hop ? [] : rowsBetween(from.layer, to.layer)).map((row) => {
      // Aim at where the straight line between the anchors would have crossed
      // this row, so threading the channels bends the path as little as it can.
      const ideal = x1 + ((x2 - x1) * (rowTop(row) + nodeHeight / 2 - y1)) / (y2 - y1)
      const channel = nearestChannel(row, ideal)
      return { row, channel, ideal, key: nameOf(edge), x: ideal }
    })
    return { edge, backward, hop, x1, y1, x2, y2, crossings }
  })

  // Several long edges can want the same channel. Spread them across its width
  // in the order they approach it from the left, so they run side by side down
  // the gap instead of being painted one on top of another.
  const shared = new Map<string, Crossing[]>()
  for (const route of routes) {
    for (const crossing of route.crossings) {
      const key = `${crossing.row}|${crossing.channel}`
      const list = shared.get(key)
      if (list) list.push(crossing)
      else shared.set(key, [crossing])
    }
  }
  for (const list of shared.values()) {
    const sorted = [...list].sort(
      (a, b) => a.ideal - b.ideal || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )
    const offsets = anchorOffsets(sorted.length, nodeGap)
    sorted.forEach((crossing, index) => {
      crossing.x = channelLeft(crossing.row, crossing.channel) + offsets[index]
    })
  }

  // How far a same-row edge dips into the gap below its row. Enough to clear
  // the boxes and read as a hop, not so far it reaches the next row down.
  const dip = Math.min(30, layerGap / 2)

  const drawn = routes.map((route) => {
    const start = { x: route.x1, y: route.y1 }
    const end = { x: route.x2, y: route.y2 }
    if (route.hop) {
      // Both boxes are on one row, so there is no vertical room: hop out of one
      // bottom, through the gap below the row, and back into the other bottom.
      const bowed: Cubic = [
        start,
        { x: route.x1, y: route.y1 + dip },
        { x: route.x2, y: route.y2 + dip },
        end,
      ]
      return { route, cubics: [bowed] }
    }
    // A stop at each face of every row in the way, both at the same x, so the
    // crossing is a straight run down its channel and all the bending happens
    // in the empty bands between rows.
    const stops: Point[] = [start]
    for (const crossing of route.crossings) {
      const near = route.backward ? rowTop(crossing.row) + nodeHeight : rowTop(crossing.row)
      const far = route.backward ? rowTop(crossing.row) : rowTop(crossing.row) + nodeHeight
      stops.push({ x: crossing.x, y: near }, { x: crossing.x, y: far })
    }
    stops.push(end)
    return { route, cubics: chainThrough(stops) }
  })

  // --- Canvas ---------------------------------------------------------------
  // A cubic never leaves the convex hull of its four points, so the extremes of
  // those bound everything drawn. Two things reach past the boxes: a same-row
  // hop off the last row dips below all of them, and a channel off the end of a
  // row leans further out sideways than any box does.
  let leftmost = padding
  let rightmost = padding + contentWidth
  let deepest = padding + layers.length * nodeHeight + (layers.length - 1) * layerGap
  for (const { cubics } of drawn) {
    for (const cubic of cubics) {
      for (const point of cubic) {
        leftmost = Math.min(leftmost, point.x)
        rightmost = Math.max(rightmost, point.x)
        deepest = Math.max(deepest, point.y)
      }
    }
  }
  // Nudge the whole drawing right rather than clip an excursion off the left.
  const shift = padding - leftmost
  for (const laid of nodes) laid.x += shift

  const move = ([a, c1, c2, b]: Cubic): Cubic => [
    { x: a.x + shift, y: a.y },
    { x: c1.x + shift, y: c1.y },
    { x: c2.x + shift, y: c2.y },
    { x: b.x + shift, y: b.y },
  ]

  // --- Labels ---------------------------------------------------------------
  // A weight label belongs halfway along its own curve, which is where a reader
  // looks for it. Halfway is not always free: every arrow crossing one band
  // puts its midpoint at the same height, so two arrows running close together
  // print their numbers on top of each other and neither can be read.
  //
  // A label that lands on one already placed therefore slides along its own
  // curve until it finds room — along it, never off it, or it would be a number
  // floating next to nothing. Placement runs top to bottom in a fixed order so
  // the same graph always resolves the same way, and a label with nowhere to go
  // stays where it belongs rather than being flung somewhere arbitrary.
  const seats = drawn.map(({ route, cubics }) => {
    const moved = cubics.map(move)
    const home = pointOnChain(moved, 0.5)
    return { route, cubics: moved, home, size: labelSize(route.edge.quantity), at: home }
  })

  // The boxes are obstacles too, and they are the *worst* obstacle: the renderer
  // paints them after the labels, so a number that overlaps one is not merely
  // crowded, it is partly erased — "47.0588" alongside a box came out reading
  // "7.0588", which is a different number and a plausible one. Seeding them into
  // the same collision set as the labels makes a label slide out from under a
  // box exactly the way it slides out from under another label.
  const taken: Array<{ point: Point; size: { w: number; h: number } }> = nodes.map((box) => ({
    point: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
    size: { w: box.w + LABEL_CLEARANCE, h: box.h + LABEL_CLEARANCE },
  }))
  // How much of the drawing this label would sit on top of, in px². Zero means
  // the spot is clear. On a crowded plan some label eventually has nowhere
  // clear to go, and then the least-bad spot beats the first one tried: an
  // overlap of a few px² clips a glyph's edge, where the midpoint of a busy
  // band can bury the number completely.
  const overlapCost = (point: Point, size: { w: number; h: number }) =>
    taken.reduce((sum, other) => {
      const x = (other.size.w + size.w) / 2 - Math.abs(other.point.x - point.x)
      const y = (other.size.h + size.h) / 2 - Math.abs(other.point.y - point.y)
      return x > 0 && y > 0 ? sum + x * y : sum
    }, 0)
  const byPosition = seats
    .map((_, index) => index)
    .sort((a, b) => {
      const [one, two] = [seats[a], seats[b]]
      return (
        one.home.y - two.home.y || one.home.x - two.home.x || byName(one.route.edge, two.route.edge)
      )
    })
  for (const index of byPosition) {
    const seat = seats[index]
    let best = seat.home
    let bestCost = Infinity
    for (const u of LABEL_SLIDE) {
      const candidate = u === 0.5 ? seat.home : pointOnChain(seat.cubics, u)
      const cost = overlapCost(candidate, seat.size)
      // LABEL_SLIDE runs outwards from halfway, so the first spot at a given
      // cost is also the closest to where the label belongs — take it and stop.
      if (cost < bestCost) {
        bestCost = cost
        best = candidate
        if (cost === 0) break
      }
    }
    seat.at = best
    taken.push({ point: seat.at, size: seat.size })
  }

  const edges: LaidOutEdge[] = seats.map((seat) => ({
    ...seat.route.edge,
    path: drawPath(seat.cubics),
    x1: seat.route.x1 + shift,
    y1: seat.route.y1,
    x2: seat.route.x2 + shift,
    y2: seat.route.y2,
    labelX: seat.at.x,
    labelY: seat.at.y,
    backward: seat.route.backward,
  }))

  return {
    width: rightmost + shift + padding,
    height: deepest + padding,
    nodes,
    edges,
  }
}

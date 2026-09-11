import React, { useId, useMemo, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';

import { layoutFlowGraph } from '../../../lib/satisfactory-sink/layout.ts';
import { fmt } from './format.js';
import './flowdiagram.css';

// Every box is an ITEM, not a recipe: "Iron Plate", not "the Iron Plate recipe
// running 12.9 times". A player reads the diagram to find out what moves along
// the belts, and the recipe that made it is the detail underneath.
const ICON_SLOT = 24;   // reserved square at the left of every box; a later
const ICON_GAP = 8;     // iteration drops item images in without re-laying out
const PAD_X = 10;

// Rough advance width per character as a fraction of the font size. SVG cannot
// wrap text and measuring in JS would mean a layout pass per render, so labels
// are clipped to an estimate. Nothing is lost to the clip: every box carries a
// <title> tooltip and the text list below the diagram spells all of it out.
//
// Bold is wider. The box label is 600 weight and the system UI stack the page
// inherits runs ~0.58-0.60 there, so it gets its own ratio — sharing 0.56 let
// the longest labels overrun the box by ~11px into the gutter.
const CHAR_RATIO = 0.56;
const BOLD_CHAR_RATIO = 0.6;

const truncate = (text, fontSize, available, ratio = CHAR_RATIO) => {
    const max = Math.floor(available / (fontSize * ratio));
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(1, max - 1))}…`;
};

// All chosen against a white card: the text colours clear 4.5:1 (WCAG 1.4.3)
// and the strokes clear 3:1 (1.4.11, non-text contrast). Fills stay pale so the
// dark label keeps its own contrast against them.
const KIND_STYLE = {
    source: { fill: '#e7f1ff', stroke: '#0a58ca', label: '#0a3678' },
    recipe: { fill: '#ffffff', stroke: '#6c757d', label: '#212529' },
    sink: { fill: '#d1e7dd', stroke: '#146c43', label: '#0a3622' },
    waste: { fill: '#f8d7da', stroke: '#b02a37', label: '#58151c' },
};
// The faded treatment still has to be *visible*: #adb5bd reads nicely as
// "dimmed" but is 2.07:1 against the card, under the 3:1 WCAG 1.4.11 wants for
// a boundary that carries meaning. #7b8288 is 3.9:1 and still plainly lighter
// than every other stroke here.
const OFF_PATH = { fill: '#f8f9fa', stroke: '#7b8288', label: '#495057' };

const EDGE_COLOR = '#495057';        // 8.2:1 on white
const POOLED_COLOR = '#6f42c1';      // 6.5:1 on white, and dashed as well as
const POOLED_DASH = '6 4';           // coloured — colour is never the only cue

const ALTERNATE_PREFIX = 'Alternate: ';

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
function primaryOutput(recipe, items) {
    const outputs = recipe?.outputs ?? [];
    if (outputs.length === 0) return undefined;
    const bare = recipe.name.startsWith(ALTERNATE_PREFIX)
        ? recipe.name.slice(ALTERNATE_PREFIX.length)
        : recipe.name;
    const named = outputs.find((output) => items.get(output.item) === bare);
    return (named ?? outputs[0]).item;
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
function describeNodes(graph, dataset) {
    const items = new Map(dataset.items.map((item) => [item.id, item.name]));
    const recipes = new Map(dataset.recipes.map((recipe) => [recipe.id, recipe]));

    return new Map(graph.nodes.map((node) => {
        if (node.kind !== 'recipe') return [node.id, { label: node.name, sub: '' }];

        const recipe = recipes.get(node.recipe);
        const output = primaryOutput(recipe, items);
        // Falling back to the recipe name keeps the box labelled if a caller
        // ever passes a dataset the plan was not solved against.
        const label = (output && items.get(output)) || node.name;
        return [node.id, { label, sub: node.name === label ? '' : node.name }];
    }));
}

/**
 * The drawing itself, and nothing else.
 *
 * Its own `useId` rather than one passed down: the inline diagram and the
 * expanded one are both mounted while the modal is open, and the marker and
 * title ids have to stay unique across the two. Sharing an id would point every
 * arrowhead in both copies at whichever <marker> the browser saw last.
 */
const FlowCanvas = ({ layout, labels, hasSink, onActivate }) => {
    const markerId = useId();
    const arrow = `${markerId}-arrow`;
    const pooledArrow = `${markerId}-arrow-pooled`;

    return (
        <svg
            role="img"
            // Clicking the drawing expands it. The handler sits on the <svg>
            // and not on the scroll box around it so that dragging the
            // scrollbar, or clicking the strip of container beside a narrow
            // diagram, does not count as clicking the diagram.
            //
            // Mouse-only, deliberately: the container is already a tab stop
            // that scrolls with the arrow keys, and hanging Enter off it would
            // mean a keyboard user could no longer scroll it without being
            // thrown into the modal. The button by the heading is the
            // keyboard route to the same thing, so no function is
            // keyboard-inaccessible (WCAG 2.1.1).
            onClick={onActivate}
            // Not both ids in aria-labelledby: that concatenates title
            // and desc into one ~60-word accessible *name* and leaves
            // the description empty, so there is no short name to hear
            // before deciding whether to read on.
            aria-labelledby={`${markerId}-title`}
            aria-describedby={`${markerId}-desc`}
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            // Auto margins rather than centring the scroll container's
            // contents with flexbox: a flex-centred child that overflows its
            // container cannot be scrolled back to on the leading side in
            // every engine, whereas auto margins on a too-wide block simply
            // resolve to zero. So a small plan sits in the middle of the
            // expanded view and a large one still scrolls from its left edge.
            style={{
                display: 'block',
                margin: '0 auto',
                cursor: onActivate ? 'zoom-in' : undefined,
            }}
        >
            {/* One template string, not a mix of text and expressions:
                React only accepts a single child in <title>. */}
            <title id={`${markerId}-title`}>
                {`Flow diagram of the plan: ${layout.nodes.length} boxes, `
                    + (hasSink
                        ? 'from the source products at the top to the AWESOME Sink '
                            + 'at the bottom.'
                        : 'none of which reach the AWESOME Sink.')}
            </title>
            <desc id={`${markerId}-desc`}>
                A drawing of the same plan the tables on this page describe. The
                belt quantities between boxes are not in those tables, so every
                connection is also written out as a list immediately after the
                diagram.
            </desc>

            {/* Windows High Contrast forces CSS background-color but not
                SVG fill, so the container's `bg-white` would flip to black
                while these hard-coded dark inks and the white label halo
                stayed put. An explicit backing rect gives the drawing its
                own white island that forced-colors leaves alone. */}
            <rect width="100%" height="100%" fill="#ffffff" />

            <defs>
                <marker
                    id={arrow}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR} />
                </marker>
                <marker
                    id={pooledArrow}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={POOLED_COLOR} />
                </marker>
            </defs>

            <g fill="none" strokeLinecap="round">
                {layout.edges.map((edge, index) => (
                    <path
                        key={`${edge.from}-${edge.to}-${edge.item}-${index}`}
                        d={edge.path}
                        stroke={edge.pooled ? POOLED_COLOR : EDGE_COLOR}
                        strokeWidth={edge.pooled ? 1.4 : 1.6}
                        strokeDasharray={edge.pooled ? POOLED_DASH : undefined}
                        markerEnd={`url(#${edge.pooled ? pooledArrow : arrow})`}
                    />
                ))}
            </g>

            {/* Weight labels. Where the item leaving a box is not the box's
                own product — a byproduct out of a multi-output recipe — the
                label has to name it, or the arrow reads as the wrong thing
                entirely. `paintOrder` puts a white halo behind the glyphs so
                a label crossing an arrow stays readable. */}
            <g
                textAnchor="middle"
                fill="#212529"
                stroke="#ffffff"
                strokeWidth="3"
                paintOrder="stroke"
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {layout.edges.map((edge, index) => {
                    const named = labels.get(edge.from)?.label !== edge.itemName;
                    return (
                        <text
                            key={`label-${edge.from}-${edge.to}-${edge.item}-${index}`}
                            x={edge.labelX}
                            y={edge.labelY}
                            fontSize="10.5"
                        >
                            <tspan x={edge.labelX} dy={named ? '-0.2em' : '0.32em'}>
                                {fmt(edge.quantity)}
                            </tspan>
                            {named && (
                                <tspan x={edge.labelX} dy="1.1em" fontSize="9.5" fill="#495057">
                                    {truncate(edge.itemName, 9.5, 110)}
                                </tspan>
                            )}
                        </text>
                    );
                })}
            </g>

            {layout.nodes.map((node) => {
                const { label, sub } = labels.get(node.id);
                // onSinkPath false is a real fact about the plan, not an
                // error: in practice a source whose only destination is the
                // dump. Fading it says so without hiding it.
                //
                // The dump itself is excluded. It is off the sink path by
                // definition — that is what the box means — so fading it
                // would say nothing, and it would lose the red that marks
                // it as the one place output goes to die.
                const dim = !node.onSinkPath && node.kind !== 'waste';
                const style = dim ? OFF_PATH : KIND_STYLE[node.kind];
                const textX = node.x + PAD_X + ICON_SLOT + ICON_GAP;
                const textW = node.w - PAD_X * 2 - ICON_SLOT - ICON_GAP;
                return (
                    <g key={node.id}>
                        <title>
                            {sub ? `${label} — ${sub}` : label}
                        </title>
                        <rect
                            x={node.x}
                            y={node.y}
                            width={node.w}
                            height={node.h}
                            rx="6"
                            fill={style.fill}
                            stroke={style.stroke}
                            strokeWidth={node.kind === 'sink' ? 2 : 1.25}
                            strokeDasharray={dim ? '5 3' : undefined}
                        />
                        {/* Reserved icon slot: nothing is drawn in it yet, but
                            the text starts to its right, so dropping a 24px
                            <image> here later moves nothing. */}
                        <text
                            x={textX}
                            y={sub ? node.y + 20 : node.y + node.h / 2 + 4}
                            fontSize="11.5"
                            fontWeight="600"
                            fill={style.label}
                        >
                            {truncate(label, 11.5, textW, BOLD_CHAR_RATIO)}
                        </text>
                        {sub && (
                            <text
                                x={textX}
                                y={node.y + 35}
                                fontSize="9.5"
                                fill={dim ? OFF_PATH.label : '#495057'}
                            >
                                {truncate(sub, 9.5, textW)}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

/**
 * The scroll box the drawing sits in. `style` is where the two views differ:
 * inline it is capped at a height that leaves the rest of the plan on screen,
 * expanded it takes whatever the modal has left over.
 */
const FlowViewport = ({ layout, labels, hasSink, style, onActivate }) => (
    // The diagram is a fixed-size drawing, so it scrolls inside this box
    // instead of pushing the page into horizontal scroll at 320px
    // (WCAG 1.4.10 Reflow). A scroll container with no focusable
    // children is unreachable from the keyboard, hence tabIndex — the
    // role/label give that tab stop a name worth landing on.
    // `overflow` is set inline and not with Bootstrap's `overflow-auto`
    // because index.html still serves Bootstrap 4 CSS, which has no
    // overflow utilities — the class would do nothing and a 3000px-wide
    // plan would push the whole page sideways.
    // `scrollMarginTop` clears the `fixed-top` navbar: without it,
    // tabbing here scrolls the container flush to the viewport top and
    // the navbar covers its focus ring (WCAG 2.4.11).
    <div
        className="border rounded bg-white"
        style={{ overflow: 'auto', scrollMarginTop: '4.5rem', ...style }}
        tabIndex={0}
        role="group"
        aria-label="Flow diagram of the plan, scrollable"
    >
        <FlowCanvas
            layout={layout}
            labels={labels}
            hasSink={hasSink}
            onActivate={onActivate}
        />
    </div>
);

/** How to read the drawing. Shown under it in both views. */
const FlowLegend = ({ pooledCount, dimmedCount, hasSink, hasWaste, className = '' }) => (
    <ul className={`list-unstyled small text-muted text-body-secondary mb-0 ${className}`}>
        {pooledCount > 0 && (
            <li>
                <span style={{ color: POOLED_COLOR }} aria-hidden="true">- - -&nbsp;</span>
                <strong>Dashed purple arrows ({pooledCount})</strong> carry a product that
                several recipes make <em>and</em> several recipes use. The totals are
                right, but which machine feeds which is a free choice — that split is one
                valid answer, not the answer.
            </li>
        )}
        {dimmedCount > 0 && (
            <li className="mt-1">
                <strong>Faded boxes with a dashed outline</strong> are not on a path to the
                Sink: what goes into them is vented or dumped rather than scored.
            </li>
        )}
        <li className="mt-1">
            An arrow labelled with a product name is a byproduct — something the box
            makes besides the product it is named for.
        </li>
        {/* Colour is never load-bearing here — a box's kind is already
            given by its row and by its own text — but naming the scheme
            costs a line and saves the reader inferring it. */}
        <li className="mt-1">
            <strong>Box colours</strong> go with position: blue at the top is
            something you supply, white in between is a product one of your machines
            makes{hasSink ? ', green at the bottom is the AWESOME Sink' : ''}
            {hasWaste ? ', red is where output is vented or dumped' : ''}.
        </li>
    </ul>
);

const FlowDiagram = ({ plan, dataset }) => {
    const headingId = useId();
    const [expanded, setExpanded] = useState(false);
    const graph = plan?.flow;

    const { layout, labels } = useMemo(() => {
        if (!graph || graph.nodes.length === 0 || !dataset) return { layout: null, labels: null };
        return {
            // Box size is a font decision, so it is set here rather than left
            // to the library default. 220 wide is what it costs to print the
            // recipe names in full: it clips 1 of the 153 product names in the
            // dataset and 18 of the 157 recipe names, where 190 would clip half
            // the recipe names. 48 tall fits a label over a subtext.
            layout: layoutFlowGraph(graph, { nodeWidth: 220, nodeHeight: 48 }),
            labels: describeNodes(graph, dataset),
        };
    }, [graph, dataset]);

    // A non-optimal plan carries `{nodes: [], edges: []}`. Render nothing at
    // all rather than an empty frame — PlanResults is already showing the
    // reason there is no plan.
    if (!layout) return null;

    const pooledCount = layout.edges.filter((edge) => edge.pooled).length;
    const dimmedCount = layout.nodes.filter(
        (node) => !node.onSinkPath && node.kind !== 'waste',
    ).length;
    // Not every plan reaches the Sink. Nitrogen Gas on its own is
    // `source -> vented`, and captioning that "down to the AWESOME Sink" states
    // the opposite of what is drawn. The <title> is the image's accessible name,
    // so for a screen reader user that caption is the whole diagram.
    const hasSink = layout.nodes.some((node) => node.kind === 'sink');
    const hasWaste = layout.nodes.some((node) => node.kind === 'waste');
    const legendProps = { pooledCount, dimmedCount, hasSink, hasWaste };

    return (
        <section className="mb-4">
            {/* `d-flex` and the gap utilities are Bootstrap 4 spellings that
                survive in 5; `gap-2` is not, hence the inline margin on the
                button. */}
            <div className="d-flex align-items-center justify-content-between mb-2">
                <h3 className="h5 mb-0">How it flows</h3>
                {/* Font Awesome 4.7 is what index.html loads, so this is
                    `fa-arrows-alt` (arrows out to four corners) rather than a
                    Bootstrap Icons name. The glyph is decorative — the button's
                    accessible name comes from aria-label. */}
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setExpanded(true)}
                    aria-label="Expand the flow diagram"
                    title="Expand the flow diagram"
                    style={{ marginLeft: '0.5rem' }}
                >
                    <i className="fa fa-arrows-alt" aria-hidden="true" />
                </Button>
            </div>
            {/* `text-muted` as well as `text-body-secondary`: index.html still
                serves Bootstrap 4 CSS, which has no `.text-body-secondary`, so
                on its own this paragraph renders at full body weight and the
                section loses its de-emphasised tier. Drop `text-muted` once the
                app loads Bootstrap 5 CSS. */}
            <p className="small text-muted text-body-secondary">
                Source products at the top{hasSink ? ', the AWESOME Sink at the bottom' : ''}.
                Each box is a product; the line under a box is the recipe that makes it.
                Numbers on the arrows are how much of that product moves along the belt.
            </p>

            {/* Capped so a tall plan does not bury the tables under it; the
                expand button, or a click on the drawing, is the way out of the
                cap. Only this copy is clickable — inside the modal there is
                nothing left to expand to. */}
            <FlowViewport
                layout={layout}
                labels={labels}
                hasSink={hasSink}
                style={{ maxHeight: '34rem' }}
                onActivate={() => setExpanded(true)}
            />

            {/* The text alternative, and it has to exist: the tables above carry
                source quantities, recipe craft counts, sink totals and waste,
                but never the rate along a belt between two machines — which is
                the one thing the arrows are for. In a plain Iron Ore plan 7 of
                the 11 arrow numbers appear here and nowhere else on the page, so
                without this list the drawing would be the sole carrier of them.
                Hidden from sight because it only repeats the picture; `sr-only`
                as well as `visually-hidden` because index.html still serves
                Bootstrap 4 CSS, where the latter does not exist. */}
            <div className="visually-hidden sr-only">
                <h4>Every connection in the diagram, as text</h4>
                <ul>
                    {layout.edges.map((edge, index) => {
                        const from = labels.get(edge.from)?.label ?? edge.from;
                        const to = labels.get(edge.to)?.label ?? edge.to;
                        return (
                            <li key={`alt-${edge.from}-${edge.to}-${edge.item}-${index}`}>
                                {`${from} sends ${fmt(edge.quantity)} ${edge.itemName} to ${to}.`}
                                {edge.pooled
                                    && ' Shared pool: one valid split of it, not the only one.'}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <FlowLegend {...legendProps} className="mt-2" />

            {/* The expanded view. A copy of the drawing rather than the same
                node moved: React would unmount and remount the SVG on every
                open and close, which is a scroll position lost each way.
                `centered` and the sizing live in flowdiagram.css because
                Bootstrap 4.1 has no dialog size big enough to ask for.
                No `closeButton` on the header — react-bootstrap renders
                Bootstrap 5's `.btn-close`, which the Bootstrap 4 CSS this page
                loads does not style at all, so it would be an invisible
                control. The explicit button below is styled either way. */}
            <Modal
                show={expanded}
                onHide={() => setExpanded(false)}
                dialogClassName="flow-diagram-modal"
                aria-labelledby={`${headingId}-modal-title`}
                centered
            >
                <Modal.Header>
                    <Modal.Title as="h2" className="h5" id={`${headingId}-modal-title`}>
                        How it flows
                    </Modal.Title>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setExpanded(false)}
                    >
                        Close
                    </Button>
                </Modal.Header>
                <Modal.Body>
                    {/* `minHeight: 0` is what actually lets this shrink: a flex
                        item defaults to min-height auto, so without it the
                        viewport grows to the full height of the drawing and
                        pushes the legend out through the bottom of the modal
                        instead of scrolling inside itself. */}
                    <FlowViewport
                        layout={layout}
                        labels={labels}
                        hasSink={hasSink}
                        style={{ flex: '1 1 auto', minHeight: 0 }}
                    />
                    <FlowLegend {...legendProps} className="mt-2 flex-shrink-0" />
                </Modal.Body>
            </Modal>
        </section>
    );
};

export default FlowDiagram;

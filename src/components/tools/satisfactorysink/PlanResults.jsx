import React, { useMemo } from 'react';
import { Alert, Badge, Card, Table } from 'react-bootstrap';

import FlowDiagram from './FlowDiagram.jsx';
import { fmt } from './format.js';

// The CLI prints the budget share as one decimal place, e.g. `100.0% of budget`.
const fmtShare = (share) => {
    if (typeof share !== 'number' || !Number.isFinite(share)) return '—';
    return `${(share * 100).toFixed(1)}%`;
};

// `textClass` is not decoration: a bare `<Badge bg="secondary">` inherits the
// body colour, which is #212529 on #6c757d — 3.29:1, under the 4.5:1 that
// WCAG 1.4.3 wants for 12px text. Forcing white takes it to 4.69:1, and it is
// the colour Bootstrap 5 would apply anyway. `info` is left alone because
// #212529 on #17a2b8 is already 5.07:1.
const MODE_COPY = {
    ratio: {
        label: 'Ratio mode',
        variant: 'info',
        textClass: '',
        help: 'Unlimited supply, any mix: the best mix to feed in, and the points per source unit it earns.',
    },
    fixed: {
        label: 'Fixed mode',
        variant: 'secondary',
        textClass: 'text-white',
        help: 'You have these amounts: the maximum total points obtainable from them.',
    },
};

// Numeric cells are right-aligned and tabular so columns of figures line up.
const NUM = {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
};

const StatCard = ({ title, value, note, primary }) => (
    <Card
        className={`flex-fill ${primary ? 'border-primary border-2' : ''}`}
        style={{ minWidth: '14rem' }}
    >
        <Card.Body className="py-3">
            <div className="text-uppercase small text-body-secondary">{title}</div>
            <div
                className={primary ? 'fs-3 fw-semibold' : 'fs-4'}
                style={{ fontVariantNumeric: 'tabular-nums' }}
            >
                {value}
            </div>
            <div className="small text-body-secondary">{note}</div>
        </Card.Body>
    </Card>
);

// `dataset` must be the same filtered dataset the plan was solved against —
// the diagram resolves recipe ids through it, and the full recipe book would
// name alternates the plan was never allowed to use.
const PlanResults = ({ plan, mode, dataset }) => {
    const modeCopy = MODE_COPY[mode] ?? MODE_COPY.fixed;

    // Weight is 1 for every product unless the user said otherwise, so the
    // column only earns its place when at least one source is weighted.
    const showWeight = useMemo(
        () => (plan?.sources ?? []).some((source) => source.weight !== 1),
        [plan]
    );

    if (!plan) {
        return (
            <p className="text-body-secondary mb-0">
                Pick one or more source items to see a plan.
            </p>
        );
    }

    const modeIndicator = (
        <div className="mb-3">
            <Badge bg={modeCopy.variant} className={modeCopy.textClass}>{modeCopy.label}</Badge>
            <div className="small text-body-secondary mt-1">{modeCopy.help}</div>
        </div>
    );

    // Non-optimal plans carry empty recipes/sinks arrays and a human-readable
    // reason. Rendering them as a plan would read as "0 points", which is a
    // different (and wrong) answer. See docs §11.2.
    if (plan.status !== 'optimal') {
        const unbounded = plan.status === 'unbounded';
        return (
            <div>
                {modeIndicator}
                <Alert variant={unbounded ? 'danger' : 'warning'}>
                    <Alert.Heading as="h3" className="h5">
                        No plan: {unbounded ? 'unbounded' : 'infeasible'}
                    </Alert.Heading>
                    <p className="mb-0">{plan.reason || 'The solver could not produce a plan.'}</p>
                    {!unbounded && (
                        <p className="mb-0 mt-2 small">
                            Some products cannot be sunk and cannot be consumed by any recipe —
                            the game will not let you discard them. Picking only products like
                            that (Power Shard, for example) leaves the solver with nowhere to put
                            them. Add another source product, or pick a different one.
                        </p>
                    )}
                </Alert>
            </div>
        );
    }

    const isRatio = mode === 'ratio';
    const sources = plan.sources ?? [];
    const recipes = plan.recipes ?? [];
    const sinks = plan.sinks ?? [];
    const declined = plan.declined ?? [];
    const wasted = plan.wasted ?? [];

    const totalCard = (
        <StatCard
            key="total"
            title="Total sink points"
            value={fmt(plan.totalPoints)}
            note={
                isRatio
                    ? 'Points for the scaled plan shown below.'
                    : 'Maximum obtainable from the amounts you gave.'
            }
            primary={!isRatio}
        />
    );

    const perUnitCard = (
        <StatCard
            key="perunit"
            title="Points per source unit"
            value={fmt(plan.pointsPerSourceUnit)}
            note={
                isRatio
                    ? 'The figure this mode maximizes.'
                    : 'Total divided by the weighted source units consumed.'
            }
            primary={isRatio}
        />
    );

    return (
        <div>
            {modeIndicator}

            <div className="d-flex flex-wrap gap-3 mb-4">
                {isRatio ? [perUnitCard, totalCard] : [totalCard, perUnitCard]}
            </div>

            {sources.length > 0 && (
                <section className="mb-4">
                    <h3 className="h5">Source products consumed</h3>
                    <Table responsive size="sm" className="align-middle">
                        <caption className="visually-hidden sr-only">
                            Source products consumed by the plan, with the share of the source
                            budget each one takes.
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" style={NUM}>Quantity</th>
                                <th scope="col">Product</th>
                                {showWeight && (
                                    <th scope="col" style={NUM}>Weight</th>
                                )}
                                <th scope="col" style={NUM}>Share of budget</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sources.map((source) => (
                                <tr key={source.item}>
                                    <td style={NUM}>{fmt(source.quantity)}</td>
                                    <td>{source.name}</td>
                                    {showWeight && (
                                        <td style={NUM}>{fmt(source.weight)}</td>
                                    )}
                                    <td style={NUM}>{fmtShare(source.share)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </section>
            )}

            {declined.length > 0 && (
                <section className="mb-4">
                    <h3 className="h5">Not worth feeding</h3>
                    <p className="small text-body-secondary">
                        You picked these, and the plan deliberately leaves them out: any share of
                        the one-unit budget spent on them would lower the points-per-source-unit
                        average. Give one a quantity to plan for it anyway.
                    </p>
                    <ul className="mb-0">
                        {declined.map((entry) => (
                            <li key={entry.item}>{entry.name}</li>
                        ))}
                    </ul>
                </section>
            )}

            {recipes.length > 0 ? (
                <section className="mb-4">
                    <h3 className="h5">Recipes to run</h3>
                    <p className="small text-body-secondary">
                        Run counts are crafts, and fractional counts are real: 2.0645 means a
                        machine at a partial clock rate, not two machines.
                    </p>
                    <Table responsive size="sm" className="align-middle">
                        <caption className="visually-hidden sr-only">
                            Recipes the plan runs, with the number of crafts of each.
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" style={NUM}>Crafts</th>
                                <th scope="col">Recipe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipes.map((run) => (
                                <tr key={run.recipe}>
                                    <td style={NUM}>{fmt(run.runs)}</td>
                                    <td>{run.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </section>
            ) : (
                <p className="text-body-secondary">
                    No recipes to run — sink the raw products as they are.
                </p>
            )}

            {sinks.length > 0 && (
                <section className="mb-4">
                    <h3 className="h5">Feed to the AWESOME Sink</h3>
                    <Table responsive size="sm" className="align-middle">
                        <caption className="visually-hidden sr-only">
                            Products to feed to the AWESOME Sink, with the points each one earns.
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" style={NUM}>Quantity</th>
                                <th scope="col">Product</th>
                                <th scope="col" style={NUM}>Points each</th>
                                <th scope="col" style={NUM}>Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sinks.map((entry) => (
                                <tr key={entry.item}>
                                    <td style={NUM}>{fmt(entry.quantity)}</td>
                                    <td>{entry.name}</td>
                                    <td style={NUM}>{fmt(entry.pointsEach)}</td>
                                    <td style={NUM}>{fmt(entry.points)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </section>
            )}

            {/* Same position the CLI prints its Material flow table in: after the
                totals the plan is judged on, before the leftovers. It reads as the
                answer to "so how do I actually wire that up?", which is the question
                the sink table leaves you with. */}
            <FlowDiagram plan={plan} dataset={dataset} />

            {wasted.length > 0 && (
                <section className="mb-4">
                    <h3 className="h5">Byproducts with nowhere to go</h3>
                    <p className="small text-body-secondary">
                        Nothing consumes these and the Sink will not take them, so they have to be
                        vented or dumped.
                    </p>
                    <Table responsive size="sm" className="align-middle">
                        <caption className="visually-hidden sr-only">
                            Byproducts the plan cannot use, with the quantity of each to dispose of.
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" style={NUM}>Quantity</th>
                                <th scope="col">Byproduct</th>
                            </tr>
                        </thead>
                        <tbody>
                            {wasted.map((entry) => (
                                <tr key={entry.item}>
                                    <td style={NUM}>{fmt(entry.quantity)}</td>
                                    <td>{entry.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </section>
            )}
        </div>
    );
};

export default PlanResults;

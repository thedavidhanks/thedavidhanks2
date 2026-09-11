import React, { useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { maximizeSinkPoints, resolveMode } from '../../../lib/satisfactory-sink/maximize.ts';
import { satisfactoryDataset } from '../../../lib/satisfactory-sink/dataset.ts';
import ItemPicker from './ItemPicker.jsx';
import AlternatePicker from './AlternatePicker.jsx';
import PlanResults from './PlanResults.jsx';
import { useUnlockedAlternates } from './useUnlockedAlternates.js';

// The full item list never changes, so sort it once at module scope rather than
// on every render.
const ALL_ITEMS = [...satisfactoryDataset.items].sort((a, b) => a.name.localeCompare(b.name));
const ALL_ALTERNATES = satisfactoryDataset.recipes
    .filter((recipe) => recipe.alternate)
    .sort((a, b) => a.name.localeCompare(b.name));

const SatisfactorySink = () => {
    const [sources, setSources] = useState([]);
    const [modeChoice, setModeChoice] = useState('auto');
    const [unlocked, setUnlocked] = useUnlockedAlternates();

    // Restricting the recipe book to the alternates this player has unlocked is
    // the whole point of the tool: iron ore is worth 22.37 points with none of
    // them and 37.24 with all of them. The library assumes every alternate is
    // available, so the filtering has to happen here (docs §7, §11).
    const dataset = useMemo(() => ({
        ...satisfactoryDataset,
        recipes: satisfactoryDataset.recipes.filter(
            (recipe) => !recipe.alternate || unlocked.has(recipe.id),
        ),
    }), [unlocked]);

    // A solve is ~0.27 ms typical and 1.3 ms worst observed on this dataset, so
    // it just runs on every change — no debounce, no worker, no loading state.
    const { plan, mode, error } = useMemo(() => {
        const chosen = sources.filter((source) => source.item);
        if (chosen.length === 0) return { plan: null, mode: null, error: null };
        const override = modeChoice === 'auto' ? undefined : modeChoice;
        try {
            return {
                plan: maximizeSinkPoints({ dataset, sources: chosen, mode: override }),
                // resolveMode applies the library's own rule, so the badge always
                // reports the mode actually used rather than a UI guess.
                mode: resolveMode(chosen, override),
                error: null,
            };
        } catch (thrown) {
            // maximizeSinkPoints validates its input and throws on bad sources
            // (unknown item, non-positive quantity, duplicate id). Surface the
            // message instead of blanking the page.
            return { plan: null, mode: null, error: thrown.message };
        }
    }, [dataset, sources, modeChoice]);

    return (
        <Container className="py-4">
            <h1>Satisfactory Sink Maximizer</h1>
            <p className="lead">
                Tell it what you have and which Hard Drive alternates you have unlocked, and it
                works out what to build so the AWESOME Sink pays you as much as possible.
            </p>
            <p className="text-muted">
                It solves the whole production graph as a linear program rather than following the
                best-looking chain, so it will happily split one input across two chains and sink
                the leftovers raw. Everything is a rate: fractional recipe counts mean machines at
                a partial clock, not a rounding error.
            </p>

            <Row className="g-4">
                <Col lg={5}>
                    <Card className="mb-4">
                        <Card.Body>
                            <Card.Title as="h2" className="h5">1. What have you got?</Card.Title>
                            <Card.Subtitle className="mb-3 text-muted" style={{ fontWeight: 400 }}>
                                Leave every quantity blank to ask &ldquo;what is the best mix, with
                                unlimited supply?&rdquo;. Give quantities (or belt rates in
                                items/min) to ask &ldquo;what is the most I can get out of exactly
                                this?&rdquo;.
                            </Card.Subtitle>
                            <ItemPicker items={ALL_ITEMS} value={sources} onChange={setSources} />

                            <div className="mt-3">
                                <label htmlFor="sink-mode" className="form-label mb-1">
                                    Question to answer
                                </label>
                                {/* w-100: without Bootstrap 5's `.form-select` the native
                                    select sizes to its longest option and pushes the page
                                    into horizontal scroll at 320px (WCAG 1.4.10 Reflow). */}
                                <select
                                    id="sink-mode"
                                    className="form-select form-select-sm w-100"
                                    value={modeChoice}
                                    onChange={(event) => setModeChoice(event.target.value)}
                                >
                                    <option value="auto">Decide for me (from the quantities)</option>
                                    <option value="ratio">Best mix &mdash; unlimited supply</option>
                                    <option value="fixed">Most points &mdash; from these amounts</option>
                                </select>
                                <div className="form-text">
                                    <div>
                                        <strong>Decide for me</strong> &mdash; one product with no
                                        quantity asks for the best mix; anything else plans for the
                                        amounts you gave.
                                    </div>
                                    <div>
                                        <strong>Best mix</strong> &mdash; over several products, asks
                                        what you should be mining, and lets the solver turn a product
                                        down.
                                    </div>
                                    <div>
                                        <strong>Most points</strong> &mdash; plans around exactly the
                                        amounts you entered, using nothing you don&rsquo;t have.
                                    </div>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>

                    <Card>
                        <Card.Body>
                            <Card.Title as="h2" className="h5 mb-3">2. Which alternates have you unlocked?</Card.Title>
                            <AlternatePicker
                                alternates={ALL_ALTERNATES}
                                unlocked={unlocked}
                                onChange={setUnlocked}
                            />
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={7}>
                    <h2 className="h5">3. The plan</h2>
                    {error
                        ? <Alert variant="danger"><strong>That input can&rsquo;t be solved:</strong> {error}</Alert>
                        : <PlanResults plan={plan} mode={mode} dataset={dataset} />}
                </Col>
            </Row>
        </Container>
    );
};

export default SatisfactorySink;

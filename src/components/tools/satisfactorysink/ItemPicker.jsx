import React, { useMemo, useState } from 'react';
import Select from 'react-select';
import { Row, Col } from 'react-bootstrap';

// react-select is already a dependency and is already used in
// src/components/aboutme/index.jsx, so it is the house choice for a
// searchable multi-select. It also gives us keyboard navigation and the
// combobox/listbox ARIA wiring for free, which a hand-rolled Bootstrap
// dropdown over 186 items would have to reimplement.

// Pretty names for the categories the dataset ships today. Anything not
// listed (the data also carries "gas", and new categories may appear when
// src/data/satisfactory/items.json is regenerated) falls back to a simple
// capitalization, and items with no category at all land in "Other".
const CATEGORY_LABELS = {
    ore: 'Ore',
    part: 'Part',
    fluid: 'Fluid',
    biomass: 'Biomass',
    ammo: 'Ammo',
    equipment: 'Equipment',
    consumable: 'Consumable',
};

// Groups render in this order; unknown categories follow alphabetically and
// "Other" is always last.
const CATEGORY_ORDER = ['ore', 'part', 'fluid', 'biomass', 'ammo', 'equipment', 'consumable'];

const OTHER_KEY = '__other__';

const categoryLabel = (key) => {
    if (key === OTHER_KEY) return 'Other';
    return CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

const compareCategories = (a, b) => {
    if (a === b) return 0;
    if (a === OTHER_KEY) return 1;
    if (b === OTHER_KEY) return -1;
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
};

const formatPoints = (sinkPoints) =>
    sinkPoints == null
        ? 'cannot be sunk'
        : `${sinkPoints.toLocaleString()} pts/unit`;

// Blank is always allowed (it means "no quantity" / "default weight"); a value
// the solver would reject (zero, negative, NaN) is reported as invalid rather
// than silently dropped.
const parsePositive = (text) => {
    const trimmed = String(text).trim();
    if (trimmed === '') return { empty: true, value: undefined, valid: true };
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return { empty: false, value: undefined, valid: false };
    }
    return { empty: false, value: parsed, valid: true };
};

// A SourceProduct must never carry a non-positive quantity — the solver
// validates it — so the key is omitted entirely when there is no quantity.
const buildSource = (item, quantity, weight) => ({
    item,
    ...(Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
});

// Keep the Select menu above the rows rendered beneath it.
const selectStyles = {
    menu: (base) => ({ ...base, zIndex: 5 }),
};

const ItemPicker = ({ items = [], value = [], onChange }) => {
    // Raw text for the numeric inputs, held only while what the user typed
    // differs from what was committed to the parent (i.e. while it is
    // invalid). The selections themselves are never duplicated here.
    const [drafts, setDrafts] = useState({});

    const itemsById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => map.set(item.id, item));
        return map;
    }, [items]);

    const groupedOptions = useMemo(() => {
        const groups = new Map();
        items.forEach((item) => {
            const key = item.category || OTHER_KEY;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({
                value: item.id,
                label: item.name,
                sinkPoints: item.sinkPoints ?? null,
            });
        });
        return [...groups.entries()]
            .sort(([a], [b]) => compareCategories(a, b))
            .map(([key, options]) => ({
                label: categoryLabel(key),
                options: options.sort((a, b) => a.label.localeCompare(b.label)),
            }));
    }, [items]);

    const selectedOptions = useMemo(
        () =>
            value.map((source) => {
                const item = itemsById.get(source.item);
                return {
                    value: source.item,
                    label: item ? item.name : source.item,
                    sinkPoints: item ? item.sinkPoints ?? null : null,
                };
            }),
        [value, itemsById]
    );

    const pruneDrafts = (keepIds) =>
        setDrafts((prev) => {
            const next = {};
            Object.keys(prev).forEach((id) => {
                if (keepIds.has(id)) next[id] = prev[id];
            });
            return next;
        });

    const setDraft = (itemId, field, text) =>
        setDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: text } }));

    const clearDraft = (itemId, field) =>
        setDrafts((prev) => {
            const row = prev[itemId];
            if (!row || row[field] === undefined) return prev;
            const nextRow = { ...row };
            delete nextRow[field];
            const next = { ...prev };
            if (Object.keys(nextRow).length > 0) next[itemId] = nextRow;
            else delete next[itemId];
            return next;
        });

    // Selecting/deselecting in the Select. Existing rows keep their numbers;
    // new rows start with no quantity and a weight of 1.
    const handleSelectChange = (options) => {
        const chosen = options || [];
        const existing = new Map(value.map((source) => [source.item, source]));
        const next = chosen.map((option) => {
            const prev = existing.get(option.value);
            return prev || buildSource(option.value, undefined, 1);
        });
        pruneDrafts(new Set(next.map((source) => source.item)));
        onChange(next);
    };

    const handleRemove = (itemId) => {
        const next = value.filter((source) => source.item !== itemId);
        pruneDrafts(new Set(next.map((source) => source.item)));
        onChange(next);
    };

    const patchSource = (itemId, patch) => {
        onChange(
            value.map((source) => {
                if (source.item !== itemId) return source;
                const merged = { ...source, ...patch };
                return buildSource(merged.item, merged.quantity, merged.weight);
            })
        );
    };

    const handleQuantityChange = (itemId, text) => {
        setDraft(itemId, 'quantity', text);
        const { empty, value: parsed, valid } = parsePositive(text);
        // Invalid input is held in the draft only, so the parent never sees a
        // quantity the solver would reject.
        if (empty) patchSource(itemId, { quantity: undefined });
        else if (valid) patchSource(itemId, { quantity: parsed });
    };

    const handleWeightChange = (itemId, text) => {
        setDraft(itemId, 'weight', text);
        const { empty, value: parsed, valid } = parsePositive(text);
        if (empty) patchSource(itemId, { weight: 1 });
        else if (valid) patchSource(itemId, { weight: parsed });
    };

    // Once the field reads as valid (or blank) the draft is dropped and the
    // input goes back to mirroring the committed value.
    const handleBlur = (itemId, field, text) => {
        if (parsePositive(text).valid) clearDraft(itemId, field);
    };

    const anyQuantity = value.some((source) => Number.isFinite(source.quantity));

    return (
        <div>
            <div className="mb-3">
                <label htmlFor="sink-item-select" className="form-label">
                    Products you can feed in
                </label>
                <Select
                    inputId="sink-item-select"
                    name="sink-items"
                    options={groupedOptions}
                    value={selectedOptions}
                    onChange={handleSelectChange}
                    isMulti
                    placeholder="Search items (e.g. Iron Ore, Reinforced Iron Plate)..."
                    noOptionsMessage={() => 'No matching items'}
                    closeMenuOnSelect={false}
                    styles={selectStyles}
                    formatOptionLabel={(option, meta) =>
                        meta.context === 'menu' ? (
                            <span className="d-flex justify-content-between gap-3">
                                <span>{option.label}</span>
                                <small className="text-muted">{formatPoints(option.sinkPoints)}</small>
                            </span>
                        ) : (
                            option.label
                        )
                    }
                />
                <div className="form-text">
                    {anyQuantity
                        ? 'Quantities given — the plan will use the amounts you entered.'
                        : 'Leave quantities blank to get the best mix per source unit.'}
                </div>
            </div>

            {value.length > 0 && (
                <div>
                    {/* Breakpoints key off the viewport, but this row lives inside a `lg={5}`
                        column, so the space it actually gets is not monotonic in viewport
                        width. At `lg` (992-1199px) that column is only ~350px and a four-way
                        split clips the "Remove" label, so there the button drops to its own
                        full-width line; at `md` and `xl` the row is wide enough for four. */}
                    <Row className="g-2 d-none d-md-flex fw-semibold small text-muted" aria-hidden="true">
                        <Col md={3} lg={4} xl={3}>Product</Col>
                        <Col md={3} lg={4} xl={3}>Quantity / min</Col>
                        <Col md={3} lg={4} xl={3}>Weight</Col>
                        <Col md={3} xl={3} className="d-lg-none d-xl-block">&nbsp;</Col>
                    </Row>

                    {value.map((source) => {
                        const item = itemsById.get(source.item);
                        const name = item ? item.name : source.item;
                        const sinkPoints = item ? item.sinkPoints ?? null : null;

                        const qtyDraft = drafts[source.item]?.quantity;
                        const qtyText =
                            qtyDraft !== undefined
                                ? qtyDraft
                                : Number.isFinite(source.quantity)
                                    ? String(source.quantity)
                                    : '';
                        const qtyInvalid = qtyDraft !== undefined && !parsePositive(qtyDraft).valid;

                        const weightDraft = drafts[source.item]?.weight;
                        const weightText =
                            weightDraft !== undefined
                                ? weightDraft
                                : Number.isFinite(source.weight)
                                    ? String(source.weight)
                                    : '1';
                        const weightInvalid =
                            weightDraft !== undefined && !parsePositive(weightDraft).valid;

                        const qtyId = `sink-qty-${source.item}`;
                        const weightId = `sink-weight-${source.item}`;

                        return (
                            <Row
                                key={source.item}
                                className="g-2 align-items-start py-2 border-top"
                            >
                                <Col xs={12} md={3} lg={4} xl={3}>
                                    <div className="fw-semibold">{name}</div>
                                    <small className="text-muted">{formatPoints(sinkPoints)}</small>
                                </Col>

                                <Col xs={6} md={3} lg={4} xl={3}>
                                    {/* `sr-only` as well as `visually-hidden`: index.html still
                                        serves Bootstrap 4 CSS, which has no `.visually-hidden`,
                                        so on its own the label renders as visible body text.
                                        Drop `sr-only` once the app loads Bootstrap 5 CSS. */}
                                    <label htmlFor={qtyId} className="visually-hidden sr-only">
                                        Quantity per minute for {name} (optional)
                                    </label>
                                    {/* type="text" + inputMode="decimal" rather than
                                        type="number": a number input reports garbage
                                        like "abc" as an empty string, which would make
                                        it indistinguishable from a deliberately blank
                                        box and impossible to flag. */}
                                    <input
                                        id={qtyId}
                                        type="text"
                                        inputMode="decimal"
                                        className={`form-control form-control-sm${qtyInvalid ? ' is-invalid' : ''}`}
                                        placeholder="any"
                                        value={qtyText}
                                        aria-invalid={qtyInvalid || undefined}
                                        aria-describedby={qtyInvalid ? `${qtyId}-error` : undefined}
                                        onChange={(e) => handleQuantityChange(source.item, e.target.value)}
                                        onBlur={(e) => handleBlur(source.item, 'quantity', e.target.value)}
                                    />
                                    {qtyInvalid && (
                                        <div id={`${qtyId}-error`} className="invalid-feedback">
                                            Enter a number above 0, or leave blank.
                                        </div>
                                    )}
                                </Col>

                                <Col xs={6} md={3} lg={4} xl={3}>
                                    <label htmlFor={weightId} className="visually-hidden sr-only">
                                        Relative cost weight for {name}
                                    </label>
                                    <input
                                        id={weightId}
                                        type="text"
                                        inputMode="decimal"
                                        className={`form-control form-control-sm${weightInvalid ? ' is-invalid' : ''}`}
                                        placeholder="1"
                                        value={weightText}
                                        aria-invalid={weightInvalid || undefined}
                                        aria-describedby={weightInvalid ? `${weightId}-error` : undefined}
                                        onChange={(e) => handleWeightChange(source.item, e.target.value)}
                                        onBlur={(e) => handleBlur(source.item, 'weight', e.target.value)}
                                    />
                                    {weightInvalid && (
                                        <div id={`${weightId}-error`} className="invalid-feedback">
                                            Enter a number above 0. Blank counts as 1.
                                        </div>
                                    )}
                                </Col>

                                <Col xs={12} md={3} lg={12} xl={3}>
                                    {/* px-1: the button is already w-100, so trimming the
                                        horizontal padding costs nothing visually and stops
                                        "Remove" clipping in the ~992px two-column layout. */}
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary w-100 px-1"
                                        aria-label={`Remove ${name}`}
                                        onClick={() => handleRemove(source.item)}
                                    >
                                        Remove
                                    </button>
                                </Col>
                            </Row>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ItemPicker;

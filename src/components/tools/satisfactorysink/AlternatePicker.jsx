import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

const ALTERNATE_PREFIX = 'Alternate: ';

// Every alternate recipe in the dataset is named "Alternate: <thing>". The
// prefix is noise once they are all in a list headed "alternate recipes", so
// it is stripped for display but kept in the search haystack (a player who
// types "alternate" still gets hits).
//
// Derived once per `alternates` array — not per keystroke and not per row
// render — so filtering 110 rows is a lowercased substring test and nothing
// more.
const toRows = (alternates) =>
    alternates.map((recipe) => {
        const displayName = recipe.name.startsWith(ALTERNATE_PREFIX)
            ? recipe.name.slice(ALTERNATE_PREFIX.length)
            : recipe.name;

        return {
            id: recipe.id,
            displayName,
            machine: recipe.machine || '',
            haystack: `${recipe.name} ${recipe.machine || ''}`.toLowerCase(),
        };
    });

const AlternatePicker = ({ alternates, unlocked, onChange }) => {
    const [query, setQuery] = useState('');
    const allRef = useRef(null);
    const idPrefix = useId();
    const searchId = `${idPrefix}-search`;
    const allId = `${idPrefix}-all`;

    const rows = useMemo(() => toRows(alternates), [alternates]);

    const needle = query.trim().toLowerCase();
    const visible = useMemo(
        () => (needle ? rows.filter((row) => row.haystack.includes(needle)) : rows),
        [rows, needle]
    );

    // Membership is unlocked.has(id) — O(1) per row, no Set rebuilt in render.
    const totalUnlocked = rows.reduce((n, row) => n + (unlocked.has(row.id) ? 1 : 0), 0);
    const visibleUnlocked = needle
        ? visible.reduce((n, row) => n + (unlocked.has(row.id) ? 1 : 0), 0)
        : totalUnlocked;

    const allChecked = visible.length > 0 && visibleUnlocked === visible.length;
    const someChecked = visibleUnlocked > 0 && !allChecked;

    // React has no `indeterminate` prop; it is a DOM property only.
    useEffect(() => {
        if (allRef.current) allRef.current.indeterminate = someChecked;
    }, [someChecked]);

    // Scoping decision: while the search box is filtering, the ALL checkbox
    // acts on the VISIBLE MATCHES ONLY, and its label says so ("Select all 8
    // matches") rather than "All alternate recipes". Toggling 110 hidden rows
    // from a control the user is looking at while filtered down to 8 is the
    // more surprising of the two behaviours, and scoping it makes "unlock
    // every Iron alternate I have" a two-action job. With the box empty it is
    // all 110, and the running total is shown either way so the global state
    // is never hidden.
    const allLabel = needle
        ? `Select all ${visible.length} matches (${visibleUnlocked} of ${visible.length} unlocked)`
        : `All alternate recipes (${totalUnlocked} of ${rows.length} unlocked)`;

    const toggleAll = (event) => {
        const next = new Set(unlocked);
        if (event.target.checked) {
            visible.forEach((row) => next.add(row.id));
        } else {
            visible.forEach((row) => next.delete(row.id));
        }
        onChange(next);
    };

    const toggleOne = (id, checked) => {
        const next = new Set(unlocked);
        if (checked) next.add(id);
        else next.delete(id);
        onChange(next);
    };

    return (
        <fieldset className="mb-3">
            <legend className="h6">Unlocked alternate recipes</legend>
            <p className="text-muted small mb-2">
                Alternates come from Hard Drives, so every save has a different set. The
                planner may only use the ones checked here; standard recipes are always
                available.
            </p>

            {/* `sr-only` as well as `visually-hidden`: index.html still serves
                Bootstrap 4 CSS, which has no `.visually-hidden`, so on its own
                this label renders as visible body text. Drop `sr-only` once the
                app loads Bootstrap 5 CSS. */}
            <label htmlFor={searchId} className="visually-hidden sr-only">
                Search alternate recipes
            </label>
            <input
                id={searchId}
                type="search"
                className="form-control form-control-sm mb-2"
                placeholder="Search alternate recipes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            <div className="small text-muted mb-2" aria-live="polite">
                {needle
                    ? `${visible.length} of ${rows.length} alternate recipes match. ` +
                      `${totalUnlocked} of ${rows.length} unlocked in total.`
                    : ''}
            </div>

            <div className="form-check border-bottom pb-2 mb-2">
                <input
                    ref={allRef}
                    className="form-check-input"
                    type="checkbox"
                    id={allId}
                    checked={allChecked}
                    disabled={visible.length === 0}
                    onChange={toggleAll}
                />
                <label className="form-check-label fw-semibold" htmlFor={allId}>
                    {allLabel}
                </label>
            </div>

            {/* Scrollable because 110 checkboxes is several screens. The inner
                padding keeps Bootstrap's focus ring from being clipped by the
                overflow; the checkboxes themselves are the region's tab stops,
                so it is reachable and scrollable from the keyboard. */}
            <div
                className="border rounded px-3 py-2"
                style={{ maxHeight: '24rem', overflowY: 'auto' }}
            >
                {visible.length === 0 && (
                    <p className="text-muted small mb-0">No alternate recipes match that search.</p>
                )}

                {visible.map((row) => {
                    const rowId = `${idPrefix}-${row.id}`;
                    return (
                        <div className="form-check" key={row.id}>
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id={rowId}
                                checked={unlocked.has(row.id)}
                                onChange={(e) => toggleOne(row.id, e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={rowId}>
                                {row.displayName}
                                {row.machine && (
                                    <span className="text-muted small ms-2">{row.machine}</span>
                                )}
                            </label>
                        </div>
                    );
                })}
            </div>
        </fieldset>
    );
};

export default AlternatePicker;

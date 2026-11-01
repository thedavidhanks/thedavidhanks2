import { useState } from 'react';

import { formatDate } from './format.js';
import { PlusIcon } from './icons.jsx';

const fitOf = (app) => {
    const fit = app.recommendations?.fit;
    return Number.isFinite(fit) ? fit : null;
};

// The saved-applications index: newest first (the subscription's order),
// filterable by company or position. A row opens the read-only detail view.
export default function HistoryList({ applications, onOpen, onNew }) {
    const [query, setQuery] = useState('');

    if (applications.length === 0) {
        return (
            <section className="afj-empty" aria-labelledby="afj-history-title">
                <h4 id="afj-history-title">No saved applications yet</h4>
                <p>
                    Every cover letter and resume you generate is saved here, so you can come
                    back to review, copy, or print them later.
                </p>
                <button type="button" className="btn btn-primary afj-tool" onClick={onNew}>
                    <PlusIcon />New application
                </button>
            </section>
        );
    }

    const needle = query.trim().toLowerCase();
    const rows = needle
        ? applications.filter((app) =>
            `${app.company || ''} ${app.position || ''}`.toLowerCase().includes(needle))
        : applications;

    return (
        <section className="afj-history" aria-labelledby="afj-history-title">
            <div className="afj-history-bar">
                <h4 id="afj-history-title">
                    Past applications <span className="afj-count">{applications.length}</span>
                </h4>
                <input
                    type="search"
                    className="form-control afj-filter"
                    aria-label="Filter past applications"
                    placeholder="Filter by company or position"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="afj-table-wrap">
                <table className="table afj-table mb-0">
                    <thead>
                        <tr>
                            <th scope="col">Company</th>
                            <th scope="col" className="afj-col-position">Position</th>
                            <th scope="col" className="afj-col-num">Fit</th>
                            <th scope="col" className="afj-col-date">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((app) => {
                            const fit = fitOf(app);
                            const when = formatDate(app.createdAtMs);
                            return (
                                <tr key={app.id} className="afj-row">
                                    <td>
                                        <button
                                            type="button"
                                            className="afj-row-link stretched-link"
                                            onClick={() => onOpen(app.id)}
                                            aria-label={`${app.company || 'Untitled company'}, ${app.position || 'no position'}, ${when}`}
                                        >
                                            {app.company || 'Untitled company'}
                                        </button>
                                        <span className="afj-row-sub">{app.position || '—'}</span>
                                    </td>
                                    <td className="afj-col-position">{app.position || '—'}</td>
                                    <td className="afj-col-num">
                                        {fit === null ? <span className="afj-muted">—</span> : fit}
                                    </td>
                                    <td className="afj-col-date">{when}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <p className="afj-no-match">No applications match “{query.trim()}”.</p>
                )}
            </div>
        </section>
    );
}

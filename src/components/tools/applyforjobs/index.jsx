import React, { useEffect, useRef, useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
    createApplication,
    deleteApplication,
    subscribeToApplications,
    updateApplicationOutputs,
} from './history.js';
import { renderMarkdown } from './markdown.js';
import Recommendations from './Recommendations.jsx';
import './applyforjobs.css';

// Async application API: POST submits and returns a jobId, then
// GET {API_URL}/{jobId} is polled until the job completes or fails.
// Contract: docs/handoff/APPLICATION_API.md
const API_URL = (import.meta.env.VITE_AWS_APPLICATION_API_URL || '').replace(/\/+$/, '');
const API_KEY = import.meta.env.VITE_AWS_APPLICATION_API_KEY;

// Give up polling after this long and tell the user. A typical run is ~46s.
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
// Only used if the 202 omits pollAfterSeconds. The server value always wins,
// because polling spends a 2000/day request budget.
const FALLBACK_POLL_SECONDS = 10;
// Tolerate a few consecutive transient poll failures (network blip, 5xx, 429)
// before giving up; every poll still waits the full interval.
const MAX_TRANSIENT_POLL_FAILURES = 3;

// Failures from the submit/poll flow carry a user-facing message so the catch
// block can show it as-is.
class ApplicationError extends Error {}

const SUBMIT_ERRORS = {
    400: 'The job posting couldn\'t be submitted. Check that it isn\'t empty and try again.',
    403: 'This tool isn\'t set up correctly (access denied). Please try again later.',
    500: 'The service had trouble starting your request. Please try again.',
};
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const FAILED_ERROR = 'Generating your documents didn\'t work. Please try again.';
const GONE_ERROR = 'This result is no longer available. Please submit the job posting again.';
const TIMEOUT_ERROR = 'This is taking longer than expected. Please try again in a few minutes.';

// Resolves after `ms`, or rejects with an AbortError as soon as `signal`
// aborts, clearing the timer so nothing outlives an unmount.
const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal.addEventListener('abort', onAbort, { once: true });
    });

// A stalled connection (captive portal, half-open socket) would otherwise leave
// `await fetch` pending forever, and with it the non-dismissable progress modal.
// Aborts after REQUEST_TIMEOUT_MS with a TimeoutError, or immediately with an
// AbortError if the parent signal aborts (unmount / cancel). Always clears its
// timer.
const REQUEST_TIMEOUT_MS = 20 * 1000;
const fetchWithTimeout = async (url, options, parentSignal) => {
    const controller = new AbortController();
    let timedOut = false;
    const onParentAbort = () => controller.abort();
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (timedOut && !parentSignal.aborted) {
            const timeoutError = new Error('Request timed out');
            timeoutError.name = 'TimeoutError';
            throw timeoutError;
        }
        throw err;
    } finally {
        clearTimeout(timer);
        parentSignal.removeEventListener('abort', onParentAbort);
    }
};

const pollDelayMs = (pollAfterSeconds) => {
    const seconds = Number(pollAfterSeconds);
    return (Number.isFinite(seconds) && seconds > 0 ? seconds : FALLBACK_POLL_SECONDS) * 1000;
};

// Wait pollAfterSeconds before the first poll and between polls. Resolves with
// the `complete` body; throws ApplicationError for failed / 404 / timeout.
const pollForResult = async (jobId, delayMs, startedAt, signal) => {
    let transientFailures = 0;
    for (;;) {
        await sleep(delayMs, signal);

        let body = null;
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/${encodeURIComponent(jobId)}`,
                { headers: { 'X-Api-Key': API_KEY } },
                signal
            );
            if (response.status === 404) throw new ApplicationError(GONE_ERROR);
            if (response.status === 403) throw new ApplicationError(SUBMIT_ERRORS[403]);
            if (response.ok) body = await response.json();
        } catch (err) {
            // A per-request TimeoutError (or network error) is a transient failure.
            if (err instanceof ApplicationError || err.name === 'AbortError') throw err;
        }

        if (body === null) {
            transientFailures += 1;
            if (transientFailures >= MAX_TRANSIENT_POLL_FAILURES) {
                throw new ApplicationError(GENERIC_ERROR);
            }
        } else {
            transientFailures = 0;
            if (body.status === 'complete') return body;
            if (body.status === 'failed') throw new ApplicationError(FAILED_ERROR);
            // pending / running: a long pending is normal, keep waiting.
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
            throw new ApplicationError(TIMEOUT_ERROR);
        }
    }
};

const formatElapsed = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
};

// Print stylesheet for the generated PDF (the equivalent of the Python
// pipeline's css_path). Styles headings, tables, italics, bold, and lists.
// @page sets US Letter with 1-inch margins so the browser's print engine
// (the WeasyPrint equivalent) lays out the PDF.
const PDF_STYLESHEET = `
    @page {
        size: Letter;
        margin: 0.6in;
    }

    html {
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Liberation Sans", sans-serif;
        font-size: 10.5pt;
        line-height: 1.35;
        color: #222;
    }

    body {
        margin: 0;
    }

    h1 {
        font-size: 22pt;
        margin: 0 0 0.1em 0;
        line-height: 1.1;
    }

    h2 {
        font-size: 13pt;
        margin: 1em 0 0.3em 0;
        padding-bottom: 0.1em;
        border-bottom: 1px solid #444;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    h3 {
        font-size: 11pt;
        margin: 0.75em 0 0.15em 0;
        /* top right bottom left */
    }

    p {
        margin: 0 0 1em 0;
    }

    ul, ol {
        margin: 0.2em 0 0.5em 0;
        padding-left: 1.2em;
    }

    li {
        margin: 0.1em 0;
    }

    li > p {
        margin: 0;
    }

    strong {
        color: #000;
    }

    a {
        color: #0066cc;
        text-decoration: underline;
    }

    hr {
        border: none;
        border-top: 1px solid #ccc;
        margin: 0.8em 0;
    }

    code {
        font-family: "SF Mono", Menlo, Consolas, monospace;
        font-size: 9.5pt;
        background: #f4f4f4;
        padding: 0 0.2em;
        border-radius: 2px;
    }

    pre {
        background: #f4f4f4;
        padding: 0.5em 0.7em;
        border-radius: 3px;
        font-size: 9.5pt;
        overflow-x: hidden;
        white-space: pre-wrap;
    }

    blockquote {
        border-left: 3px solid #ccc;
        margin: 0.5em 0;
        padding: 0 0 0 0.8em;
        color: #555;
    }

    table {
        width: 100%;
        padding: 0 0 0.5em 0;
        border-collapse: collapse;
    }
`;

// Render markdown to a styled PDF via the browser's own print engine.
// Mirrors the Python markdown_to_pdf: marked (markdown -> HTML) + a CSS
// stylesheet, rendered to PDF by the browser (the WeasyPrint equivalent).
// Tables, italics, and bold render as real, selectable text. The user picks
// "Save as PDF" (or a real printer) in the print dialog.
const downloadPdf = (title, markdown) => {
    // GitHub-flavored markdown so pipe tables are parsed. marked is the
    // JS counterpart to Python's markdown.markdown(..., extensions=['extra']).
    // The markdown is user-editable, so sanitize the resulting HTML with
    // DOMPurify to strip any injected scripts/event handlers before it is
    // written into the print window.
    const dirtyHtml = marked.parse(markdown, { gfm: true, breaks: false });
    const html = DOMPurify.sanitize(dirtyHtml);

    const printWindow = window.open('', '_blank', 'width=816,height=1056');
    if (!printWindow) {
        // Popup blocked — nothing we can do without a user-gesture window.
        alert('Please allow pop-ups to download the PDF.');
        return;
    }

    printWindow.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8">` +
        `<title>${title}</title><style>${PDF_STYLESHEET}</style></head>` +
        `<body>${html}</body></html>`
    );
    printWindow.document.close();

    // Wait for layout, trigger the print dialog, then close the helper window.
    printWindow.focus();
    printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
    };
};

// Inline print icon so no icon-font dependency is needed.
const PrintIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        style={{ verticalAlign: '-2px', marginRight: '4px' }}
    >
        <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
        <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a1 1 0 0 0-1 1v3h8v-3a1 1 0 0 0-1-1H5zm7 2h2a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1z" />
    </svg>
);

// Edits to the result are mirrored back to Firestore. Without a debounce
// every keystroke would be a write, which is pointless and would chew through
// the 20k/day free write quota.
const SAVE_DEBOUNCE_MS = 1500;

// "{datetime} - {company} {position}", with em dashes for values the user
// left blank so the label never renders as a ragged "2026-10-28 -  ".
const labelFor = (app) => {
    const when = app.createdAtMs
        ? new Date(app.createdAtMs).toLocaleString()
        : '—';
    return `${when} - ${app.company || '—'} ${app.position || '—'}`;
};

const ApplyForJobs = ({ user }) => {
    const uid = user?.uid || null;

    const [jobPosting, setJobPosting] = useState('');
    const [applicantContext, setApplicantContext] = useState('');
    const [company, setCompany] = useState('');
    const [position, setPosition] = useState('');
    const [showContext, setShowContext] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [startedAtMs, setStartedAtMs] = useState(0);
    const [nowMs, setNowMs] = useState(0);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    // Persistence state, kept separate from `error` so a storage failure is
    // never presented as a failed generation.
    const [savedId, setSavedId] = useState(null);
    const [saveError, setSaveError] = useState('');
    const [applications, setApplications] = useState([]);
    const [viewingId, setViewingId] = useState(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Derived from the live snapshot rather than held as its own copy, so an
    // edit-save is reflected here and a deleted record drops the detail view
    // back to the form on its own.
    const viewing = applications.find((app) => app.id === viewingId) || null;

    const saveTimer = useRef(null);
    const pendingSave = useRef(null);
    // Aborts the in-flight submit/poll (including its sleep timer) on unmount
    // or when a new submit supersedes it.
    const abortRef = useRef(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    // Elapsed-time readout for the progress modal. The API reports no progress
    // or ETA, so time-on-task is the honest indicator.
    useEffect(() => {
        if (!loading) return undefined;
        const interval = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [loading]);
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

    // Move focus to the results when they appear. The form (and the submit
    // button the modal would restore focus to) unmounts in the same commit, so
    // without this focus falls to <body> and nothing announces the new content.
    const resultHeadingRef = useRef(null);
    const hasResult = result !== null;
    useEffect(() => {
        if (hasResult) resultHeadingRef.current?.focus();
    }, [hasResult]);

    useEffect(() => {
        // No uid means no history to show. RequireAuth unmounts the tool on
        // logout, so there is no populated list left behind to clear here.
        if (!uid) return undefined;

        const unsubscribe = subscribeToApplications(uid, setApplications, () => {
            // A failed read just leaves the menu empty; it must not take the
            // generation flow down with it.
            setSaveError('Couldn\'t load your saved applications.');
        });
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [uid]);

    // Push any debounced edit that is still waiting. Reads only refs, so the
    // closure captured by the unmount effect below stays correct.
    const flushSave = () => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
        }
        const pending = pendingSave.current;
        pendingSave.current = null;
        if (!pending) return;
        updateApplicationOutputs(pending.uid, pending.id, pending.outputs).catch(() => {
            setSaveError('Couldn\'t save your latest edits to your history.');
        });
    };

    // Flush on unmount so edits made right before navigating away survive.
    useEffect(() => flushSave, []);

    const scheduleSave = (outputs) => {
        if (!uid || !savedId) return;
        pendingSave.current = { uid, id: savedId, outputs };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    };

    const updateOutput = (field, value) => {
        const next = { ...result, [field]: value };
        setResult(next);
        scheduleSave({ coverLetter: next.coverLetter, resume: next.resume });
    };

    // Fire-and-forget: deliberately not awaited inside handleSubmit's try, so
    // a storage failure cannot be caught as a generation failure.
    const persist = (generated, resolvedSessionId, posting) => {
        if (!uid) return;
        createApplication(uid, {
            company: company.trim(),
            position: position.trim(),
            jobPosting: posting,
            applicantContext: applicantContext.trim(),
            coverLetter: generated.coverLetter,
            resume: generated.resume,
            recommendations: generated.recommendations,
            sessionId: resolvedSessionId,
        })
            .then(setSavedId)
            .catch(() => setSaveError('Couldn\'t save this to your history.'));
    };

    const handleDelete = async (app) => {
        if (!uid) return;
        try {
            await deleteApplication(uid, app.id);
            if (savedId === app.id) setSavedId(null);
            setConfirmingDelete(false);
            setViewingId(null);
        } catch {
            setSaveError('Couldn\'t delete that application.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const posting = jobPosting.trim();
        if (!posting) return;

        setError('');
        setSaveError('');
        setLoading(true);
        setResult(null);
        setSavedId(null);

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const startedAt = Date.now();
        setStartedAtMs(startedAt);
        setNowMs(startedAt);

        try {
            const response = await fetchWithTimeout(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': API_KEY,
                },
                body: JSON.stringify({
                    jobPosting: posting,
                    ...(applicantContext.trim() && { applicantContext: applicantContext.trim() }),
                    ...(sessionId && { sessionId }),
                }),
            }, controller.signal);

            if (!response.ok) {
                throw new ApplicationError(SUBMIT_ERRORS[response.status] || GENERIC_ERROR);
            }

            const accepted = await response.json();
            if (!accepted.jobId) throw new ApplicationError(GENERIC_ERROR);

            const data = await pollForResult(
                accepted.jobId,
                pollDelayMs(accepted.pollAfterSeconds),
                startedAt,
                controller.signal
            );

            if (data.sessionId) setSessionId(data.sessionId);
            // `recommendations` is legitimately null on a complete job.
            const generated = {
                coverLetter: data.coverLetter || '',
                resume: data.resume || '',
                recommendations: data.recommendations || null,
            };
            setResult(generated);
            persist(generated, data.sessionId || sessionId, posting);
        } catch (err) {
            // Aborted means unmounted or superseded: leave state alone.
            if (err.name === 'AbortError') return;
            setError(err instanceof ApplicationError ? err.message : GENERIC_ERROR);
        }
        if (abortRef.current === controller) setLoading(false);
    };

    // Escape hatch from the progress modal: stops the poll loop and its timers.
    const cancelGeneration = () => {
        abortRef.current?.abort();
        setLoading(false);
    };

    const startOver = () => {
        flushSave();
        setJobPosting('');
        setApplicantContext('');
        setCompany('');
        setPosition('');
        setShowContext(false);
        setResult(null);
        setError('');
        setSaveError('');
        setSavedId(null);
    };

    return (
        <div className="applyforjobs-container">
            <div className="d-flex justify-content-between align-items-start gap-3">
                <h3>Apply for Jobs</h3>
                {uid && (
                    <Dropdown align="end">
                        <Dropdown.Toggle
                            variant="outline-secondary"
                            size="sm"
                            id="past-applications"
                        >
                            Past applications
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            {applications.length === 0 ? (
                                <Dropdown.ItemText className="text-muted">
                                    No saved applications yet
                                </Dropdown.ItemText>
                            ) : (
                                applications.map((app) => (
                                    <Dropdown.Item
                                        key={app.id}
                                        onClick={() => {
                                            setConfirmingDelete(false);
                                            setViewingId(app.id);
                                        }}
                                    >
                                        {labelFor(app)}
                                    </Dropdown.Item>
                                ))
                            )}
                        </Dropdown.Menu>
                    </Dropdown>
                )}
            </div>

            {!viewing && (
                <p style={{ color: '#666' }}>
                    Paste a job posting below and get a tailored cover letter and resume.
                </p>
            )}

            {saveError && (
                <div className="alert alert-warning" role="status">{saveError}</div>
            )}

            <Modal
                show={loading}
                backdrop="static"
                keyboard={false}
                animation={false}
                centered
                aria-labelledby="applyforjobs-progress-title"
                aria-describedby="applyforjobs-progress-desc"
            >
                <Modal.Body className="text-center py-4">
                    <Spinner animation="border" aria-hidden="true" className="mb-3" />
                    <h5 id="applyforjobs-progress-title">
                        Generating your cover letter and resume
                    </h5>
                    <p id="applyforjobs-progress-desc" className="mb-1">
                        This usually takes under a minute. Please keep this page open.
                    </p>
                    {/* role=timer is not announced on every tick, unlike a live region. */}
                    <p role="timer" className="text-muted mb-0">
                        Elapsed time: {formatElapsed(elapsedSeconds)}
                    </p>
                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm mt-3"
                        onClick={cancelGeneration}
                    >
                        Cancel
                    </button>
                </Modal.Body>
            </Modal>

            {!viewing && !result && (
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-sm-6 mb-3">
                            <label htmlFor="company" className="form-label">Company</label>
                            <input
                                id="company"
                                type="text"
                                className="form-control"
                                placeholder="Optional"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div className="col-sm-6 mb-3">
                            <label htmlFor="position" className="form-label">Position</label>
                            <input
                                id="position"
                                type="text"
                                className="form-control"
                                placeholder="Optional"
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="jobPosting" className="form-label">
                            Job posting <span style={{ color: '#c00' }}>*</span>
                        </label>
                        <textarea
                            id="jobPosting"
                            className="form-control"
                            rows={20}
                            placeholder="Paste the job description here..."
                            value={jobPosting}
                            onChange={(e) => setJobPosting(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="mb-3">
                        <button
                            type="button"
                            className="btn btn-link p-0"
                            onClick={() => setShowContext(!showContext)}
                            disabled={loading}
                        >
                            {showContext ? 'Hide' : 'Add'} optional context
                        </button>
                        {showContext && (
                            <textarea
                                className="form-control mt-2"
                                rows={3}
                                placeholder="Optional: target tone, specific experience to emphasize, etc."
                                value={applicantContext}
                                onChange={(e) => setApplicantContext(e.target.value)}
                                disabled={loading}
                            />
                        )}
                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">{error}</div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-outline-primary"
                        disabled={loading || !jobPosting.trim()}
                    >
                        {loading ? 'Generating...' : 'Generate Cover Letter & Resume'}
                    </button>
                </form>
            )}

            {!viewing && result && (
                <>
                    <Recommendations recommendations={result.recommendations} level={4} />

                    <div className="applyforjobs-result">
                        <div className="applyforjobs-section-header">
                            <h4 ref={resultHeadingRef} tabIndex={-1} className="mb-0">
                                Cover Letter
                            </h4>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => downloadPdf('Cover Letter', result.coverLetter)}
                                >
                                    <PrintIcon />
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="applyforjobs-editor form-control"
                            aria-label="Cover letter markdown (editable)"
                            value={result.coverLetter}
                            onChange={(e) => updateOutput('coverLetter', e.target.value)}
                        />
                    </div>

                    <div className="applyforjobs-result">
                        <div className="applyforjobs-section-header">
                            <h4 className="mb-0">Resume</h4>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => downloadPdf('Resume', result.resume)}
                                >
                                    <PrintIcon />
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="applyforjobs-editor form-control"
                            aria-label="Resume markdown (editable)"
                            value={result.resume}
                            onChange={(e) => updateOutput('resume', e.target.value)}
                        />
                    </div>

                    <button className="btn btn-outline-secondary" onClick={startOver}>
                        Start over
                    </button>
                </>
            )}

            {viewing && (
                <div className="applyforjobs-history-detail">
                    <button
                        className="btn btn-outline-secondary btn-sm mb-3"
                        onClick={() => {
                            setConfirmingDelete(false);
                            setViewingId(null);
                        }}
                    >
                        Back
                    </button>

                    <h4 className="mb-1">
                        {viewing.company || '—'} — {viewing.position || '—'}
                    </h4>
                    <p style={{ color: '#666' }}>
                        {viewing.createdAtMs
                            ? new Date(viewing.createdAtMs).toLocaleString()
                            : '—'}
                    </p>

                    <h5 className="mt-4">Job posting</h5>
                    <div
                        className="applyforjobs-readonly"
                        dangerouslySetInnerHTML={renderMarkdown(viewing.jobPosting)}
                    />

                    {viewing.applicantContext && (
                        <>
                            <h5 className="mt-4">Additional context</h5>
                            <div
                                className="applyforjobs-readonly"
                                dangerouslySetInnerHTML={renderMarkdown(
                                    viewing.applicantContext
                                )}
                            />
                        </>
                    )}

                    <div className="mt-4">
                        <Recommendations recommendations={viewing.recommendations} level={5} />
                    </div>

                    <div className="applyforjobs-section-header mt-4">
                        <h5 className="mb-0">Cover Letter</h5>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => downloadPdf('Cover Letter', viewing.coverLetter)}
                        >
                            <PrintIcon />
                        </button>
                    </div>
                    <div
                        className="applyforjobs-readonly"
                        dangerouslySetInnerHTML={renderMarkdown(viewing.coverLetter)}
                    />

                    <div className="applyforjobs-section-header mt-4">
                        <h5 className="mb-0">Resume</h5>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => downloadPdf('Resume', viewing.resume)}
                        >
                            <PrintIcon />
                        </button>
                    </div>
                    <div
                        className="applyforjobs-readonly"
                        dangerouslySetInnerHTML={renderMarkdown(viewing.resume)}
                    />

                    <div className="mt-4 d-flex gap-2 align-items-center">
                        {confirmingDelete ? (
                            <>
                                <span>Delete this application?</span>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDelete(viewing)}
                                >
                                    Confirm delete
                                </button>
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setConfirmingDelete(false)}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setConfirmingDelete(true)}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApplyForJobs;

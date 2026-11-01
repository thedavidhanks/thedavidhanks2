import React, { useEffect, useRef, useState } from 'react';
import {
    createApplication,
    deleteApplication,
    subscribeToApplications,
    updateApplicationOutputs,
} from './history.js';
import DocumentWorkspace from './DocumentWorkspace.jsx';
import { formatDate } from './format.js';
import HistoryList from './HistoryList.jsx';
import ProgressModal from './ProgressModal.jsx';
import Recommendations from './Recommendations.jsx';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from './icons.jsx';
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

// Edits to the result are mirrored back to Firestore. Without a debounce
// every keystroke would be a write, which is pointless and would chew through
// the 20k/day free write quota.
const SAVE_DEBOUNCE_MS = 1500;

// "Company — Position" for the result header, falling back to whichever the
// user filled in, or a neutral title when both were left blank.
const titleFor = (company, position) => {
    if (company && position) return `${company} — ${position}`;
    return company || position || 'Your documents';
};

const ApplyForJobs = ({ user }) => {
    const uid = user?.uid || null;

    const [jobPosting, setJobPosting] = useState('');
    const [applicantContext, setApplicantContext] = useState('');
    const [company, setCompany] = useState('');
    const [position, setPosition] = useState('');
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
    // 'compose' holds the form and the live result; 'history' holds the
    // saved-applications list and, when viewingId is set, one record.
    const [view, setView] = useState('compose');

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

    // Same reasoning for the history detail: the list row that opened it is
    // gone, so put focus on the record's heading.
    const detailHeadingRef = useRef(null);
    const viewingRecordId = viewing?.id;
    useEffect(() => {
        if (viewingRecordId) detailHeadingRef.current?.focus();
    }, [viewingRecordId]);

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
        setResult(null);
        setError('');
        setSaveError('');
        setSavedId(null);
        setView('compose');
    };

    const showCompose = () => {
        setConfirmingDelete(false);
        setView('compose');
    };

    const showHistory = () => {
        setConfirmingDelete(false);
        setViewingId(null);
        setView('history');
    };

    const openApplication = (id) => {
        setConfirmingDelete(false);
        setViewingId(id);
        setView('history');
    };

    const wordCount = jobPosting.trim() ? jobPosting.trim().split(/\s+/).length : 0;
    const resultTitle = titleFor(company.trim(), position.trim());
    let saveStatus = 'Saving to Past applications…';
    if (savedId) saveStatus = 'Saved to Past applications. Edits save automatically.';
    else if (saveError) saveStatus = 'Not saved to Past applications.';

    return (
        <div className="applyforjobs-container">
            <header className="afj-header">
                <div>
                    <h3 className="afj-title">Apply for Jobs</h3>
                    <p className="afj-lede">
                        Paste a job posting and get a tailored cover letter and resume.
                    </p>
                </div>
                {uid && (
                    <nav aria-label="Apply for Jobs views">
                        <ul className="nav nav-underline afj-views">
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link${view === 'compose' ? ' active' : ''}`}
                                    aria-current={view === 'compose' ? 'page' : undefined}
                                    onClick={showCompose}
                                >
                                    New application
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link${view === 'history' ? ' active' : ''}`}
                                    aria-current={view === 'history' ? 'page' : undefined}
                                    onClick={showHistory}
                                >
                                    Past applications
                                    {applications.length > 0 && (
                                        <span className="afj-count">{applications.length}</span>
                                    )}
                                </button>
                            </li>
                        </ul>
                    </nav>
                )}
            </header>

            {saveError && (
                <div className="alert alert-warning" role="status">{saveError}</div>
            )}

            <ProgressModal
                show={loading}
                elapsedSeconds={elapsedSeconds}
                company={company.trim()}
                position={position.trim()}
                onCancel={cancelGeneration}
            />

            {view === 'compose' && !result && (
                <form className="afj-compose" onSubmit={handleSubmit}>
                    <div className="afj-compose-main">
                        <div className="afj-field-head">
                            <label htmlFor="jobPosting" className="form-label">
                                Job posting <span className="afj-required" aria-hidden="true">*</span>
                            </label>
                            {wordCount > 0 && (
                                <span className="afj-hint">
                                    {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
                                </span>
                            )}
                        </div>
                        <textarea
                            id="jobPosting"
                            className="form-control afj-posting"
                            placeholder="Paste the full job description: responsibilities, requirements, and anything about the team."
                            aria-required="true"
                            value={jobPosting}
                            onChange={(e) => setJobPosting(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="afj-compose-side">
                        <div className="afj-panel">
                            <div className="afj-field">
                                <label htmlFor="company" className="form-label">Company</label>
                                <input
                                    id="company"
                                    type="text"
                                    className="form-control"
                                    placeholder="Optional"
                                    autoComplete="organization"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="afj-field">
                                <label htmlFor="position" className="form-label">Position</label>
                                <input
                                    id="position"
                                    type="text"
                                    className="form-control"
                                    placeholder="Optional"
                                    autoComplete="organization-title"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="afj-field">
                                <label htmlFor="applicantContext" className="form-label">
                                    Additional context <span className="afj-hint">Optional</span>
                                </label>
                                <textarea
                                    id="applicantContext"
                                    className="form-control"
                                    rows={5}
                                    placeholder="e.g. target tone, experience to emphasize, or anything the posting leaves out"
                                    value={applicantContext}
                                    onChange={(e) => setApplicantContext(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <div className="alert alert-danger mb-0" role="alert">{error}</div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary afj-submit"
                                disabled={loading || !jobPosting.trim()}
                            >
                                {loading ? 'Generating…' : 'Generate cover letter & resume'}
                            </button>
                            <p className="afj-hint afj-submit-note">
                                Usually takes under a minute. Results are saved to Past applications.
                            </p>
                        </div>
                    </div>
                </form>
            )}

            {view === 'compose' && result && (
                <section className="afj-workspace" aria-labelledby="afj-result-title">
                    <div className="afj-workspace-head">
                        <div>
                            <h4
                                id="afj-result-title"
                                ref={resultHeadingRef}
                                tabIndex={-1}
                                className="afj-workspace-title"
                            >
                                {resultTitle}
                            </h4>
                            {uid && <p className="afj-meta">{saveStatus}</p>}
                        </div>
                        <div className="afj-workspace-actions">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary afj-tool"
                                onClick={startOver}
                            >
                                <PlusIcon />Start over
                            </button>
                        </div>
                    </div>
                    <div className={`afj-workspace-grid${result.recommendations ? ' has-rail' : ''}`}>
                        {result.recommendations && (
                            <aside className="afj-rail" aria-label="Fit report">
                                <Recommendations recommendations={result.recommendations} level={5} />
                            </aside>
                        )}
                        <div className="afj-workspace-main">
                            <DocumentWorkspace
                                id="afj-result-docs"
                                editable
                                documents={[
                                    {
                                        key: 'coverLetter',
                                        label: 'Cover letter',
                                        markdown: result.coverLetter,
                                        pdfTitle: 'Cover Letter',
                                        ariaLabel: 'Cover letter markdown (editable)',
                                        onChange: (value) => updateOutput('coverLetter', value),
                                    },
                                    {
                                        key: 'resume',
                                        label: 'Resume',
                                        markdown: result.resume,
                                        pdfTitle: 'Resume',
                                        ariaLabel: 'Resume markdown (editable)',
                                        onChange: (value) => updateOutput('resume', value),
                                    },
                                ]}
                            />
                        </div>
                    </div>
                </section>
            )}

            {view === 'history' && !viewing && (
                <HistoryList
                    applications={applications}
                    onOpen={openApplication}
                    onNew={showCompose}
                />
            )}

            {view === 'history' && viewing && (
                <section
                    className="afj-workspace applyforjobs-history-detail"
                    aria-labelledby="afj-detail-title"
                >
                    <button type="button" className="btn btn-link afj-back" onClick={showHistory}>
                        <ArrowLeftIcon />All past applications
                    </button>
                    <div className="afj-workspace-head">
                        <div>
                            <h4
                                id="afj-detail-title"
                                ref={detailHeadingRef}
                                tabIndex={-1}
                                className="afj-workspace-title"
                            >
                                {viewing.company || '—'} — {viewing.position || '—'}
                            </h4>
                            <p className="afj-meta">{formatDate(viewing.createdAtMs)}</p>
                        </div>
                        <div className="afj-workspace-actions">
                            {confirmingDelete ? (
                                <>
                                    <span className="afj-confirm-text">Delete this application?</span>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDelete(viewing)}
                                    >
                                        Confirm delete
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setConfirmingDelete(false)}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger afj-tool"
                                    onClick={() => setConfirmingDelete(true)}
                                >
                                    <TrashIcon />Delete
                                </button>
                            )}
                        </div>
                    </div>
                    <div className={`afj-workspace-grid${viewing.recommendations ? ' has-rail' : ''}`}>
                        {viewing.recommendations && (
                            <aside className="afj-rail" aria-label="Fit report">
                                <Recommendations recommendations={viewing.recommendations} level={5} />
                            </aside>
                        )}
                        <div className="afj-workspace-main">
                            {/* Keyed by record so switching records resets the open tab. */}
                            <DocumentWorkspace
                                key={viewing.id}
                                id="afj-detail-docs"
                                documents={[
                                    { key: 'coverLetter', label: 'Cover letter', markdown: viewing.coverLetter, pdfTitle: 'Cover Letter' },
                                    { key: 'resume', label: 'Resume', markdown: viewing.resume, pdfTitle: 'Resume' },
                                    { key: 'jobPosting', label: 'Job posting', markdown: viewing.jobPosting },
                                    ...(viewing.applicantContext
                                        ? [{ key: 'context', label: 'Your context', markdown: viewing.applicantContext }]
                                        : []),
                                ]}
                            />
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default ApplyForJobs;

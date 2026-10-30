import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import ApplyForJobs from './index.jsx';
import { firestoreMock } from '../../../firebase.js';
import { server, fixtures, APPLICATION_URL, APPLICATION_API_KEY } from '../../../test/server.js';

const UID = 'test-uid';
// users/{uid}/jobApplications — the path history.js builds.
const PATH = `users/${UID}/jobApplications`;

// The component renders dates with toLocaleString(), which is locale- and
// timezone-dependent, so the expected label is computed the same way rather
// than hardcoded.
const labelFor = ({ createdAtMs, company, position }) =>
    `${new Date(createdAtMs).toLocaleString()} - ${company} ${position}`;

const SAVED = [
    {
        id: 'app-new',
        schemaVersion: 1,
        company: 'Globex',
        position: 'Principal Engineer',
        createdAtMs: Date.UTC(2026, 9, 28, 15, 4, 5),
        jobPosting: 'Globex is hiring a principal engineer.',
        applicantContext: 'Emphasize distributed systems.',
        coverLetter: '# Globex cover letter',
        resume: '# Globex resume',
        sessionId: 'apply-session-9',
    },
    {
        id: 'app-old',
        schemaVersion: 1,
        company: 'Acme Corp',
        position: 'Staff Engineer',
        createdAtMs: Date.UTC(2026, 8, 1, 9, 30, 0),
        jobPosting: 'Acme is hiring a staff engineer.',
        applicantContext: '',
        coverLetter: '# Acme cover letter',
        resume: '# Acme resume',
        sessionId: 'apply-session-1',
    },
];

// The subscription is created in an effect, so the snapshot has to be pushed
// after the first render.
const pushSnapshot = (records) => act(() => firestoreMock.emit(PATH, records));

const renderTool = () => render(<ApplyForJobs user={{ uid: UID }} />);

const openHistoryMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Past applications' }));
    return document.querySelector('.dropdown-menu.show') ?? document.querySelector('.dropdown-menu');
};

const generate = async (user, { company, position, posting, context } = {}) => {
    if (company) await user.type(screen.getByLabelText('Company'), company);
    if (position) await user.type(screen.getByLabelText('Position'), position);
    await user.type(screen.getByLabelText(/Job posting/), posting);
    if (context) {
        await user.click(screen.getByRole('button', { name: /optional context/ }));
        await user.type(screen.getByPlaceholderText(/target tone/), context);
    }
    await user.click(screen.getByRole('button', { name: /Generate Cover Letter/ }));
};

describe('ApplyForJobs history', () => {
    let collection;

    beforeEach(() => {
        // Memoized by path, so this is the exact stub history.js will reach.
        collection = firestoreMock.collection(PATH);
    });

    it('writes a record with both inputs and both outputs on a successful generation', async () => {
        server.use(
            http.get(`${APPLICATION_URL}/:jobId`, () =>
                HttpResponse.json({
                    ...fixtures.complete,
                    coverLetter: 'Dear Acme',
                    resume: 'Resume body',
                    sessionId: 'apply-session-1',
                })
            )
        );
        const user = userEvent.setup();
        renderTool();

        await generate(user, {
            company: 'Acme Corp',
            position: 'Staff Engineer',
            posting: 'Acme is hiring a staff engineer.',
            context: 'Emphasize distributed systems.',
        });

        expect(
            await screen.findByLabelText('Cover letter markdown (editable)')
        ).toHaveValue('Dear Acme');

        await waitFor(() => expect(collection.add).toHaveBeenCalledTimes(1));
        expect(collection.add.mock.calls[0][0]).toMatchObject({
            company: 'Acme Corp',
            position: 'Staff Engineer',
            jobPosting: 'Acme is hiring a staff engineer.',
            applicantContext: 'Emphasize distributed systems.',
            coverLetter: 'Dear Acme',
            resume: 'Resume body',
            recommendations: fixtures.complete.recommendations,
            sessionId: 'apply-session-1',
        });
        expect(typeof collection.add.mock.calls[0][0].createdAtMs).toBe('number');
    });

    it('stores recommendations as null when the job completed without a fit report', async () => {
        server.use(
            http.get(`${APPLICATION_URL}/:jobId`, () =>
                HttpResponse.json(fixtures.completeNoRecs)
            )
        );
        const user = userEvent.setup();
        renderTool();

        await generate(user, { posting: 'Acme is hiring.' });
        await screen.findByLabelText('Cover letter markdown (editable)');

        await waitFor(() => expect(collection.add).toHaveBeenCalledTimes(1));
        expect(collection.add.mock.calls[0][0].recommendations).toBeNull();
    });

    it('keeps the generated result on screen and shows a non-blocking notice when the write fails', async () => {
        collection.add.mockRejectedValueOnce(new Error('permission-denied'));
        const user = userEvent.setup();
        renderTool();

        await generate(user, { posting: 'Acme is hiring a staff engineer.' });

        // The generation succeeded, so the output must survive the save failure.
        expect(
            await screen.findByLabelText('Cover letter markdown (editable)')
        ).toHaveValue(fixtures.complete.coverLetter);
        expect(screen.getByLabelText('Resume markdown (editable)')).toHaveValue(
            fixtures.complete.resume
        );

        // Non-blocking notice: alert-warning + role="status" ...
        const notice = await screen.findByRole('status');
        expect(notice).toHaveTextContent(/save this to your history/i);
        expect(notice).toHaveClass('alert-warning');

        // ... and explicitly NOT the red "generation failed" alert.
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(document.querySelector('.alert-danger')).toBeNull();
    });

    it('lists saved applications newest-first as "{datetime} - {company} {position}"', async () => {
        const user = userEvent.setup();
        renderTool();

        // Ordering is the query's job, so assert the query and then that the
        // menu preserves the order the snapshot arrives in.
        expect(collection.orderBy).toHaveBeenCalledWith('createdAtMs', 'desc');
        expect(collection.limit).toHaveBeenCalledWith(50);

        expect(await openHistoryMenu(user)).toHaveTextContent(
            'No saved applications yet'
        );

        pushSnapshot(SAVED);
        const menu = await openHistoryMenu(user);
        const items = within(menu)
            .getAllByRole('button')
            .map((item) => item.textContent);

        expect(items).toEqual([labelFor(SAVED[0]), labelFor(SAVED[1])]);
        expect(SAVED[0].createdAtMs).toBeGreaterThan(SAVED[1].createdAtMs);
    });

    it('renders a saved record read-only, with no editable control in the detail view', async () => {
        const user = userEvent.setup();
        renderTool();
        pushSnapshot(SAVED);

        const menu = await openHistoryMenu(user);
        await user.click(within(menu).getByRole('button', { name: labelFor(SAVED[0]) }));

        const detail = document.querySelector('.applyforjobs-history-detail');
        expect(detail).not.toBeNull();
        const panel = within(detail);

        // Header, inputs and outputs are all rendered.
        expect(
            panel.getByRole('heading', { name: /Globex — Principal Engineer/ })
        ).toBeInTheDocument();
        expect(
            panel.getByText(new Date(SAVED[0].createdAtMs).toLocaleString())
        ).toBeInTheDocument();
        expect(panel.getByText(SAVED[0].jobPosting)).toBeInTheDocument();
        expect(panel.getByText(SAVED[0].applicantContext)).toBeInTheDocument();
        expect(panel.getByText('Globex cover letter')).toBeInTheDocument();
        expect(panel.getByText('Globex resume')).toBeInTheDocument();

        // Read-only means rendered markdown, not disabled textareas.
        expect(panel.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    });

    it('deletes the viewed record after confirmation and returns to the form', async () => {
        const user = userEvent.setup();
        renderTool();
        pushSnapshot(SAVED);

        const menu = await openHistoryMenu(user);
        await user.click(within(menu).getByRole('button', { name: labelFor(SAVED[0]) }));
        expect(screen.queryByLabelText(/Job posting/)).not.toBeInTheDocument();

        // Deleting is a two-step confirm.
        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(screen.getByText('Delete this application?')).toBeInTheDocument();
        const docRef = firestoreMock.doc(PATH, SAVED[0].id);
        expect(docRef.delete).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
        await waitFor(() => expect(docRef.delete).toHaveBeenCalledTimes(1));

        // Firestore would push the shortened list back down the subscription.
        pushSnapshot(SAVED.slice(1));

        await waitFor(() =>
            expect(screen.getByLabelText(/Job posting/)).toBeInTheDocument()
        );
        expect(document.querySelector('.applyforjobs-history-detail')).toBeNull();

        const remaining = await openHistoryMenu(user);
        expect(within(remaining).getAllByRole('button')).toHaveLength(1);
        expect(remaining).toHaveTextContent(labelFor(SAVED[1]));
        expect(remaining).not.toHaveTextContent(labelFor(SAVED[0]));
    });
});

describe('ApplyForJobs history with recommendations', () => {
    const POSITION = 'Senior Full Stack Engineer — Northwind Health';
    const withRecs = {
        ...SAVED[0],
        id: 'app-recs',
        coverLetter: '# Recs cover letter',
        resume: '# Recs resume',
        recommendations: fixtures.complete.recommendations,
    };
    const nullRecs = { ...SAVED[1], id: 'app-null', recommendations: null };
    // SAVED[*] predate the field entirely: no `recommendations` key.

    const openSaved = async (user, record) => {
        renderTool();
        pushSnapshot([record]);
        const menu = await openHistoryMenu(user);
        await user.click(within(menu).getByRole('button', { name: labelFor(record) }));
        return document.querySelector('.applyforjobs-history-detail');
    };

    it('saves the recommendations object with the generated documents', async () => {
        const collection = firestoreMock.collection(PATH);
        const user = userEvent.setup();
        renderTool();
        await generate(user, { posting: 'Northwind is hiring.' });
        await screen.findByLabelText('Cover letter markdown (editable)');

        await waitFor(() => expect(collection.add).toHaveBeenCalled());
        const saved = collection.add.mock.calls.at(-1)[0];
        expect(saved.recommendations).toEqual(fixtures.complete.recommendations);
        expect(saved).toMatchObject({
            coverLetter: fixtures.complete.coverLetter,
            resume: fixtures.complete.resume,
            sessionId: fixtures.complete.sessionId,
        });
    });

    it('shows the collapsed panel first when a saved entry is loaded, and expands it', async () => {
        const user = userEvent.setup();
        const detail = await openSaved(user, withRecs);

        const toggle = within(detail).getByRole('button', { name: 'Fit score: 62/100' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        // Sits at h5 beside the history view's other h5 sections.
        expect(toggle.closest('h5')).not.toBeNull();
        const panel = detail.querySelector('.applyforjobs-recommendations');
        expect(panel.querySelector('.accordion-collapse')).not.toHaveClass('show');
        // Above the cover letter.
        const cover = within(detail).getByRole('heading', { name: 'Cover Letter' });
        expect(
            panel.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const heading = await within(detail).findByRole('heading', { name: POSITION });
        expect(heading.textContent).not.toContain('---');
    });

    it.each([
        ['a legacy entry with no recommendations field', SAVED[0]],
        ['an entry saved with recommendations: null', nullRecs],
    ])('omits the panel and does not crash for %s', async (_label, record) => {
        const user = userEvent.setup();
        const detail = await openSaved(user, record);

        expect(detail).not.toBeNull();
        expect(detail.querySelector('.applyforjobs-recommendations')).toBeNull();
        expect(within(detail).queryByText(/Fit score/)).not.toBeInTheDocument();
        expect(within(detail).getByRole('heading', { name: 'Cover Letter' })).toBeInTheDocument();
    });
});

describe('ApplyForJobs async generation', () => {
    const POSITION = 'Senior Full Stack Engineer — Northwind Health';
    const JOB_URL = `${APPLICATION_URL}/:jobId`;

    // Fake only what the component schedules with; leaving promises/nextTick
    // real lets MSW and fetch resolve normally.
    const useFakeClock = () =>
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

    // userEvent typing under fake timers is slow and fiddly; fire a change.
    const submitPosting = (posting = 'Northwind is hiring.') => {
        fireEvent.change(screen.getByLabelText(/Job posting/), { target: { value: posting } });
        fireEvent.click(screen.getByRole('button', { name: /Generate Cover Letter/ }));
    };

    // Records every poll so tests can assert on count and spacing.
    const recordPolls = (respond) => {
        const polls = [];
        server.use(
            http.get(JOB_URL, ({ request, params }) => {
                polls.push({ at: Date.now(), jobId: params.jobId, key: request.headers.get('x-api-key') });
                return respond(polls.length);
            })
        );
        return polls;
    };

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sends the documented request, shows a modal while polling, then renders results with a collapsed recommendations panel first', async () => {
        const posts = [];
        server.use(
            http.post(APPLICATION_URL, async ({ request }) => {
                posts.push({ key: request.headers.get('x-api-key'), body: await request.json() });
                return HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 0.05 }, { status: 202 });
            })
        );
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const polls = [];
        server.use(
            http.get(JOB_URL, async ({ request, params }) => {
                polls.push({ jobId: params.jobId, key: request.headers.get('x-api-key') });
                await gate;
                return HttpResponse.json(fixtures.complete);
            })
        );
        const user = userEvent.setup();
        renderTool();

        await generate(user, { posting: 'Northwind is hiring.', context: 'Focus on serverless.' });

        // Modal: non-dismissable, labelled, spinner + status + elapsed time.
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveAccessibleName('Generating your cover letter and resume');
        expect(dialog).toHaveAccessibleDescription(/keep this page open/i);
        expect(within(dialog).getByRole('timer')).toHaveTextContent(/Elapsed time: 0:0\d/);
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(document.querySelector('.modal.show')).not.toBeNull();

        release();

        expect(
            await screen.findByLabelText('Cover letter markdown (editable)')
        ).toHaveValue(fixtures.complete.coverLetter);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        // Request shape: header, body, and no includeRecommendations.
        expect(posts).toHaveLength(1);
        expect(posts[0].key).toBe(APPLICATION_API_KEY);
        expect(posts[0].body).toEqual({
            jobPosting: 'Northwind is hiring.',
            applicantContext: 'Focus on serverless.',
        });
        expect(posts[0].body).not.toHaveProperty('includeRecommendations');
        // Polled by jobId (not sessionId), with the key.
        expect(polls[0]).toEqual({ jobId: fixtures.accepted202.jobId, key: APPLICATION_API_KEY });

        // Recommendations come first, collapsed, showing only the score.
        const toggle = screen.getByRole('button', { name: 'Fit score: 62/100' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        const panel = document.querySelector('.applyforjobs-recommendations');
        const coverHeading = screen.getByRole('heading', { name: 'Cover Letter' });
        expect(
            panel.compareDocumentPosition(coverHeading) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(panel.querySelector('.accordion-collapse')).not.toHaveClass('show');

        // Accessibility: focus lands on the results, and the panel's header is
        // an h4 like "Cover Letter" (not Bootstrap's default h2 under the h3 title).
        expect(coverHeading).toHaveFocus();
        expect(toggle.closest('h4')).not.toBeNull();
    });

    it('expanding the panel reveals the report, and the position heading has no stray rule', async () => {
        const user = userEvent.setup();
        renderTool();
        await generate(user, { posting: 'Northwind is hiring.' });

        const toggle = await screen.findByRole('button', { name: 'Fit score: 62/100' });
        await user.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const heading = await screen.findByRole('heading', { name: POSITION });
        expect(heading.textContent).not.toContain('---');
        expect(heading.textContent.trim()).toBe(POSITION);
        const panel = document.querySelector('.applyforjobs-recommendations');
        expect(within(panel).getByText('Strengths')).toBeInTheDocument();
        expect(within(panel).getByText('Gaps')).toBeInTheDocument();
        expect(within(panel).getByText('Recommended skills')).toBeInTheDocument();
        expect(panel.textContent).not.toContain('**');
    });

    it('omits the panel when recommendations is null but still shows the documents', async () => {
        server.use(
            http.get(JOB_URL, () => HttpResponse.json(fixtures.completeNoRecs))
        );
        const user = userEvent.setup();
        renderTool();
        await generate(user, { posting: 'Northwind is hiring.' });

        expect(
            await screen.findByLabelText('Cover letter markdown (editable)')
        ).toHaveValue(fixtures.completeNoRecs.coverLetter);
        expect(screen.getByLabelText('Resume markdown (editable)')).toHaveValue(
            fixtures.completeNoRecs.resume
        );
        expect(document.querySelector('.applyforjobs-recommendations')).toBeNull();
        expect(screen.queryByText(/Fit score/)).not.toBeInTheDocument();
    });

    it('lets the user cancel from the modal, stopping the poll loop', async () => {
        useFakeClock();
        server.use(
            http.post(APPLICATION_URL, () =>
                HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 10 }, { status: 202 })
            )
        );
        const polls = recordPolls(() => HttpResponse.json(fixtures.running));
        renderTool();
        submitPosting();
        await act(() => vi.advanceTimersByTimeAsync(10500));
        expect(polls).toHaveLength(1);

        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // Back on the form with the posting intact, ready to resubmit.
        expect(screen.getByLabelText(/Job posting/)).toHaveValue('Northwind is hiring.');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(60000));
        expect(polls).toHaveLength(1);
    });

    it('does not trap the user behind the modal when a poll request hangs', async () => {
        useFakeClock();
        let hits = 0;
        server.use(
            http.post(APPLICATION_URL, () =>
                HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 10 }, { status: 202 })
            ),
            http.get(JOB_URL, () => {
                hits += 1;
                return new Promise(() => {}); // never responds
            })
        );
        renderTool();
        submitPosting();

        // Each attempt: 10s wait + 20s request timeout. Three strikes, then out.
        await act(() => vi.advanceTimersByTimeAsync(95000));
        expect(hits).toBe(3);
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows a generic retry message and closes the modal when the job failed', async () => {
        server.use(http.get(JOB_URL, () => HttpResponse.json(fixtures.failed)));
        const user = userEvent.setup();
        renderTool();
        await generate(user, { posting: 'Northwind is hiring.' });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/didn't work.*try again/i);
        // The server's error string is generic by design and must not leak through.
        expect(alert).not.toHaveTextContent(fixtures.failed.error);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // The form stays so the user can retry.
        expect(screen.getByLabelText(/Job posting/)).toHaveValue('Northwind is hiring.');
    });

    it('treats a 404 as "result gone" and stops polling', async () => {
        const polls = recordPolls(() => HttpResponse.json(fixtures.notFound, { status: 404 }));
        const user = userEvent.setup();
        renderTool();
        await generate(user, { posting: 'Northwind is hiring.' });

        expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(polls).toHaveLength(1);
    });

    it.each([
        [400, fixtures.bad400, /couldn't be submitted/i],
        [403, { message: 'Forbidden' }, /access denied/i],
        [500, { error: 'Failed to start application job' }, /trouble starting.*try again/i],
    ])('shows a sensible error when submit returns %i', async (status, body, message) => {
        let polled = false;
        server.use(
            http.post(APPLICATION_URL, () => HttpResponse.json(body, { status })),
            http.get(JOB_URL, () => {
                polled = true;
                return HttpResponse.json(fixtures.complete);
            })
        );
        const user = userEvent.setup();
        renderTool();
        await generate(user, { posting: 'x' });

        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(polled).toBe(false);
    });

    it('honors pollAfterSeconds for the first poll and between polls, and keeps waiting through pending/running', async () => {
        useFakeClock();
        server.use(
            http.post(APPLICATION_URL, () =>
                HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 3 }, { status: 202 })
            )
        );
        const polls = recordPolls((n) =>
            HttpResponse.json(n === 1 ? fixtures.pending : n === 2 ? fixtures.running : fixtures.complete)
        );
        renderTool();
        const start = Date.now();
        submitPosting();

        // Nothing is polled before the first interval elapses.
        await act(() => vi.advanceTimersByTimeAsync(2900));
        expect(polls).toHaveLength(0);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(200));
        expect(polls).toHaveLength(1);
        await act(() => vi.advanceTimersByTimeAsync(3000));
        expect(polls).toHaveLength(2);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await act(() => vi.advanceTimersByTimeAsync(3000));

        expect(polls).toHaveLength(3);
        expect(polls.map((p) => Math.round((p.at - start) / 1000))).toEqual([3, 6, 9]);
        expect(polls[0].jobId).toBe(fixtures.accepted202.jobId);
        expect(polls[0].key).toBe(APPLICATION_API_KEY);
        // waitFor/find* hang under vitest fake timers, so settle by hand.
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(screen.getByLabelText('Cover letter markdown (editable)')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // Done: no more polls, and nothing left scheduled once one-shots drain.
        await act(() => vi.advanceTimersByTimeAsync(60000));
        expect(polls).toHaveLength(3);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('counts up elapsed time in the modal', async () => {
        useFakeClock();
        server.use(
            http.get(JOB_URL, () => HttpResponse.json(fixtures.running)),
            http.post(APPLICATION_URL, () =>
                HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 10 }, { status: 202 })
            )
        );
        renderTool();
        submitPosting();

        await act(() => vi.advanceTimersByTimeAsync(65000));
        expect(screen.getByRole('timer')).toHaveTextContent('Elapsed time: 1:05');
    });

    it('stops polling and clears every timer when unmounted mid-poll', async () => {
        useFakeClock();
        server.use(
            http.post(APPLICATION_URL, () =>
                HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 10 }, { status: 202 })
            )
        );
        const polls = recordPolls(() => HttpResponse.json(fixtures.running));
        const { unmount } = renderTool();
        submitPosting();

        await act(() => vi.advanceTimersByTimeAsync(10500));
        expect(polls).toHaveLength(1);
        expect(vi.getTimerCount()).toBeGreaterThan(0);

        const beforeUnmount = vi.getTimerCount();
        unmount();
        // Both of the component's timers (poll sleep, elapsed interval) are
        // gone; whatever is left is a one-shot from the modal's teardown.
        expect(vi.getTimerCount()).toBeLessThan(beforeUnmount - 1);
        await act(() => vi.advanceTimersByTimeAsync(120000));
        expect(polls).toHaveLength(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('gives up after about five minutes with a timeout message', async () => {
        useFakeClock();
        server.use(
            http.post(APPLICATION_URL, () =>
                HttpResponse.json({ ...fixtures.accepted202, pollAfterSeconds: 10 }, { status: 202 })
            )
        );
        const polls = recordPolls(() => HttpResponse.json(fixtures.pending));
        renderTool();
        submitPosting();

        await act(() => vi.advanceTimersByTimeAsync(290000));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(15000));
        expect(screen.getByRole('alert')).toHaveTextContent(/taking longer than expected/i);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(polls.length).toBeGreaterThanOrEqual(29);
        expect(polls.length).toBeLessThanOrEqual(31);

        const count = polls.length;
        await act(() => vi.advanceTimersByTimeAsync(60000));
        expect(polls).toHaveLength(count);
        expect(vi.getTimerCount()).toBe(0);
    });
});

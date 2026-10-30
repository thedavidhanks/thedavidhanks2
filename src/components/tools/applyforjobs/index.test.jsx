import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import ApplyForJobs from './index.jsx';
import { firestoreMock } from '../../../firebase.js';
import { server, APPLY_URL } from '../../../test/server.js';

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
            http.post(APPLY_URL, () =>
                HttpResponse.json({
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
            sessionId: 'apply-session-1',
        });
        expect(typeof collection.add.mock.calls[0][0].createdAtMs).toBe('number');
    });

    it('keeps the generated result on screen and shows a non-blocking notice when the write fails', async () => {
        collection.add.mockRejectedValueOnce(new Error('permission-denied'));
        const user = userEvent.setup();
        renderTool();

        await generate(user, { posting: 'Acme is hiring a staff engineer.' });

        // The generation succeeded, so the output must survive the save failure.
        expect(
            await screen.findByLabelText('Cover letter markdown (editable)')
        ).toHaveValue('# Mocked cover letter');
        expect(screen.getByLabelText('Resume markdown (editable)')).toHaveValue(
            '# Mocked resume'
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

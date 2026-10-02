import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import App from './App.jsx';
import { toollist } from './components/tools/toollist.jsx';
import { projectlist } from './components/projects/projectlist.jsx';
import { auth } from './firebase.js';
import { server, ASK_URL, APPLY_URL } from './test/server.js';

// The spec: every leaf URL the app serves and a heading that only that page
// renders. URLs are written out literally (not derived from the tables) so
// renaming a route without updating this list fails, and the coverage test
// below fails if a tool or project is added without an entry here.
const PAGES = {
    '/': "Greetings! I'm David Hanks.",
    '/about': "Greetings! I'm David Hanks.",
    '/askme': 'Ask Me Anything',

    '/tools/applyforjobs': 'Apply for Jobs',
    '/tools/satisfactory-sink': 'Satisfactory Sink Maximizer',
    '/tools/nwmap': 'New World',

    // ProjectHome is mounted at /projects/* and each project's path already
    // starts with "projects/", so project pages live at /projects/projects/*.
    // That is what the cards link to today; this pins it.
    '/projects/projects/gps-tracker': 'GPS Tracker',
    '/projects/projects/cellantenna': 'Cricket Antenna',
    '/projects/projects/shearcalculator': 'Shear Calculator',
    '/projects/projects/kaleidoscope': 'Kaleidoscope',
    '/projects/projects/temphumiditysensor': 'Temperature & Humidity Sensor',
    '/projects/projects/pythonreport': 'Python Report Generator',
    '/projects/projects/jobcomparer': 'Android Job Evaluator',
};

const toolUrl = (tool) => `/tools/${tool.path}`;
const projectUrl = (project) => `/projects/${project.path}`;
const gatedUrls = new Set(toollist.filter((t) => t.requireAuth).map(toolUrl));

const renderAt = (url) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <App />
        </MemoryRouter>
    );

const main = () => within(screen.getByRole('main'));

const signInFromGate = async (user) => {
    expect(main().getByRole('heading', { name: 'Login required' })).toBeInTheDocument();
    await user.click(main().getByRole('button', { name: 'Login' }));
};

describe('route table coverage', () => {
    it('has a PAGES entry for every tool and project', () => {
        const fromTables = [...toollist.map(toolUrl), ...projectlist.map(projectUrl)].sort();
        const listed = Object.keys(PAGES)
            .filter((url) => url.startsWith('/tools/') || url.startsWith('/projects/'))
            .sort();
        expect(listed).toEqual(fromTables);
    });
});

describe('route render smoke test', () => {
    it.each(Object.entries(PAGES))('%s renders "%s"', async (url, heading) => {
        const user = userEvent.setup();
        renderAt(url);

        if (gatedUrls.has(url)) {
            expect(main().queryByRole('heading', { name: heading })).not.toBeInTheDocument();
            await signInFromGate(user);
        }

        // findAll: some pages repeat their title in a carousel caption.
        expect(await main().findAllByRole('heading', { name: heading })).not.toHaveLength(0);
    });

    it('renders none of the page headings for an unknown URL', () => {
        renderAt('/definitely-not-a-page');
        for (const heading of new Set(Object.values(PAGES))) {
            expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
        }
    });
});

describe('index pages', () => {
    it('/tools links a card to every public tool, and each link is a real page', () => {
        renderAt('/tools');
        for (const tool of toollist) {
            const card = main().queryByRole('link', { name: new RegExp(tool.title) });
            if (tool.requireAuth) {
                expect(card).not.toBeInTheDocument();
            } else {
                expect(card).toHaveAttribute('href', toolUrl(tool));
                expect(PAGES).toHaveProperty([toolUrl(tool)]);
            }
        }
    });

    it('/tools shows gated tools once signed in', async () => {
        const user = userEvent.setup();
        renderAt('/tools');
        await user.click(screen.getByRole('button', { name: 'Login' }));
        for (const tool of toollist) {
            expect(
                await main().findByRole('link', { name: new RegExp(tool.title) })
            ).toHaveAttribute('href', toolUrl(tool));
        }
    });

    it('/projects links a card to every project, and each link is a real page', () => {
        renderAt('/projects');
        for (const project of projectlist) {
            const card = main().getByRole('link', { name: new RegExp(project.title) });
            expect(card).toHaveAttribute('href', projectUrl(project));
            expect(PAGES).toHaveProperty([projectUrl(project)]);
        }
    });
});

describe('/tools/applyforjobs auth gate', () => {
    it('signed out: shows the login prompt and not the form', () => {
        renderAt('/tools/applyforjobs');
        expect(main().getByRole('heading', { name: 'Login required' })).toBeInTheDocument();
        expect(main().queryByLabelText(/Job posting/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Apply for Jobs' })).not.toBeInTheDocument();
    });

    it('signed in: submits the posting to the apply API and shows the result', async () => {
        let body;
        server.use(
            http.post(APPLY_URL, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json({
                    coverLetter: 'Dear hiring manager',
                    resume: 'Resume body',
                    sessionId: 'apply-1',
                });
            })
        );
        const user = userEvent.setup();
        renderAt('/tools/applyforjobs');

        await signInFromGate(user);
        expect(auth.signInWithPopup).toHaveBeenCalled();

        await user.type(await main().findByLabelText(/Job posting/), 'Senior React engineer');
        await user.click(main().getByRole('button', { name: /Generate Cover Letter/ }));

        expect(await main().findByRole('heading', { name: 'Cover Letter' })).toBeInTheDocument();
        expect(main().getByLabelText('Cover letter markdown (editable)')).toHaveValue('Dear hiring manager');
        expect(main().getByLabelText('Resume markdown (editable)')).toHaveValue('Resume body');
        expect(body).toEqual({ jobPosting: 'Senior React engineer' });
    });
});

describe('/askme', () => {
    it('posts the question and reuses the returned sessionId for follow-ups', async () => {
        const bodies = [];
        server.use(
            http.post(ASK_URL, async ({ request }) => {
                bodies.push(await request.json());
                return HttpResponse.json({ answer: `Answer ${bodies.length}`, sessionId: 'ask-1' });
            })
        );
        const user = userEvent.setup();
        renderAt('/askme');
        const input = main().getByRole('textbox');

        await user.type(input, 'What do you build?');
        await user.click(main().getByRole('button', { name: 'Ask' }));
        expect(await main().findByText('Answer 1')).toBeInTheDocument();

        await user.type(input, 'Tell me more');
        await user.click(main().getByRole('button', { name: 'Ask' }));
        expect(await main().findByText('Answer 2')).toBeInTheDocument();

        expect(bodies).toEqual([
            { question: 'What do you build?' },
            { question: 'Tell me more', sessionId: 'ask-1' },
        ]);
    });
});

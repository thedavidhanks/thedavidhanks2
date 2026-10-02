import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Must match the API_URL constants in askme/index.jsx and
// tools/applyforjobs/index.jsx. setup.js fails any request that no handler
// matches, so if either URL changes the tests go red instead of hitting AWS.
export const ASK_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask';
export const APPLY_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/apply';

export const handlers = [
    http.post(ASK_URL, () =>
        HttpResponse.json({ answer: 'Mocked answer.', sessionId: 'ask-session-1' })
    ),
    http.post(APPLY_URL, () =>
        HttpResponse.json({
            coverLetter: '# Mocked cover letter',
            resume: '# Mocked resume',
            sessionId: 'apply-session-1',
        })
    ),
];

export const server = setupServer(...handlers);

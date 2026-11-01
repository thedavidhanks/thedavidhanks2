import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Real captured response bodies from the API owner. See
// docs/handoff/APPLICATION_API.md.
import accepted202 from '../../docs/handoff/fixtures/post-application-202.json';
import bad400 from '../../docs/handoff/fixtures/post-application-400.json';
import complete from '../../docs/handoff/fixtures/get-application-complete.json';
import completeNoRecs from '../../docs/handoff/fixtures/get-application-complete-no-recommendations.json';
import failed from '../../docs/handoff/fixtures/get-application-failed.json';
import notFound from '../../docs/handoff/fixtures/get-application-404.json';
import pending from '../../docs/handoff/fixtures/get-application-pending.json';
import running from '../../docs/handoff/fixtures/get-application-running.json';

export const fixtures = {
    accepted202,
    bad400,
    complete,
    completeNoRecs,
    failed,
    notFound,
    pending,
    running,
};

// ASK_URL must match the API_URL constant in askme/index.jsx; APPLICATION_URL
// must match VITE_AWS_APPLICATION_API_URL as set under `test.env` in
// vite.config.js. setup.js fails any request that no handler
// matches, so if either URL changes the tests go red instead of hitting AWS.
export const ASK_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask';
export const APPLICATION_URL = 'https://application-api.test/Prod/application';
export const APPLICATION_API_KEY = 'test-api-key';

export const handlers = [
    http.post(ASK_URL, () =>
        HttpResponse.json({ answer: 'Mocked answer.', sessionId: 'ask-session-1' })
    ),
    // Default happy path: submit accepted, first poll already complete. The
    // poll delay is shrunk to 10ms so tests on real timers don't wait the
    // production 10s; tests that care about the interval override this with
    // server.use(...) and fake timers.
    http.post(APPLICATION_URL, () =>
        HttpResponse.json({ ...accepted202, pollAfterSeconds: 0.01 }, { status: 202 })
    ),
    http.get(`${APPLICATION_URL}/:jobId`, () => HttpResponse.json(complete)),
];

export const server = setupServer(...handlers);

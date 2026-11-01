import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server.js';
// Resolves to the vi.mock factory below (mocks are hoisted above imports).
import { firestoreMock } from '../firebase.js';

// src/firebase.js throws at import when VITE_FIREBASE_API_KEY is unset and
// opens real auth/firestore connections, so every test gets this stand-in.
// Tests that need a signed-in user click a Login button, which resolves
// signInWithPopup with TEST_USER below.
vi.mock('../firebase.js', () => {
    const TEST_USER = { uid: 'test-uid', displayName: 'Test User', email: 'test@example.com' };
    const auth = {
        currentUser: null,
        signInWithPopup: vi.fn(() => Promise.resolve({ user: TEST_USER })),
        signOut: vi.fn(() => Promise.resolve()),
    };
    // Generic, chainable Firestore compat stand-in. Collections and doc refs
    // are memoized by path, so a test can grab the same stub the component
    // will use (`firestoreMock.collection('users/test-uid/jobApplications')`)
    // before rendering, assert on its vi.fn()s, or make one reject.
    const SERVER_TIMESTAMP = Object.freeze({ __type: 'serverTimestamp' });

    const joinPath = (...parts) =>
        parts.join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');

    const collections = new Map();
    const docRefs = new Map();
    const listeners = new Map(); // collection path -> Set of {onNext, onError}
    let autoId = 0;

    const makeSnapshot = (records) => {
        const docs = records.map(({ id, ...data }) => ({
            id,
            exists: true,
            data: () => data,
        }));
        return {
            docs,
            size: docs.length,
            empty: docs.length === 0,
            forEach: (cb) => docs.forEach(cb),
        };
    };

    const getCollection = (path) => {
        const key = joinPath(path);
        if (collections.has(key)) return collections.get(key);

        const subscribers = new Set();
        listeners.set(key, subscribers);

        // orderBy/limit/where return the same object so any chain lands back
        // on the collection stub and the test only needs one handle.
        const collection = {
            path: key,
            orderBy: vi.fn(() => collection),
            limit: vi.fn(() => collection),
            where: vi.fn(() => collection),
            // NWmap subscribes in componentDidMount; return an unsubscribe fn.
            onSnapshot: vi.fn((onNext, onError) => {
                const subscriber = { onNext, onError };
                subscribers.add(subscriber);
                return () => subscribers.delete(subscriber);
            }),
            add: vi.fn(() => Promise.resolve({ id: `mock-doc-${++autoId}` })),
            get: vi.fn(() => Promise.resolve(makeSnapshot([]))),
            doc: vi.fn((id) => getDoc(key, id ?? `mock-doc-${++autoId}`)),
        };
        collections.set(key, collection);
        return collection;
    };

    function getDoc(collectionPath, id) {
        const key = joinPath(collectionPath, id);
        if (docRefs.has(key)) return docRefs.get(key);

        const ref = {
            id,
            path: key,
            collection: vi.fn((name) => getCollection(joinPath(key, name))),
            set: vi.fn(() => Promise.resolve()),
            update: vi.fn(() => Promise.resolve()),
            delete: vi.fn(() => Promise.resolve()),
            get: vi.fn(() =>
                Promise.resolve({ id, exists: false, data: () => undefined })
            ),
            onSnapshot: vi.fn(() => () => {}),
        };
        docRefs.set(key, ref);
        return ref;
    }

    const db = {
        collection: vi.fn((path) => getCollection(path)),
        doc: vi.fn((path) => {
            const parts = joinPath(path).split('/');
            return getDoc(parts.slice(0, -1).join('/'), parts[parts.length - 1]);
        }),
    };

    // Test-facing handles. `emit` pushes a snapshot to everything subscribed
    // to a collection path, which is how a test simulates stored records.
    const firestoreMock = {
        SERVER_TIMESTAMP,
        collection: getCollection,
        doc: (collectionPath, id) => getDoc(collectionPath, id),
        emit: (path, records) => {
            const subscribers = listeners.get(joinPath(path));
            if (!subscribers) throw new Error(`No subscriber for "${path}"`);
            const snapshot = makeSnapshot(records);
            subscribers.forEach(({ onNext }) => onNext(snapshot));
        },
        emitError: (path, err) => {
            const subscribers = listeners.get(joinPath(path));
            if (!subscribers) throw new Error(`No subscriber for "${path}"`);
            subscribers.forEach(({ onError }) => onError?.(err));
        },
        subscriberCount: (path) => listeners.get(joinPath(path))?.size ?? 0,
        reset: () => {
            collections.clear();
            docRefs.clear();
            listeners.clear();
            autoId = 0;
            db.collection.mockClear();
            db.doc.mockClear();
        },
    };

    return {
        auth,
        db,
        provider: {},
        TEST_USER,
        firestoreMock,
        // history.js reaches FieldValue off the default export, while nwmap.jsx
        // calls firebase.auth()/firebase.firestore() — support both shapes.
        default: {
            auth: () => auth,
            firestore: Object.assign(() => db, {
                FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
            }),
        },
    };
});

// Leaflet needs real layout (sizes, transforms) that jsdom does not provide.
// Render children so NWmap's own markup is still exercised.
vi.mock('react-leaflet', () => {
    const Passthrough = ({ children }) => <div>{children}</div>;
    return {
        MapContainer: Passthrough,
        ImageOverlay: () => null,
        Marker: Passthrough,
        Popup: Passthrough,
        useMap: () => ({}),
        useMapEvents: () => ({}),
    };
});

// jsdom does not implement scrollIntoView; AskMe calls it after each message.
Element.prototype.scrollIntoView = vi.fn();

// msw 3 renamed `onUnhandledRequest` to `onUnhandledFrame`. The old name is
// not rejected, it is silently ignored, which drops the handler back to its
// 'warn' default and lets an unmatched request reach the real AWS endpoint.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
    // cleanup() first so unmounting components drop their subscriptions
    // before the Firestore stubs are thrown away.
    cleanup();
    firestoreMock.reset();
    server.resetHandlers();
});
afterAll(() => server.close());

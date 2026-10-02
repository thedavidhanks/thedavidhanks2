import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server.js';

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
    const db = {
        collection: vi.fn(() => ({
            // NWmap subscribes in componentDidMount; return an unsubscribe fn.
            onSnapshot: vi.fn(() => () => {}),
            add: vi.fn(() => Promise.resolve({ id: 'test-doc' })),
        })),
    };
    return {
        auth,
        db,
        provider: {},
        TEST_USER,
        default: { auth: () => auth, firestore: () => db },
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
    cleanup();
    server.resetHandlers();
});
afterAll(() => server.close());

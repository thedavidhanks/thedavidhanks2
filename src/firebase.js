import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Opt-in local-development switch: point auth and firestore at the local
// Firebase emulators instead of the real project. Unset everywhere except a
// developer's own shell, so production behavior is unchanged. It is listed in
// OPTIONAL_VARS in scripts/check-env.ts, which otherwise treats every VITE_*
// the source reads as required. See docs/local-firebase-emulator.md.
const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === 'true';

const apikey = import.meta.env.VITE_FIREBASE_API_KEY;

// if the api key is not set, throw an error. The emulators never validate it,
// so emulator mode falls back to a placeholder rather than requiring a real
// project credential just to run locally.
if (!apikey && !useEmulator) {
    throw new Error('Firebase API key is not set. Please set the VITE_FIREBASE_API_KEY environment variable.');
}
const config = {
    apiKey: apikey || 'emulator-placeholder-key',
    authDomain: "thedavidhanks-559b0.firebaseapp.com",
    databaseURL: "https://thedavidhanks-559b0.firebaseio.com/",
    projectId: "thedavidhanks-559b0",
};
firebase.initializeApp(config);

export const provider = new firebase.auth.GoogleAuthProvider();
export const db = firebase.firestore();
export const auth = firebase.auth();

// Must run before any read/write. Ports match the `emulators` block in
// firebase.json; 127.0.0.1 rather than localhost so it cannot resolve to ::1
// while the emulator listens on IPv4 only.
if (useEmulator) {
    db.useEmulator('127.0.0.1', 8080);
    auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
    console.info('[firebase] local emulators: firestore :8080, auth :9099');
}

export default firebase;



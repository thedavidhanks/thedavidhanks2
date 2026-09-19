import { useCallback, useState } from 'react';

import { readStoredIds as parseStoredIds } from '../../../lib/satisfactory-sink/stored-alternates.ts';

// Which "Alternate: ..." (Hard Drive) recipes the visitor has unlocked, kept in
// localStorage.
//
// Why localStorage and not Firestore: docs/satisfactory-sink-maximizer.md §10
// suggests Firestore for this per-user state, but this page is deliberately
// public — no login — so Firestore is not an option here. Without an
// authenticated user there is no document to key the unlock set to, so the
// browser is the only place this can live.
//
// Note this default is the OPPOSITE of the solver library's: the library
// assumes every alternate is unlocked (true of no real save), and restricting
// the recipe list is the UI's job. A first-time visitor starts with an empty
// set — nothing unlocked — and checks off what their save actually has.
const STORAGE_KEY = 'satisfactory-sink:unlocked-alternates';

// localStorage.getItem throws in Safari private mode and when the quota is
// full. The parse/validate step for whatever it returns lives in
// stored-alternates.ts; every failure mode there also degrades to "nothing
// unlocked" rather than taking the page down.
const readStoredIds = () => {
    try {
        return parseStoredIds(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        // Unavailable or blocked — start empty and stay in memory.
        return new Set();
    }
};

/**
 * @returns {[Set<string>, (next: Set<string>|Iterable<string>) => void]}
 *   The set of unlocked recipe ids and a setter that persists it. The setter
 *   takes a value (a new Set), not an updater function — build the next set
 *   from the current one at the call site.
 */
export const useUnlockedAlternates = () => {
    // Read lazily in the initializer, not in an effect, so the first paint
    // already has the stored set and there is no flash of "nothing unlocked".
    const [unlocked, setUnlockedState] = useState(readStoredIds);

    const setUnlocked = useCallback((next) => {
        const nextSet = next instanceof Set ? next : new Set(next);
        setUnlockedState(nextSet);

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextSet]));
        } catch {
            // Write failed (private mode, quota). The state above still
            // applied, so the session works — it just will not be remembered.
        }
    }, []);

    return [unlocked, setUnlocked];
};

// Firestore access for saved job applications, kept out of index.jsx so the
// component stays a view. Records live in a per-user subcollection:
//
//     users/{uid}/jobApplications/{applicationId}
//
// The path carries the uid, so isolation is structural: there is no userId
// field to filter on and no query that can span users. The matching security
// rule lives in firestore.rules. See docs/applyforjobs-history.md.
//
// Uses the Firebase compat API to match the rest of the repo.
import firebase, { db } from '../../../firebase.js';

export const SCHEMA_VERSION = 1;

// A Firestore document is capped at 1 MiB. A realistic record is 5-20 KB, but
// a pathological paste could exceed the cap and fail the write *after* a paid
// Bedrock generation already succeeded. Truncate well short of the limit.
const MAX_JOB_POSTING_CHARS = 200_000;
const TRUNCATION_MARKER = '\n\n[truncated]';

// Bounds reads on the list subscription. Add pagination only if the history
// ever outgrows this.
const HISTORY_LIMIT = 50;

const collectionFor = (uid) =>
    db.collection('users').doc(uid).collection('jobApplications');

const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

export const truncateJobPosting = (posting) => {
    const text = posting || '';
    if (text.length <= MAX_JOB_POSTING_CHARS) return text;
    return text.slice(0, MAX_JOB_POSTING_CHARS) + TRUNCATION_MARKER;
};

// Subscribe to the user's saved applications, newest first. Returns the
// unsubscribe function. Ordering is on createdAtMs rather than createdAt:
// serverTimestamp() resolves to null in the local snapshot until the server
// acknowledges the write, which would sort a just-saved record unpredictably
// and render its label as "Invalid Date" for a moment.
export const subscribeToApplications = (uid, onChange, onError) =>
    collectionFor(uid)
        .orderBy('createdAtMs', 'desc')
        .limit(HISTORY_LIMIT)
        .onSnapshot(
            (snapshot) => {
                onChange(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            },
            (err) => {
                if (onError) onError(err);
            }
        );

// Write a new record on a successful generation. Resolves to the new id.
export const createApplication = async (uid, record) => {
    const docRef = await collectionFor(uid).add({
        schemaVersion: SCHEMA_VERSION,
        company: record.company || '',
        position: record.position || '',
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        jobPosting: truncateJobPosting(record.jobPosting),
        applicantContext: record.applicantContext || '',
        coverLetter: record.coverLetter || '',
        resume: record.resume || '',
        // Additive field (no schemaVersion bump): null when the job completed
        // without a fit report, absent on records saved before /application.
        recommendations: record.recommendations || null,
        sessionId: record.sessionId || null,
    });
    return docRef.id;
};

// Mirror live editor edits back onto the stored record.
export const updateApplicationOutputs = (uid, id, { coverLetter, resume }) =>
    collectionFor(uid).doc(id).update({
        coverLetter: coverLetter || '',
        resume: resume || '',
        updatedAt: serverTimestamp(),
    });

export const deleteApplication = (uid, id) => collectionFor(uid).doc(id).delete();

import Modal from 'react-bootstrap/Modal';

const formatElapsed = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
};

// The API reports no progress or ETA, so the copy only says what is true
// about time-on-task, and every phase keeps the "keep this page open" ask.
const messageFor = (seconds) => {
    if (seconds < 60) return 'This usually takes under a minute. Please keep this page open.';
    if (seconds < 180) return 'Taking longer than usual, but still working. Please keep this page open.';
    return 'Still working. Please keep this page open, or cancel and try again later.';
};

// Non-dismissable while a generation runs: a stray Escape or backdrop click
// would otherwise orphan a paid job. Cancel is the one way out.
export default function ProgressModal({ show, elapsedSeconds, company, position, onCancel }) {
    const target = position && company ? `${position} at ${company}` : position || company;

    return (
        <Modal
            show={show}
            backdrop="static"
            keyboard={false}
            animation={false}
            centered
            dialogClassName="afj-progress"
            aria-labelledby="applyforjobs-progress-title"
            aria-describedby="applyforjobs-progress-desc"
        >
            <div className="afj-progress-track" aria-hidden="true"><span /></div>
            <Modal.Body className="afj-progress-body">
                <h5 id="applyforjobs-progress-title" className="afj-progress-title">
                    Generating your cover letter and resume
                </h5>
                {target && <p className="afj-progress-target">{target}</p>}
                {/* role=timer is not announced on every tick, unlike a live region. */}
                <p role="timer" className="afj-timer">
                    <span className="visually-hidden sr-only">Elapsed time: </span>
                    <span className="afj-timer-value">{formatElapsed(elapsedSeconds)}</span>
                    <span className="afj-timer-caption" aria-hidden="true">elapsed</span>
                </p>
                <p id="applyforjobs-progress-desc" className="afj-progress-desc">
                    {messageFor(elapsedSeconds)}
                </p>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
                    Cancel
                </button>
            </Modal.Body>
        </Modal>
    );
}

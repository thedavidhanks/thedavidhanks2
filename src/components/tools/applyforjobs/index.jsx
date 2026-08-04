import React, { useState } from 'react';
import './applyforjobs.css';

// TODO: update API_URL once the Bedrock backend is deployed.
// See docs/applyforjobs-bedrock-deploy.md
const API_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/apply';
const API_KEY = import.meta.env.VITE_AWS_APPLY_API_KEY;

const downloadMd = (filename, content) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const ApplyForJobs = () => {
    const [jobPosting, setJobPosting] = useState('');
    const [applicantContext, setApplicantContext] = useState('');
    const [showContext, setShowContext] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const posting = jobPosting.trim();
        if (!posting) return;

        setError('');
        setLoading(true);
        setResult(null);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY,
                },
                body: JSON.stringify({
                    jobPosting: posting,
                    ...(applicantContext.trim() && { applicantContext: applicantContext.trim() }),
                    ...(sessionId && { sessionId }),
                }),
            });

            if (!response.ok) {
                throw new Error(`Request failed (${response.status})`);
            }

            const data = await response.json();
            if (data.sessionId) setSessionId(data.sessionId);
            setResult({
                coverLetter: data.coverLetter || '',
                resume: data.resume || '',
            });
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const startOver = () => {
        setJobPosting('');
        setApplicantContext('');
        setShowContext(false);
        setResult(null);
        setError('');
    };

    return (
        <div className="applyforjobs-container">
            <h3>Apply for Jobs</h3>
            <p style={{ color: '#666' }}>
                Paste a job posting below and get a tailored cover letter and resume.
            </p>

            {!result && (
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="jobPosting" className="form-label">
                            Job posting <span style={{ color: '#c00' }}>*</span>
                        </label>
                        <textarea
                            id="jobPosting"
                            className="form-control"
                            rows={10}
                            placeholder="Paste the job description here..."
                            value={jobPosting}
                            onChange={(e) => setJobPosting(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="mb-3">
                        <button
                            type="button"
                            className="btn btn-link p-0"
                            onClick={() => setShowContext(!showContext)}
                            disabled={loading}
                        >
                            {showContext ? 'Hide' : 'Add'} optional context
                        </button>
                        {showContext && (
                            <textarea
                                className="form-control mt-2"
                                rows={3}
                                placeholder="Optional: target tone, specific experience to emphasize, etc."
                                value={applicantContext}
                                onChange={(e) => setApplicantContext(e.target.value)}
                                disabled={loading}
                            />
                        )}
                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">{error}</div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-outline-primary"
                        disabled={loading || !jobPosting.trim()}
                    >
                        {loading ? 'Generating...' : 'Generate Cover Letter & Resume'}
                    </button>
                </form>
            )}

            {result && (
                <>
                    <div className="applyforjobs-result">
                        <div className="applyforjobs-section-header">
                            <h4 className="mb-0">Cover Letter</h4>
                            <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => downloadMd('cover-letter.md', result.coverLetter)}
                            >
                                Download .md
                            </button>
                        </div>
                        <pre>{result.coverLetter}</pre>
                    </div>

                    <div className="applyforjobs-result">
                        <div className="applyforjobs-section-header">
                            <h4 className="mb-0">Resume</h4>
                            <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => downloadMd('resume.md', result.resume)}
                            >
                                Download .md
                            </button>
                        </div>
                        <pre>{result.resume}</pre>
                    </div>

                    <button className="btn btn-outline-secondary" onClick={startOver}>
                        Start over
                    </button>
                </>
            )}
        </div>
    );
};

export default ApplyForJobs;

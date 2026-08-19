import React, { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './applyforjobs.css';

// TODO: update API_URL once the Bedrock backend is deployed.
// See docs/applyforjobs-bedrock-deploy.md
const API_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/apply';
const API_KEY = import.meta.env.VITE_AWS_APPLY_API_KEY;

// Print stylesheet for the generated PDF (the equivalent of the Python
// pipeline's css_path). Styles headings, tables, italics, bold, and lists.
// @page sets US Letter with 1-inch margins so the browser's print engine
// (the WeasyPrint equivalent) lays out the PDF.
const PDF_STYLESHEET = `
    @page {
        size: Letter;
        margin: 0.6in;
    }

    html {
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Liberation Sans", sans-serif;
        font-size: 10.5pt;
        line-height: 1.35;
        color: #222;
    }

    body {
        margin: 0;
    }

    h1 {
        font-size: 22pt;
        margin: 0 0 0.1em 0;
        line-height: 1.1;
    }

    h2 {
        font-size: 13pt;
        margin: 1em 0 0.3em 0;
        padding-bottom: 0.1em;
        border-bottom: 1px solid #444;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    h3 {
        font-size: 11pt;
        margin: 0.75em 0 0.15em 0;
        /* top right bottom left */
    }

    p {
        margin: 0 0 1em 0;
    }

    ul, ol {
        margin: 0.2em 0 0.5em 0;
        padding-left: 1.2em;
    }

    li {
        margin: 0.1em 0;
    }

    li > p {
        margin: 0;
    }

    strong {
        color: #000;
    }

    a {
        color: #0066cc;
        text-decoration: underline;
    }

    hr {
        border: none;
        border-top: 1px solid #ccc;
        margin: 0.8em 0;
    }

    code {
        font-family: "SF Mono", Menlo, Consolas, monospace;
        font-size: 9.5pt;
        background: #f4f4f4;
        padding: 0 0.2em;
        border-radius: 2px;
    }

    pre {
        background: #f4f4f4;
        padding: 0.5em 0.7em;
        border-radius: 3px;
        font-size: 9.5pt;
        overflow-x: hidden;
        white-space: pre-wrap;
    }

    blockquote {
        border-left: 3px solid #ccc;
        margin: 0.5em 0;
        padding: 0 0 0 0.8em;
        color: #555;
    }

    table {
        width: 100%;
        padding: 0 0 0.5em 0;
        border-collapse: collapse;
    }
`;

// Render markdown to a styled PDF via the browser's own print engine.
// Mirrors the Python markdown_to_pdf: marked (markdown -> HTML) + a CSS
// stylesheet, rendered to PDF by the browser (the WeasyPrint equivalent).
// Tables, italics, and bold render as real, selectable text. The user picks
// "Save as PDF" (or a real printer) in the print dialog.
const downloadPdf = (title, markdown) => {
    // GitHub-flavored markdown so pipe tables are parsed. marked is the
    // JS counterpart to Python's markdown.markdown(..., extensions=['extra']).
    // The markdown is user-editable, so sanitize the resulting HTML with
    // DOMPurify to strip any injected scripts/event handlers before it is
    // written into the print window.
    const dirtyHtml = marked.parse(markdown, { gfm: true, breaks: false });
    const html = DOMPurify.sanitize(dirtyHtml);

    const printWindow = window.open('', '_blank', 'width=816,height=1056');
    if (!printWindow) {
        // Popup blocked — nothing we can do without a user-gesture window.
        alert('Please allow pop-ups to download the PDF.');
        return;
    }

    printWindow.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8">` +
        `<title>${title}</title><style>${PDF_STYLESHEET}</style></head>` +
        `<body>${html}</body></html>`
    );
    printWindow.document.close();

    // Wait for layout, trigger the print dialog, then close the helper window.
    printWindow.focus();
    printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
    };
};

// Inline print icon so no icon-font dependency is needed.
const PrintIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        style={{ verticalAlign: '-2px', marginRight: '4px' }}
    >
        <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
        <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a1 1 0 0 0-1 1v3h8v-3a1 1 0 0 0-1-1H5zm7 2h2a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1z" />
    </svg>
);

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
                            rows={20}
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
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => downloadPdf('Cover Letter', result.coverLetter)}
                                >
                                    <PrintIcon />
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="applyforjobs-editor form-control"
                            aria-label="Cover letter markdown (editable)"
                            value={result.coverLetter}
                            onChange={(e) =>
                                setResult((r) => ({ ...r, coverLetter: e.target.value }))
                            }
                        />
                    </div>

                    <div className="applyforjobs-result">
                        <div className="applyforjobs-section-header">
                            <h4 className="mb-0">Resume</h4>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => downloadPdf('Resume', result.resume)}
                                >
                                    <PrintIcon />
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="applyforjobs-editor form-control"
                            aria-label="Resume markdown (editable)"
                            value={result.resume}
                            onChange={(e) =>
                                setResult((r) => ({ ...r, resume: e.target.value }))
                            }
                        />
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

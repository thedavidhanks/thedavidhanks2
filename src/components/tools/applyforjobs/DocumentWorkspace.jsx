import { useEffect, useState } from 'react';
import Nav from 'react-bootstrap/Nav';
import Tab from 'react-bootstrap/Tab';

import { renderMarkdown } from './markdown.js';
import { downloadPdf } from './pdf.js';
import { CheckIcon, CopyIcon, PrinterIcon } from './icons.jsx';

const COPY_FEEDBACK_MS = 2000;

// One document at a time behind tabs, shown either as its editable markdown
// source or as a letter-sized sheet set in the PDF's type, so the preview is
// what the print dialog will produce.
//
// documents: [{ key, label, markdown, pdfTitle?, ariaLabel?, onChange? }]
// A document with onChange is editable; `editable` turns on the Edit/Preview
// switch. Read-only workspaces (history) always render the sheet.
export default function DocumentWorkspace({ id, documents, editable = false }) {
    const [activeKey, setActiveKey] = useState(documents[0]?.key);
    const [mode, setMode] = useState(editable ? 'edit' : 'preview');
    const [copied, setCopied] = useState(null);

    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [copied]);

    const current = documents.find((doc) => doc.key === activeKey) || documents[0];
    if (!current) return null;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(current.markdown || '');
            setCopied(current.key);
        } catch {
            setCopied('failed');
        }
    };

    let copyLabel = <><CopyIcon />Copy</>;
    if (copied === current.key) copyLabel = <><CheckIcon />Copied</>;
    else if (copied === 'failed') copyLabel = <>Copy failed</>;

    return (
        <Tab.Container
            id={id}
            activeKey={current.key}
            onSelect={(key) => key && setActiveKey(key)}
            transition={false}
        >
            <div className="afj-docbar">
                <Nav variant="underline" className="afj-tabs">
                    {documents.map((doc) => (
                        <Nav.Item key={doc.key}>
                            <Nav.Link as="button" type="button" eventKey={doc.key}>
                                {doc.label}
                            </Nav.Link>
                        </Nav.Item>
                    ))}
                </Nav>
                <div className="afj-doctools">
                    {editable && (
                        <div className="btn-group btn-group-sm afj-mode" role="group" aria-label="Document view">
                            {['edit', 'preview'].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`btn btn-outline-secondary${mode === value ? ' active' : ''}`}
                                    aria-pressed={mode === value}
                                    onClick={() => setMode(value)}
                                >
                                    {value === 'edit' ? 'Edit' : 'Preview'}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary afj-tool"
                        onClick={copy}
                        aria-live="polite"
                    >
                        {copyLabel}
                    </button>
                    {current.pdfTitle && (
                        <button
                            type="button"
                            className="btn btn-sm btn-primary afj-tool"
                            onClick={() => downloadPdf(current.pdfTitle, current.markdown)}
                        >
                            <PrinterIcon />Save as PDF
                        </button>
                    )}
                </div>
            </div>
            <Tab.Content className="afj-desk">
                {documents.map((doc) => (
                    <Tab.Pane key={doc.key} eventKey={doc.key}>
                        {editable && doc.onChange && mode === 'edit' ? (
                            <textarea
                                className="afj-sheet afj-editor"
                                aria-label={doc.ariaLabel}
                                value={doc.markdown}
                                onChange={(e) => doc.onChange(e.target.value)}
                            />
                        ) : (
                            <article
                                className="afj-sheet afj-paper"
                                aria-label={doc.label}
                                dangerouslySetInnerHTML={renderMarkdown(doc.markdown)}
                            />
                        )}
                    </Tab.Pane>
                ))}
            </Tab.Content>
        </Tab.Container>
    );
}

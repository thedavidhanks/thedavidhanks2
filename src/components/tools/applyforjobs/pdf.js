import { marked } from 'marked';
import DOMPurify from 'dompurify';

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
export const downloadPdf = (title, markdown) => {
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

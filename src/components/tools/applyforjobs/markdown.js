import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Model- and user-supplied markdown is untrusted, so every render goes
// through DOMPurify before it reaches dangerouslySetInnerHTML.
export const renderMarkdown = (markdown) => ({
    __html: DOMPurify.sanitize(marked.parse(markdown || '', { gfm: true, breaks: false })),
});

// Inline-only variant (no wrapping <p>) for text that lives inside a heading.
export const renderInlineMarkdown = (markdown) => ({
    __html: DOMPurify.sanitize(marked.parseInline(markdown || '', { gfm: true, breaks: false })),
});

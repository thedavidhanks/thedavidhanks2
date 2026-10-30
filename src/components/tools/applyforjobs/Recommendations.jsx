import { useState } from 'react';
import Accordion from 'react-bootstrap/Accordion';

import { renderInlineMarkdown, renderMarkdown } from './markdown.js';

// The model tends to end fields with a horizontal rule ("text\n\n---") and
// sometimes a bare "---" on the same line as the last sentence. Strip those
// (and surrounding whitespace) until the string stops changing.
const clean = (value) => {
    if (typeof value !== 'string') return '';
    let text = value.trim();
    let previous;
    do {
        previous = text;
        text = text.replace(/\s*-{3,}\s*$/, '').trim();
    } while (text !== previous);
    return text;
};

// Optional list fields may be null, missing, or not arrays; blank entries are dropped.
const cleanList = (value) => (Array.isArray(value) ? value.map(clean).filter(Boolean) : []);

const LISTS = [
    ['recommendedSkills', 'Recommended skills'],
    ['recommendedCourses', 'Recommended courses'],
    ['recommendedExperience', 'Recommended experience'],
    ['resumeRecommendations', 'Resume recommendations'],
];

const TEXT_SECTIONS = [
    ['scoreRationale', 'Score rationale'],
    ['strengths', 'Strengths'],
    ['gaps', 'Gaps'],
];

// Wide screens have room for the report beside the documents, so it starts
// open there; narrow screens start collapsed so the documents stay in reach.
const WIDE_QUERY = '(min-width: 1200px)';
const startsOpen = () =>
    typeof window !== 'undefined' && Boolean(window.matchMedia?.(WIDE_QUERY).matches);

// `level` is the heading level of the accordion header (5 under the
// workspace's h4 title). The position heading sits one level below it;
// section labels stay h6.
export default function Recommendations({ recommendations, level = 4 }) {
    const [defaultOpen] = useState(startsOpen);
    if (!recommendations || typeof recommendations !== 'object') return null;

    const hasFit = Number.isFinite(recommendations.fit);
    const fitPercent = hasFit ? Math.min(100, Math.max(0, recommendations.fit)) : 0;
    const position = clean(recommendations.position);
    const PositionHeading = `h${Math.min(level + 1, 6)}`;
    const positionHtml = position ? renderInlineMarkdown(position) : null;
    // Sanitizing can leave nothing (e.g. a lone <script>); never emit an empty heading.
    const showPosition = positionHtml && positionHtml.__html.trim() !== '';

    return (
        <Accordion
            className="applyforjobs-recommendations"
            defaultActiveKey={defaultOpen ? '0' : null}
        >
            <Accordion.Item eventKey="0">
                <Accordion.Header as={`h${level}`}>
                    <span className="afj-fit-summary">
                        <span className="afj-fit-head">
                            <span className="afj-fit-label">
                                Fit score<span className="visually-hidden sr-only">:</span>
                            </span>{' '}
                            <span className="afj-fit-value">
                                {hasFit ? (
                                    <>{recommendations.fit}<span className="afj-fit-max">/100</span></>
                                ) : 'n/a'}
                            </span>
                        </span>
                        {hasFit && (
                            <span className="afj-fit-meter" aria-hidden="true">
                                <span style={{ width: `${fitPercent}%` }} />
                            </span>
                        )}
                    </span>
                </Accordion.Header>
                <Accordion.Body>
                    {showPosition && <PositionHeading dangerouslySetInnerHTML={positionHtml} />}
                    {TEXT_SECTIONS.map(([key, label]) => {
                        const text = clean(recommendations[key]);
                        if (!text) return null;
                        return (
                            <section key={key} className={`applyforjobs-recommendations-${key}`}>
                                <h6>{label}</h6>
                                <div dangerouslySetInnerHTML={renderMarkdown(text)} />
                            </section>
                        );
                    })}
                    {LISTS.map(([key, label]) => {
                        const items = cleanList(recommendations[key]);
                        if (items.length === 0) return null;
                        return (
                            <section key={key} className={`applyforjobs-recommendations-${key}`}>
                                <h6>{label}</h6>
                                <ul>
                                    {items.map((item, i) => (
                                        <li key={i}>
                                            <div dangerouslySetInnerHTML={renderMarkdown(item)} />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                </Accordion.Body>
            </Accordion.Item>
        </Accordion>
    );
}

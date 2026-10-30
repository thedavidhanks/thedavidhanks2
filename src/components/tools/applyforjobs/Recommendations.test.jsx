import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Recommendations from './Recommendations.jsx';
import fixture from '../../../../docs/handoff/fixtures/get-application-complete.json';

const { recommendations } = fixture;

const getToggle = () => screen.getByRole('button', { name: /Fit score/ });

describe('Recommendations', () => {
    it('renders nothing for null, undefined, or non-object input', () => {
        for (const value of [null, undefined, 'nope', 42]) {
            const { container, unmount } = render(<Recommendations recommendations={value} />);
            expect(container).toBeEmptyDOMElement();
            unmount();
        }
    });

    it('is collapsed by default and shows only the fit score in the header', () => {
        const { container } = render(<Recommendations recommendations={recommendations} />);
        const toggle = getToggle();
        expect(toggle).toHaveTextContent(/^Fit score: 62\/100$/);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector('.applyforjobs-recommendations')).toBeInTheDocument();
        // jsdom has no Bootstrap CSS, so visibility is asserted via the collapse classes.
        const panel = container.querySelector('.accordion-collapse');
        expect(panel).toHaveClass('collapse');
        expect(panel).not.toHaveClass('show');
    });

    it('expands on click and renders cleaned, sanitized markdown', async () => {
        const user = userEvent.setup();
        const { container } = render(<Recommendations recommendations={recommendations} />);
        await user.click(getToggle());

        expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
        await waitFor(() => expect(container.querySelector('.accordion-collapse')).toHaveClass('show'));

        const heading = screen.getByRole('heading', { level: 5 });
        expect(heading).toHaveTextContent('Senior Full Stack Engineer — Northwind Health');
        expect(heading.textContent).not.toContain('---');

        const rationale = container.querySelector('.applyforjobs-recommendations-scoreRationale');
        expect(rationale).toHaveTextContent('David meets the core hard requirements solidly');
        expect(rationale.textContent).not.toContain('---');

        for (const key of ['strengths', 'gaps']) {
            const section = container.querySelector(`.applyforjobs-recommendations-${key}`);
            expect(section.querySelectorAll('li').length).toBe(6);
            expect(section.querySelector('li strong')).toBeInTheDocument();
            expect(section.textContent).not.toContain('**');
            expect(section.textContent).not.toContain('---');
        }
        expect(
            within(container.querySelector('.applyforjobs-recommendations-strengths'))
                .getByText('5+ years full-stack engineering + React:')
                .tagName,
        ).toBe('STRONG');
    });

    it('renders the four recommendation lists without trailing rules', async () => {
        const user = userEvent.setup();
        const { container } = render(<Recommendations recommendations={recommendations} />);
        await user.click(getToggle());

        const expected = {
            recommendedSkills: ['Recommended skills', 5],
            recommendedCourses: ['Recommended courses', 4],
            recommendedExperience: ['Recommended experience', 4],
            resumeRecommendations: ['Resume recommendations', 5],
        };
        for (const [key, [label, count]] of Object.entries(expected)) {
            const section = container.querySelector(`.applyforjobs-recommendations-${key}`);
            expect(within(section).getByRole('heading', { level: 6, name: label })).toBeInTheDocument();
            expect(section.querySelectorAll('li')).toHaveLength(count);
            expect(section.textContent).not.toContain('**');
            expect(section.textContent).not.toMatch(/---\s*$/);
        }
        expect(
            container.querySelector('.applyforjobs-recommendations-recommendedSkills li:last-child').textContent,
        ).not.toContain('---');
    });

    it.each([
        ['Enter', '{Enter}'],
        ['Space', ' '],
    ])('expands from the keyboard with %s', async (_name, key) => {
        const user = userEvent.setup();
        render(<Recommendations recommendations={recommendations} />);
        await user.tab();
        expect(getToggle()).toHaveFocus();
        await user.keyboard(key);
        expect(getToggle()).toHaveAttribute('aria-expanded', 'true');
        expect(
            screen.getByRole('heading', { level: 5, name: /Senior Full Stack Engineer/ }),
        ).toBeInTheDocument();
    });

    it('tolerates a minimal object and omits empty sections', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <Recommendations
                recommendations={{
                    fit: 10,
                    gaps: '- a',
                    position: null,
                    scoreRationale: null,
                    strengths: null,
                    recommendedSkills: [],
                    recommendedCourses: null,
                    recommendedExperience: ['  ', '---'],
                    resumeRecommendations: 'not an array',
                }}
            />,
        );
        expect(getToggle()).toHaveTextContent('Fit score: 10/100');
        await user.click(getToggle());

        expect(screen.queryByRole('heading', { level: 5 })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 6, name: 'Gaps' })).toBeInTheDocument();
        expect(container.querySelectorAll('li')).toHaveLength(1);
        for (const label of [
            'Score rationale',
            'Strengths',
            'Recommended skills',
            'Recommended courses',
            'Recommended experience',
            'Resume recommendations',
        ]) {
            expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
    });

    it('does not throw when fit is missing or not a number', () => {
        render(<Recommendations recommendations={{ fit: null, gaps: '- a' }} />);
        expect(getToggle()).toHaveTextContent('Fit score: n/a');
    });

    it('sanitizes injected HTML in every kind of field', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <Recommendations
                recommendations={{
                    fit: 50,
                    position: 'Engineer <img src=x onerror=alert(1)>',
                    scoreRationale: 'ok <script>alert(1)</script>',
                    strengths: '- <img src=x onerror=alert(2)> fine',
                    recommendedSkills: ['<img src=x onerror=alert(3)> skill', '<script>alert(4)</script>text'],
                }}
            />,
        );
        await user.click(getToggle());

        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('[onerror]')).toBeNull();
        expect(container.textContent).toContain('skill');
        expect(container.textContent).toContain('fine');
    });
});

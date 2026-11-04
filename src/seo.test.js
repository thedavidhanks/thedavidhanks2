import { describe, expect, it } from 'vitest';

import html from '../index.html?raw';
import { HOME_TITLE, HOME_DESCRIPTION, SITE_URL } from './seo.js';

// index.html is what bots that never run JS see, so it repeats the home
// metadata from seo.js as static tags. These fail if the two drift apart.
const doc = new DOMParser().parseFromString(html, 'text/html');
const meta = (selector) => doc.head.querySelector(selector)?.getAttribute('content');

describe('static head in index.html', () => {
    it('matches the home page title and description', () => {
        expect(doc.title).toBe(HOME_TITLE);
        expect(meta('meta[name="description"]')).toBe(HOME_DESCRIPTION);
        expect(meta('meta[property="og:title"]')).toBe(HOME_TITLE);
        expect(meta('meta[property="og:description"]')).toBe(HOME_DESCRIPTION);
    });

    it('keeps the description within the ~155 characters search results show', () => {
        expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(155);
    });

    // main.jsx removes exactly these so each page can render its own.
    it('marks the title, description and canonical as replaceable', () => {
        const replaceable = [...doc.head.querySelectorAll('[data-static-head]')].map((el) =>
            el.tagName === 'META' ? `meta:${el.name}` : el.tagName === 'LINK' ? `link:${el.rel}` : el.tagName
        );
        expect(replaceable.sort()).toEqual(['TITLE', 'link:canonical', 'meta:description']);
    });

    it('uses absolute www URLs for the canonical and share image', () => {
        expect(doc.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(`${SITE_URL}/`);
        expect(meta('meta[property="og:url"]')).toBe(`${SITE_URL}/`);
        expect(meta('meta[property="og:image"]')).toBe(`${SITE_URL}/og-image.png`);
    });

    it('has a parseable schema.org Person block', () => {
        const ld = JSON.parse(doc.head.querySelector('script[type="application/ld+json"]').textContent);
        expect(ld).toMatchObject({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'David Hanks',
            url: `${SITE_URL}/`,
            description: HOME_DESCRIPTION,
        });
    });
});

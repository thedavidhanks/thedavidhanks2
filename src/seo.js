// Shared by the pages (via PageMeta), scripts/build-seo.ts and the tests.
// index.html repeats the home title and description as static tags for bots
// that never run JS; src/seo.test.js fails if the two drift apart.
// See docs/seo.md.

export const SITE_URL = 'https://www.thedavidhanks.com';

export const HOME_TITLE = 'David Hanks: Software Developer & Licensed Mechanical Engineer (P.E.)';
export const HOME_DESCRIPTION =
    'David Hanks: software developer (React, AWS, Firebase) and Texas-licensed mechanical engineer ' +
    "with a Georgia Tech CS master's and 20+ years in oil & gas.";

export const pageTitle = (page) => `${page} · David Hanks`;

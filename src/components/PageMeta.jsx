import { SITE_URL } from '../seo.js';

// React 19 hoists these into <head> wherever they render, and removes them
// again on unmount, so each page just renders one of these. main.jsx strips
// the static copies index.html ships, which keeps exactly one of each.
const PageMeta = ({ title, description, path }) => (
    <>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}${path}`} />
    </>
);

export default PageMeta;

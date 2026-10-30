// One date format for every saved-application timestamp the tool shows.
export const formatDate = (ms) =>
    ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

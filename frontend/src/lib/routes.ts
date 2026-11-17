// Pretty public URLs. The backend resolves either the slug (gamerTag / franchise tag) OR the UUID, so
// these are safe: pass a slug for a clean URL, or an id where the slug isn't handy. Values are
// URL-encoded (a gamerTag may contain spaces).

/** /player/<gamerTag> (or /player/<uuid>). */
export const playerHref = (slug: string) => `/player/${encodeURIComponent(slug)}`;

/** /franchise/<tag> (or /franchise/<uuid>). */
export const franchiseHref = (slug: string) => `/franchise/${encodeURIComponent(slug)}`;

/** /match/<game-date-short> (or /match/<uuid>). */
export const matchHref = (slug: string) => `/match/${encodeURIComponent(slug)}`;

/** /announcements/<shortCode> (or /announcements/<uuid>). */
export const announcementHref = (code: string) => `/announcements/${encodeURIComponent(code)}`;

/** /register?announcement=<shortCode> (the register link on an open call). */
export const registerHref = (code: string) => `/register?announcement=${encodeURIComponent(code)}`;

/**
 * Redirects — Pure logic for URL redirect matching.
 * Migrated from easyway-portal runtime-pages.ts (PBI #606).
 * No DOM, no I/O — pure functions only.
 */

export type RedirectRule = { from: string; to: string };
export type RedirectsConfig = { version: string; rules: RedirectRule[] };

/**
 * Find a redirect rule matching the given pathname.
 * Normalizes trailing slashes before matching.
 */
export function findRedirect(pathname: string, rules: RedirectRule[]): string | null {
    const normalized = pathname.endsWith('/') && pathname !== '/'
        ? pathname.slice(0, -1)
        : pathname;
    const match = rules.find((r) => r.from === normalized);
    return match ? match.to : null;
}

/**
 * Manifest Resolver — resolves page IDs from routes.
 * Pure functions, no fetch. Extracted from easyway-portal (src/utils/pages-loader.ts).
 */

import type { PagesManifestV1 } from './types.js';

export function normalizePathname(pathname: string): string {
    if (!pathname) return '/';
    if (pathname !== '/' && pathname.endsWith('/')) return pathname.slice(0, -1);
    return pathname;
}

export function resolvePageIdByRoute(manifest: PagesManifestV1, pathname: string): string | null {
    const normalized = normalizePathname(pathname);
    const page = manifest.pages.find(p => normalizePathname(p.route) === normalized);
    return page ? page.id : null;
}

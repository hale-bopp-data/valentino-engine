/**
 * Page Status — Pure logic for draft/published/scheduled workflow.
 * Migrated from easyway-portal runtime-pages.ts (PBI #606).
 * No DOM, no I/O — pure functions only.
 */
import type { ManifestPageV1, PagesManifestV1 } from './types.js';

export type PageStatus = 'draft' | 'published' | 'scheduled';

export function getPageStatus(page: ManifestPageV1): PageStatus {
    if (page.status === 'draft') return 'draft';
    if (page.publishAt) return 'scheduled';
    return 'published';
}

export function getPublishAt(page: ManifestPageV1): Date | null {
    if (!page.publishAt) return null;
    const d = new Date(page.publishAt);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Determines if a page should be visible to end users.
 * @param page - manifest page entry
 * @param options.devMode - if true, all pages are visible (default: false)
 */
export function isPageVisible(page: ManifestPageV1, options?: { devMode?: boolean }): boolean {
    if (options?.devMode) return true;
    const status = getPageStatus(page);
    if (status === 'draft') return false;
    if (status === 'scheduled') {
        const publishAt = getPublishAt(page);
        if (!publishAt) return true; // Invalid date → treat as published
        return new Date() >= publishAt;
    }
    return true;
}

// ── Contrast audit page discovery ────────────────────────────────────────────

/** Page IDs that are internal/utility and should be excluded from contrast audits. */
const CONTRAST_AUDIT_SKIP_IDS = new Set([
    'not-found',
    'maintenance',
    'editor',
]);

export type ContrastAuditPage = {
    id: string;
    route: string;
};

/**
 * Discover which pages should be tested for WCAG contrast.
 * Reads the manifest, filters to visible (published/scheduled-past) pages,
 * and excludes internal/utility pages.
 *
 * This is the single source of truth for "which pages does the contrast
 * audit cover?" — consumers (Playwright tests, CI, CLI) call this
 * instead of hardcoding page lists.
 */
export function getContrastAuditPages(manifest: PagesManifestV1): ContrastAuditPage[] {
    return manifest.pages
        .filter((page) => isPageVisible(page) && !CONTRAST_AUDIT_SKIP_IDS.has(page.id))
        .map(({ id, route }) => ({ id, route }));
}

/**
 * Page Status — Pure logic for draft/published/scheduled workflow.
 * Migrated from easyway-portal runtime-pages.ts (PBI #606).
 * No DOM, no I/O — pure functions only.
 */
import type { ManifestPageV1 } from './types.js';

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

/**
 * CMS Guardrails — Pure validation rules for CMS capabilities.
 * Migrated from easyway-portal scripts/guardrails-cms.mjs (PBI #606).
 * No I/O (no fs, no fetch) — works on pre-loaded data only.
 * I/O-dependent checks (media orphans, SEO from disk, encoding) stay in the consumer.
 */
import type { ManifestPageV1, PagesManifestV1 } from './types.js';
import type { RedirectRule } from './redirects.js';
import type { SeoSpec } from './seo.js';

export type CmsWarning = {
    type: string;
    severity: 'warning' | 'error';
    file: string;
    message: string;
};

/** Warn about draft pages without a scheduled publishAt date. */
export function checkDraftOrphans(manifest: PagesManifestV1): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    for (const page of manifest.pages) {
        if (page.status !== 'draft') continue;
        if (page.publishAt) continue;
        warnings.push({
            type: 'cms-draft-orphan',
            severity: 'warning',
            file: 'pages.manifest.json',
            message: `Page "${page.id}" is draft without publishAt — consider setting a publish date or removing it`,
        });
    }
    return warnings;
}

/** Validate publishAt dates: format and coherence with status. */
export function checkPublishAtCoherence(manifest: PagesManifestV1): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    const now = new Date();
    for (const page of manifest.pages) {
        if (!page.publishAt) continue;
        const d = new Date(page.publishAt);
        if (isNaN(d.getTime())) {
            warnings.push({
                type: 'cms-publishat-invalid',
                severity: 'error',
                file: 'pages.manifest.json',
                message: `Page "${page.id}" has invalid publishAt: "${page.publishAt}"`,
            });
            continue;
        }
        if (d < now && page.status !== 'published' && page.status !== undefined) {
            warnings.push({
                type: 'cms-publishat-past',
                severity: 'warning',
                file: 'pages.manifest.json',
                message: `Page "${page.id}" has publishAt in the past (${page.publishAt}) but status is "${page.status}" — should be "published"?`,
            });
        }
    }
    return warnings;
}

/** Warn if maintenanceMode is active. */
export function checkMaintenanceModeLeak(manifest: PagesManifestV1): CmsWarning[] {
    if ((manifest as any).maintenanceMode === true) {
        return [{
            type: 'cms-maintenance-mode-active',
            severity: 'warning',
            file: 'pages.manifest.json',
            message: 'maintenanceMode is TRUE — all pages will show maintenance screen in production. Intentional?',
        }];
    }
    return [];
}

/** Error if no "not-found" page exists in manifest. */
export function check404Exists(manifest: PagesManifestV1): CmsWarning[] {
    const has404 = manifest.pages.some((p) => p.id === 'not-found');
    if (!has404) {
        return [{
            type: 'cms-no-404-page',
            severity: 'error',
            file: 'pages.manifest.json',
            message: 'No "not-found" page in manifest — users hitting invalid URLs will see plain text',
        }];
    }
    return [];
}

/** Validate redirect rules: target exists, no chains. */
export function checkRedirects(manifest: PagesManifestV1, rules: RedirectRule[]): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    if (!rules.length) return warnings;
    const validRoutes = new Set(manifest.pages.map((p) => p.route));

    for (const rule of rules) {
        if (!validRoutes.has(rule.to)) {
            warnings.push({
                type: 'cms-redirect-target-missing',
                severity: 'error',
                file: 'redirects.json',
                message: `Redirect "${rule.from}" → "${rule.to}" targets a non-existent route`,
            });
        }
        const chainTarget = rules.find((r) => r.from === rule.to);
        if (chainTarget) {
            warnings.push({
                type: 'cms-redirect-chain',
                severity: 'warning',
                file: 'redirects.json',
                message: `Redirect chain: "${rule.from}" → "${rule.to}" → "${chainTarget.to}"`,
            });
        }
    }
    return warnings;
}

/**
 * Check that navigable published pages have SEO metadata.
 * Requires pre-loaded specs (the consumer handles I/O).
 */
export function checkSeoCompleteness(
    manifest: PagesManifestV1,
    specsById: Map<string, { seo?: SeoSpec }>,
): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    const skipIds = new Set(['not-found', 'maintenance', 'editor', 'templates']);

    for (const page of manifest.pages) {
        if (!page.nav) continue;
        if (page.status === 'draft') continue;
        if (page.id.startsWith('pag-work-')) continue;
        if (skipIds.has(page.id)) continue;

        const spec = specsById.get(page.id);
        if (!spec) continue;
        if (!spec.seo || (!spec.seo.metaTitle && !spec.seo.metaDescription)) {
            warnings.push({
                type: 'cms-seo-missing',
                severity: 'warning',
                file: page.spec,
                message: `Page "${page.id}" has navigation but no SEO block — add seo.metaTitle and seo.metaDescription`,
            });
        }
    }
    return warnings;
}

/** Run all pure CMS guardrails. Returns combined warnings. */
export function collectPureCmsWarnings(
    manifest: PagesManifestV1,
    options?: {
        redirectRules?: RedirectRule[];
        specsById?: Map<string, { seo?: SeoSpec }>;
    },
): CmsWarning[] {
    return [
        ...checkDraftOrphans(manifest),
        ...checkPublishAtCoherence(manifest),
        ...checkMaintenanceModeLeak(manifest),
        ...check404Exists(manifest),
        ...checkRedirects(manifest, options?.redirectRules ?? []),
        ...(options?.specsById ? checkSeoCompleteness(manifest, options.specsById) : []),
    ];
}

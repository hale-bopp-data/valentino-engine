/**
 * CMS Guardrails — Pure validation rules for CMS capabilities.
 * Migrated from easyway-portal scripts/guardrails-cms.mjs (PBI #606).
 * Extended with media, language, breadcrumb, and route checks (PBI #605).
 * No I/O (no fs, no fetch) — works on pre-loaded data only.
 */
import type { ManifestPageV1, PagesManifestV1 } from './types.js';
import type { RedirectRule } from './redirects.js';
import type { SeoSpec } from './seo.js';
import type { MediaAsset, MediaManifest } from './media.js';

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
    if (manifest.maintenanceMode === true) {
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

/**
 * Check that ogImage in page specs references an existing media key.
 * Requires pre-loaded specs and media manifest.
 */
export function checkOgImageExists(
    specsById: Map<string, { seo?: SeoSpec }>,
    mediaManifest: MediaManifest,
): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    const mediaKeys = new Set(mediaManifest.assets.map((a) => a.key));

    for (const [pageId, spec] of specsById) {
        const ogImage = spec.seo?.ogImage;
        if (!ogImage) continue;
        // Skip if it looks like a path/URL (only validate media key references)
        if (ogImage.includes('/') || ogImage.includes('.')) continue;
        if (!mediaKeys.has(ogImage)) {
            warnings.push({
                type: 'cms-og-image-missing',
                severity: 'warning',
                file: `/pages/${pageId}.json`,
                message: `Page "${pageId}" has seo.ogImage="${ogImage}" but no matching media asset found`,
            });
        }
    }
    return warnings;
}

/**
 * Find media assets not referenced by any page spec.
 * Scans all spec sections for media keys in known fields.
 */
export function checkMediaOrphans(
    specsById: Map<string, { seo?: SeoSpec; sections?: Array<Record<string, any>> }>,
    mediaManifest: MediaManifest,
): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    if (!mediaManifest.assets.length) return warnings;

    // Collect all referenced media keys from specs
    const referencedKeys = new Set<string>();

    for (const [, spec] of specsById) {
        // OG image
        if (spec.seo?.ogImage) referencedKeys.add(spec.seo.ogImage);

        // Scan sections for common media fields
        for (const section of spec.sections ?? []) {
            const json = JSON.stringify(section);
            for (const asset of mediaManifest.assets) {
                if (json.includes(asset.key) || json.includes(asset.file)) {
                    referencedKeys.add(asset.key);
                }
            }
        }
    }

    for (const asset of mediaManifest.assets) {
        if (!referencedKeys.has(asset.key)) {
            warnings.push({
                type: 'cms-media-orphan',
                severity: 'warning',
                file: 'media.manifest.json',
                message: `Media asset "${asset.key}" (${asset.file}) is not referenced by any page spec`,
            });
        }
    }
    return warnings;
}

/** Warn about media assets without alt text (accessibility). */
export function checkMediaMissingAlt(mediaManifest: MediaManifest): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    for (const asset of mediaManifest.assets) {
        if (!asset.alt || !asset.alt.trim()) {
            warnings.push({
                type: 'cms-media-missing-alt',
                severity: 'warning',
                file: 'media.manifest.json',
                message: `Media asset "${asset.key}" has no alt text — accessibility issue`,
            });
        }
    }
    return warnings;
}

/** Warn about pages with deep routes (3+ segments) that may need intermediate breadcrumb pages. */
export function checkBreadcrumbDepth(manifest: PagesManifestV1): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    const routes = new Set(manifest.pages.map((p) => p.route));

    for (const page of manifest.pages) {
        const segments = page.route.split('/').filter(Boolean);
        if (segments.length < 3) continue;
        // Check if parent route exists
        const parentRoute = '/' + segments.slice(0, -1).join('/');
        if (!routes.has(parentRoute)) {
            warnings.push({
                type: 'cms-breadcrumb-depth',
                severity: 'warning',
                file: 'pages.manifest.json',
                message: `Page "${page.id}" has deep route "${page.route}" but parent "${parentRoute}" doesn't exist — breadcrumb will have gaps`,
            });
        }
    }
    return warnings;
}

/**
 * Check language coverage: keys in one language map missing from another.
 * Accepts flattened key sets (consumer handles the JSON loading/flattening).
 */
export function checkLanguageCoverage(
    contentByLang: Map<string, Set<string>>,
): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    const langs = [...contentByLang.keys()];

    for (let i = 0; i < langs.length; i++) {
        for (let j = i + 1; j < langs.length; j++) {
            const langA = langs[i];
            const langB = langs[j];
            const keysA = contentByLang.get(langA)!;
            const keysB = contentByLang.get(langB)!;

            for (const key of keysA) {
                if (!keysB.has(key)) {
                    warnings.push({
                        type: 'cms-language-coverage',
                        severity: 'warning',
                        file: `content/${langA}.json`,
                        message: `Key "${key}" exists in ${langA.toUpperCase()} but not in ${langB.toUpperCase()}`,
                    });
                }
            }
            for (const key of keysB) {
                if (!keysA.has(key)) {
                    warnings.push({
                        type: 'cms-language-coverage',
                        severity: 'warning',
                        file: `content/${langB}.json`,
                        message: `Key "${key}" exists in ${langB.toUpperCase()} but not in ${langA.toUpperCase()}`,
                    });
                }
            }
        }
    }
    return warnings;
}

/** Error if manifest has duplicate routes. */
export function checkDuplicateRoutes(manifest: PagesManifestV1): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    const seen = new Map<string, string>();

    for (const page of manifest.pages) {
        const existing = seen.get(page.route);
        if (existing) {
            warnings.push({
                type: 'cms-duplicate-route',
                severity: 'error',
                file: 'pages.manifest.json',
                message: `Route "${page.route}" is claimed by both "${existing}" and "${page.id}"`,
            });
        } else {
            seen.set(page.route, page.id);
        }
    }
    return warnings;
}

/** Run all pure CMS guardrails. Returns combined warnings. */
export function collectPureCmsWarnings(
    manifest: PagesManifestV1,
    options?: {
        redirectRules?: RedirectRule[];
        specsById?: Map<string, { seo?: SeoSpec; sections?: Array<Record<string, any>> }>;
        mediaManifest?: MediaManifest;
        contentByLang?: Map<string, Set<string>>;
    },
): CmsWarning[] {
    return [
        ...checkDraftOrphans(manifest),
        ...checkPublishAtCoherence(manifest),
        ...checkMaintenanceModeLeak(manifest),
        ...check404Exists(manifest),
        ...checkDuplicateRoutes(manifest),
        ...checkBreadcrumbDepth(manifest),
        ...checkRedirects(manifest, options?.redirectRules ?? []),
        ...(options?.specsById ? checkSeoCompleteness(manifest, options.specsById) : []),
        ...(options?.specsById && options?.mediaManifest ? checkOgImageExists(options.specsById, options.mediaManifest) : []),
        ...(options?.specsById && options?.mediaManifest ? checkMediaOrphans(options.specsById, options.mediaManifest) : []),
        ...(options?.mediaManifest ? checkMediaMissingAlt(options.mediaManifest) : []),
        ...(options?.contentByLang ? checkLanguageCoverage(options.contentByLang) : []),
    ];
}

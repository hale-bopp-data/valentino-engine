/**
 * LLMs.txt Generator — Pure functions to produce llms.txt and llms-full.txt
 * from a PagesManifest and optional content/spec data.
 * No I/O — the consumer provides the loaded data.
 *
 * llms.txt  = L0 Matrioska (max ~50 lines, site index for LLM agents)
 * llms-full.txt = L1 Matrioska (detailed per-page breakdown)
 *
 * Follows the emerging llms.txt standard (like robots.txt for AI crawlers).
 */
import type { PagesManifestV1, PageSpecV1 } from './types.js';
import type { SeoSpec } from './seo.js';

export type LlmsGeneratorOptions = {
    /** Site name displayed in the header */
    siteName: string;
    /** One-line tagline / description */
    tagline?: string;
    /** Base URL (e.g. https://example.com) — used in llms-full.txt links */
    baseUrl?: string;
    /** Capabilities bullet points */
    capabilities?: string[];
    /** Content resolver: given a content key, returns the string value (or undefined) */
    resolveContent?: (key: string) => string | undefined;
    /** Pre-loaded page specs by page id (for llms-full.txt section details) */
    specsById?: Map<string, PageSpecV1>;
};

/**
 * Generate llms.txt — compact site index (L0 Matrioska).
 * Max ~50 lines: header, pages list, capabilities.
 */
export function generateLlmsTxt(
    manifest: PagesManifestV1,
    options: LlmsGeneratorOptions,
): string {
    const lines: string[] = [];
    const { siteName, tagline, capabilities, resolveContent } = options;

    // Header
    lines.push(`# ${siteName}`);
    if (tagline) lines.push(`> ${tagline}`);
    lines.push('');

    // Pages — only published/visible pages with navigation
    const visiblePages = manifest.pages.filter((p) =>
        p.status !== 'draft' && p.nav
    );

    if (visiblePages.length > 0) {
        lines.push('## Pages');
        for (const page of visiblePages) {
            const label = resolveContent && page.nav?.labelKey
                ? resolveContent(page.nav.labelKey) || page.id
                : page.id;
            const titleKey = page.titleKey;
            const desc = titleKey && resolveContent
                ? resolveContent(titleKey) || ''
                : '';
            const suffix = desc && desc !== label ? ` — ${desc}` : '';
            lines.push(`- ${page.route}: ${label}${suffix}`);
        }
        lines.push('');
    }

    // Capabilities
    if (capabilities && capabilities.length > 0) {
        lines.push('## Capabilities');
        for (const cap of capabilities) {
            lines.push(`- ${cap}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Generate llms-full.txt — detailed per-page breakdown (L1 Matrioska).
 * Includes section types, SEO metadata, and page purpose.
 */
export function generateLlmsFullTxt(
    manifest: PagesManifestV1,
    options: LlmsGeneratorOptions,
): string {
    const lines: string[] = [];
    const { siteName, tagline, baseUrl, resolveContent, specsById } = options;

    // Header
    lines.push(`# ${siteName} — Full Site Map`);
    if (tagline) lines.push(`> ${tagline}`);
    if (baseUrl) lines.push(`> ${baseUrl}`);
    lines.push('');

    // All non-draft pages
    const pages = manifest.pages.filter((p) => p.status !== 'draft');

    for (const page of pages) {
        const label = resolveContent && page.nav?.labelKey
            ? resolveContent(page.nav.labelKey) || page.id
            : page.id;

        const url = baseUrl ? `${baseUrl}${page.route}` : page.route;
        lines.push(`## ${label}`);
        lines.push(`- URL: ${url}`);
        lines.push(`- Route: ${page.route}`);

        // SEO from spec
        const spec = specsById?.get(page.id);
        if (spec?.seo) {
            if (spec.seo.metaTitle) lines.push(`- Title: ${spec.seo.metaTitle}`);
            if (spec.seo.metaDescription) lines.push(`- Description: ${spec.seo.metaDescription}`);
        }

        // Section breakdown
        if (spec?.sections && spec.sections.length > 0) {
            const sectionTypes = spec.sections.map((s) => s.type);
            const uniqueTypes = [...new Set(sectionTypes)];
            lines.push(`- Sections (${spec.sections.length}): ${uniqueTypes.join(', ')}`);
        }

        // Navigation info
        if (page.nav) {
            lines.push(`- Navigation: visible (order ${page.nav.order ?? 'auto'})`);
        } else {
            lines.push('- Navigation: hidden');
        }

        lines.push('');
    }

    // Languages
    if (manifest.defaultLanguage) {
        lines.push(`## Languages`);
        lines.push(`- Default: ${manifest.defaultLanguage}`);
        lines.push('');
    }

    return lines.join('\n');
}

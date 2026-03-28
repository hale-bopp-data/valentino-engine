/**
 * Template Gallery — Pure helpers for enumerating catalog entries.
 * PBI #610 — Provides gallery-ready metadata from ValentinoCatalogV1.
 *
 * No DOM, no fetch — pure functions only.
 * The consumer (portal) renders the gallery UI.
 */

import type {
    ValentinoCatalogV1,
    ValentinoPageBlueprintEntry,
    ValentinoTemplateEntry,
    PageSpecV1,
    PagesManifestV1,
    ManifestPageV1,
    SectionSpec,
} from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GalleryEntryKind = 'blueprint' | 'template' | 'page';

export type GalleryEntry = {
    /** Unique key (blueprint ID, template ID, or page ID) */
    id: string;
    kind: GalleryEntryKind;
    /** Display name (derived from ID) */
    name: string;
    /** Description for the gallery card */
    description: string;
    /** Page profile (if available) */
    profile?: string;
    /** Theme ID (if available) */
    themeId?: string;
    /** Number of sections in the blueprint/page */
    sectionCount: number;
    /** Section types present (for preview/filtering) */
    sectionTypes: string[];
    /** Governance tier (if available) */
    governanceTier?: string;
};

export type GalleryFilter = {
    kind?: GalleryEntryKind | GalleryEntryKind[];
    profile?: string;
    sectionType?: string;
    search?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a kebab-case or camelCase ID to a human-readable name */
function humanize(id: string): string {
    return id
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

function uniqueSectionTypes(sections: SectionSpec[]): string[] {
    return [...new Set(sections.map(s => s.type))];
}

// ---------------------------------------------------------------------------
// Entry builders
// ---------------------------------------------------------------------------

function blueprintToEntry(id: string, entry: ValentinoPageBlueprintEntry): GalleryEntry {
    const spec = entry.spec;
    return {
        id,
        kind: 'blueprint',
        name: humanize(id),
        description: `Blueprint: ${spec.sections.length} sections, profile ${spec.profile || 'generic'}`,
        profile: spec.profile,
        themeId: spec.themeId,
        sectionCount: spec.sections.length,
        sectionTypes: uniqueSectionTypes(spec.sections),
        governanceTier: entry.governance?.tier,
    };
}

function templateToEntry(id: string, entry: ValentinoTemplateEntry): GalleryEntry {
    return {
        id,
        kind: 'template',
        name: humanize(id),
        description: `Template: profile ${entry.page?.profile || 'generic'}`,
        profile: entry.page?.profile,
        themeId: entry.page?.themeId,
        sectionCount: 0,
        sectionTypes: [],
    };
}

function manifestPageToEntry(page: ManifestPageV1, pageSpec?: PageSpecV1): GalleryEntry {
    const sections = pageSpec?.sections || [];
    return {
        id: page.id,
        kind: 'page',
        name: humanize(page.id),
        description: `Page: ${page.route}`,
        profile: pageSpec?.profile,
        themeId: pageSpec?.themeId,
        sectionCount: sections.length,
        sectionTypes: uniqueSectionTypes(sections),
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all gallery entries from a catalog.
 * Returns blueprints first, then templates.
 */
export function listCatalogEntries(catalog: ValentinoCatalogV1): GalleryEntry[] {
    const entries: GalleryEntry[] = [];

    for (const [id, entry] of Object.entries(catalog.pageBlueprints)) {
        entries.push(blueprintToEntry(id, entry));
    }

    for (const [id, entry] of Object.entries(catalog.templates)) {
        entries.push(templateToEntry(id, entry));
    }

    return entries;
}

/**
 * List gallery entries from a pages manifest (existing pages as starting points).
 * Optionally provide a specs map (pageId -> PageSpecV1) for richer metadata.
 */
export function listPageEntries(
    manifest: PagesManifestV1,
    specs?: Map<string, PageSpecV1>,
): GalleryEntry[] {
    return manifest.pages
        .filter(p => p.status === 'published')
        .map(p => manifestPageToEntry(p, specs?.get(p.id)));
}

/**
 * List all gallery entries: catalog + manifest pages.
 */
export function listAllGalleryEntries(
    catalog: ValentinoCatalogV1,
    manifest?: PagesManifestV1,
    specs?: Map<string, PageSpecV1>,
): GalleryEntry[] {
    const entries = listCatalogEntries(catalog);
    if (manifest) {
        entries.push(...listPageEntries(manifest, specs));
    }
    return entries;
}

/**
 * Filter gallery entries by criteria.
 */
export function filterGalleryEntries(
    entries: GalleryEntry[],
    filter: GalleryFilter,
): GalleryEntry[] {
    return entries.filter(entry => {
        if (filter.kind) {
            const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind];
            if (!kinds.includes(entry.kind)) return false;
        }
        if (filter.profile && entry.profile !== filter.profile) return false;
        if (filter.sectionType && !entry.sectionTypes.includes(filter.sectionType)) return false;
        if (filter.search) {
            const q = filter.search.toLowerCase();
            if (!entry.name.toLowerCase().includes(q) && !entry.description.toLowerCase().includes(q)) {
                return false;
            }
        }
        return true;
    });
}

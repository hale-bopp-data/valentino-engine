import { describe, it, expect } from 'vitest';
import { listCatalogEntries, listPageEntries, listAllGalleryEntries, filterGalleryEntries } from './gallery.js';
import type { ValentinoCatalogV1, PagesManifestV1 } from './types.js';

const catalog: ValentinoCatalogV1 = {
    version: '1',
    templates: {
        'product-tpl': { page: { profile: 'product-surface', themeId: 'dark' } },
    },
    sectionPresets: {},
    transitionProfiles: {},
    pageBlueprints: {
        'landing-bp': {
            spec: {
                version: '1',
                id: 'landing-bp',
                profile: 'home-signature',
                sections: [
                    { type: 'hero', titleKey: 'bp.hero.title' },
                    { type: 'cards', variant: 'catalog', items: [{ titleKey: 'bp.card1' }] },
                    { type: 'cta', titleKey: 'bp.cta.title' },
                ],
            },
        },
        'about-bp': {
            spec: {
                version: '1',
                id: 'about-bp',
                profile: 'reading-manifesto',
                sections: [
                    { type: 'hero', titleKey: 'about.hero.title' },
                    { type: 'manifesto', contentPrefix: 'about.manifesto' },
                ],
            },
            governance: { tier: 'standard' },
        },
    },
};

const manifest: PagesManifestV1 = {
    version: '1',
    pages: [
        { id: 'home', route: '/', spec: 'home.json', status: 'published' },
        { id: 'draft-page', route: '/draft', spec: 'draft.json', status: 'draft' },
        { id: 'about', route: '/about', spec: 'about.json', status: 'published' },
    ],
};

describe('listCatalogEntries', () => {
    it('returns blueprints and templates', () => {
        const entries = listCatalogEntries(catalog);
        expect(entries).toHaveLength(3); // 2 blueprints + 1 template
    });

    it('blueprints have section metadata', () => {
        const entries = listCatalogEntries(catalog);
        const landing = entries.find(e => e.id === 'landing-bp');
        expect(landing).toBeDefined();
        expect(landing!.kind).toBe('blueprint');
        expect(landing!.sectionCount).toBe(3);
        expect(landing!.sectionTypes).toContain('hero');
        expect(landing!.sectionTypes).toContain('cards');
        expect(landing!.sectionTypes).toContain('cta');
    });

    it('templates have kind template', () => {
        const entries = listCatalogEntries(catalog);
        const tpl = entries.find(e => e.id === 'product-tpl');
        expect(tpl).toBeDefined();
        expect(tpl!.kind).toBe('template');
        expect(tpl!.profile).toBe('product-surface');
    });

    it('includes governance tier', () => {
        const entries = listCatalogEntries(catalog);
        const about = entries.find(e => e.id === 'about-bp');
        expect(about!.governanceTier).toBe('standard');
    });
});

describe('listPageEntries', () => {
    it('returns only published pages', () => {
        const entries = listPageEntries(manifest);
        expect(entries).toHaveLength(2);
        expect(entries.map(e => e.id)).toContain('home');
        expect(entries.map(e => e.id)).toContain('about');
        expect(entries.map(e => e.id)).not.toContain('draft-page');
    });

    it('entries have kind page', () => {
        const entries = listPageEntries(manifest);
        expect(entries.every(e => e.kind === 'page')).toBe(true);
    });
});

describe('listAllGalleryEntries', () => {
    it('combines catalog and manifest', () => {
        const entries = listAllGalleryEntries(catalog, manifest);
        expect(entries.length).toBe(5); // 2 bp + 1 tpl + 2 published pages
    });

    it('works with catalog only', () => {
        const entries = listAllGalleryEntries(catalog);
        expect(entries).toHaveLength(3);
    });
});

describe('filterGalleryEntries', () => {
    const all = listAllGalleryEntries(catalog, manifest);

    it('filters by kind', () => {
        const blueprints = filterGalleryEntries(all, { kind: 'blueprint' });
        expect(blueprints).toHaveLength(2);
        expect(blueprints.every(e => e.kind === 'blueprint')).toBe(true);
    });

    it('filters by multiple kinds', () => {
        const result = filterGalleryEntries(all, { kind: ['blueprint', 'template'] });
        expect(result).toHaveLength(3);
    });

    it('filters by profile', () => {
        const result = filterGalleryEntries(all, { profile: 'home-signature' });
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result.every(e => e.profile === 'home-signature')).toBe(true);
    });

    it('filters by section type', () => {
        const result = filterGalleryEntries(all, { sectionType: 'manifesto' });
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result.every(e => e.sectionTypes.includes('manifesto'))).toBe(true);
    });

    it('filters by search text', () => {
        const result = filterGalleryEntries(all, { search: 'landing' });
        expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('combines filters', () => {
        const result = filterGalleryEntries(all, { kind: 'blueprint', profile: 'home-signature' });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('landing-bp');
    });
});

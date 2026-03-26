import { describe, it, expect } from 'vitest';
import {
    getPageStatus, getPublishAt, isPageVisible,
    findRedirect,
    resolveMediaUrl, resolveMediaAsset,
    buildWebPageSchema,
} from '../src/index.js';
import type { ManifestPageV1, MediaManifest } from '../src/index.js';

// ---------------------------------------------------------------------------
// Page Status
// ---------------------------------------------------------------------------
describe('page-status', () => {
    const published: ManifestPageV1 = { id: 'home', route: '/', spec: 'home.json' };
    const draft: ManifestPageV1 = { id: 'wip', route: '/wip', spec: 'wip.json', status: 'draft' };
    const scheduled: ManifestPageV1 = {
        id: 'launch', route: '/launch', spec: 'launch.json',
        publishAt: '2099-12-31T00:00:00Z',
    };
    const pastScheduled: ManifestPageV1 = {
        id: 'old', route: '/old', spec: 'old.json',
        publishAt: '2020-01-01T00:00:00Z',
    };

    it('returns published for a normal page', () => {
        expect(getPageStatus(published)).toBe('published');
    });

    it('returns draft for a draft page', () => {
        expect(getPageStatus(draft)).toBe('draft');
    });

    it('returns scheduled for a page with publishAt', () => {
        expect(getPageStatus(scheduled)).toBe('scheduled');
    });

    it('getPublishAt returns Date for valid ISO', () => {
        expect(getPublishAt(scheduled)).toBeInstanceOf(Date);
    });

    it('getPublishAt returns null when missing', () => {
        expect(getPublishAt(published)).toBeNull();
    });

    it('isPageVisible hides draft pages', () => {
        expect(isPageVisible(draft)).toBe(false);
    });

    it('isPageVisible shows draft in devMode', () => {
        expect(isPageVisible(draft, { devMode: true })).toBe(true);
    });

    it('isPageVisible hides future scheduled pages', () => {
        expect(isPageVisible(scheduled)).toBe(false);
    });

    it('isPageVisible shows past scheduled pages', () => {
        expect(isPageVisible(pastScheduled)).toBe(true);
    });

    it('isPageVisible shows published pages', () => {
        expect(isPageVisible(published)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------
describe('redirects', () => {
    const rules = [
        { from: '/old-page', to: '/new-page' },
        { from: '/legacy', to: '/' },
    ];

    it('finds a matching redirect', () => {
        expect(findRedirect('/old-page', rules)).toBe('/new-page');
    });

    it('normalizes trailing slash', () => {
        expect(findRedirect('/old-page/', rules)).toBe('/new-page');
    });

    it('returns null for no match', () => {
        expect(findRedirect('/unknown', rules)).toBeNull();
    });

    it('does not strip trailing slash from root', () => {
        expect(findRedirect('/', rules)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
describe('media', () => {
    const manifest: MediaManifest = {
        version: '1',
        assets: [
            { key: 'logo', file: '/media/logo.png', alt: 'Logo' },
            { key: 'hero-bg', file: '/media/hero.jpg', width: 1920, height: 1080 },
        ],
    };

    it('resolves a media URL by key', () => {
        expect(resolveMediaUrl(manifest, 'logo')).toBe('/media/logo.png');
    });

    it('returns null for unknown key', () => {
        expect(resolveMediaUrl(manifest, 'nope')).toBeNull();
    });

    it('resolves full asset with metadata', () => {
        const asset = resolveMediaAsset(manifest, 'hero-bg');
        expect(asset).not.toBeNull();
        expect(asset!.width).toBe(1920);
    });
});

// ---------------------------------------------------------------------------
// SEO — Schema.org builder
// ---------------------------------------------------------------------------
describe('seo', () => {
    it('builds a basic WebPage schema', () => {
        const schema = buildWebPageSchema({ title: 'Test', url: 'https://example.com/test' });
        expect(schema['@type']).toBe('WebPage');
        expect(schema.name).toBe('Test');
    });

    it('includes breadcrumb when provided', () => {
        const schema = buildWebPageSchema({
            title: 'About',
            url: 'https://example.com/about',
            breadcrumbName: 'About',
            breadcrumbBaseUrl: 'https://example.com',
        });
        expect(schema.breadcrumb).toBeDefined();
    });

    it('maps form section to ContactPoint', () => {
        const schema = buildWebPageSchema({
            title: 'Contact',
            url: 'https://example.com/contact',
            sectionTypes: ['hero', 'form'],
        });
        expect((schema.mainEntity as any)['@type']).toBe('ContactPoint');
    });

    it('maps advisor section to Service', () => {
        const schema = buildWebPageSchema({
            title: 'Advisor',
            url: 'https://example.com/advisor',
            sectionTypes: ['hero', 'advisor'],
        });
        expect((schema.mainEntity as any)['@type']).toBe('Service');
    });
});

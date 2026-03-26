import { describe, it, expect } from 'vitest';
import {
    checkDraftOrphans, checkPublishAtCoherence, checkMaintenanceModeLeak,
    check404Exists, checkRedirects, checkSeoCompleteness, collectPureCmsWarnings,
} from '../src/index.js';
import type { PagesManifestV1 } from '../src/index.js';

const baseManifest: PagesManifestV1 = {
    version: '1',
    defaultLanguage: 'it',
    navigation: { interactionMode: 'hover', items: [] },
    pages: [
        { id: 'home', route: '/', spec: '/pages/home.json' },
        { id: 'about', route: '/about', spec: '/pages/about.json', nav: { labelKey: 'nav.about', order: 20 } },
        { id: 'not-found', route: '/404', spec: '/pages/not-found.json' },
    ],
};

describe('checkDraftOrphans', () => {
    it('no warnings for published pages', () => {
        expect(checkDraftOrphans(baseManifest)).toHaveLength(0);
    });

    it('warns for draft without publishAt', () => {
        const m = { ...baseManifest, pages: [...baseManifest.pages, { id: 'wip', route: '/wip', spec: 'wip.json', status: 'draft' as const }] };
        const w = checkDraftOrphans(m);
        expect(w).toHaveLength(1);
        expect(w[0].type).toBe('cms-draft-orphan');
    });

    it('no warning for draft with publishAt', () => {
        const m = { ...baseManifest, pages: [...baseManifest.pages, { id: 'wip', route: '/wip', spec: 'wip.json', status: 'draft' as const, publishAt: '2099-01-01T00:00:00Z' }] };
        expect(checkDraftOrphans(m)).toHaveLength(0);
    });
});

describe('checkPublishAtCoherence', () => {
    it('errors on invalid date', () => {
        const m = { ...baseManifest, pages: [{ id: 'bad', route: '/bad', spec: 'bad.json', publishAt: 'not-a-date' }] };
        const w = checkPublishAtCoherence(m);
        expect(w[0].severity).toBe('error');
        expect(w[0].type).toBe('cms-publishat-invalid');
    });
});

describe('checkMaintenanceModeLeak', () => {
    it('no warning when off', () => {
        expect(checkMaintenanceModeLeak(baseManifest)).toHaveLength(0);
    });

    it('warns when maintenanceMode is true', () => {
        const m = { ...baseManifest, maintenanceMode: true };
        expect(checkMaintenanceModeLeak(m as any)).toHaveLength(1);
    });
});

describe('check404Exists', () => {
    it('passes with not-found page', () => {
        expect(check404Exists(baseManifest)).toHaveLength(0);
    });

    it('errors without not-found page', () => {
        const m = { ...baseManifest, pages: baseManifest.pages.filter(p => p.id !== 'not-found') };
        const w = check404Exists(m);
        expect(w[0].severity).toBe('error');
    });
});

describe('checkRedirects', () => {
    it('no warnings for valid redirects', () => {
        const rules = [{ from: '/old', to: '/about' }];
        expect(checkRedirects(baseManifest, rules)).toHaveLength(0);
    });

    it('errors on redirect to missing route', () => {
        const rules = [{ from: '/old', to: '/nonexistent' }];
        const w = checkRedirects(baseManifest, rules);
        expect(w[0].type).toBe('cms-redirect-target-missing');
    });

    it('warns on redirect chain', () => {
        const rules = [{ from: '/a', to: '/b' }, { from: '/b', to: '/' }];
        const w = checkRedirects(baseManifest, rules);
        expect(w.some(w => w.type === 'cms-redirect-chain')).toBe(true);
    });
});

describe('checkSeoCompleteness', () => {
    it('warns for navigable page without SEO', () => {
        const specs = new Map([['about', {}]]);
        const w = checkSeoCompleteness(baseManifest, specs);
        expect(w[0].type).toBe('cms-seo-missing');
    });

    it('passes for navigable page with SEO', () => {
        const specs = new Map([['about', { seo: { metaTitle: 'About Us' } }]]);
        expect(checkSeoCompleteness(baseManifest, specs)).toHaveLength(0);
    });
});

describe('collectPureCmsWarnings', () => {
    it('runs all checks', () => {
        const w = collectPureCmsWarnings(baseManifest);
        expect(Array.isArray(w)).toBe(true);
    });
});

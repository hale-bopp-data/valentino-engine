import { describe, it, expect } from 'vitest';
import {
    checkDraftOrphans, checkPublishAtCoherence, checkMaintenanceModeLeak,
    check404Exists, checkRedirects, checkSeoCompleteness,
    checkOgImageExists, checkMediaOrphans, checkMediaMissingAlt,
    checkBreadcrumbDepth, checkLanguageCoverage, checkDuplicateRoutes,
    collectPureCmsWarnings,
} from '../src/index.js';
import type { PagesManifestV1, MediaManifest } from '../src/index.js';

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

// --- New guardrails (PBI #605) ---

const baseMedia: MediaManifest = {
    version: '1',
    assets: [
        { key: 'og-home', file: '/media/og-home.png', alt: 'Home page preview' },
        { key: 'hero-bg', file: '/media/hero.webp', alt: 'Hero background' },
        { key: 'unused-logo', file: '/media/logo.svg', alt: '' },
    ],
};

describe('checkOgImageExists', () => {
    it('no warning when ogImage matches media key', () => {
        const specs = new Map([['home', { seo: { ogImage: 'og-home' } }]]);
        expect(checkOgImageExists(specs, baseMedia)).toHaveLength(0);
    });

    it('warns when ogImage key not in media manifest', () => {
        const specs = new Map([['home', { seo: { ogImage: 'nonexistent-key' } }]]);
        const w = checkOgImageExists(specs, baseMedia);
        expect(w).toHaveLength(1);
        expect(w[0].type).toBe('cms-og-image-missing');
    });

    it('skips path-like ogImage values', () => {
        const specs = new Map([['home', { seo: { ogImage: '/images/og.png' } }]]);
        expect(checkOgImageExists(specs, baseMedia)).toHaveLength(0);
    });

    it('no warning when no ogImage set', () => {
        const specs = new Map([['home', { seo: { metaTitle: 'Hello' } }]]);
        expect(checkOgImageExists(specs, baseMedia)).toHaveLength(0);
    });
});

describe('checkMediaOrphans', () => {
    it('detects unreferenced media assets', () => {
        const specs = new Map([['home', { seo: { ogImage: 'og-home' }, sections: [{ type: 'hero', bgKey: 'hero-bg' }] }]]);
        const w = checkMediaOrphans(specs, baseMedia);
        expect(w.some(w => w.message.includes('unused-logo'))).toBe(true);
    });

    it('no warnings when all media referenced', () => {
        const specs = new Map([['home', {
            seo: { ogImage: 'og-home' },
            sections: [{ type: 'hero', bgKey: 'hero-bg' }, { type: 'cta', icon: 'unused-logo' }],
        }]]);
        expect(checkMediaOrphans(specs, baseMedia)).toHaveLength(0);
    });

    it('no warnings with empty manifest', () => {
        const specs = new Map([['home', { sections: [] }]]);
        expect(checkMediaOrphans(specs, { version: '1', assets: [] })).toHaveLength(0);
    });
});

describe('checkMediaMissingAlt', () => {
    it('warns for empty alt text', () => {
        const w = checkMediaMissingAlt(baseMedia);
        expect(w).toHaveLength(1);
        expect(w[0].message).toContain('unused-logo');
    });

    it('no warnings when all have alt', () => {
        const m: MediaManifest = { version: '1', assets: [{ key: 'a', file: 'a.png', alt: 'A image' }] };
        expect(checkMediaMissingAlt(m)).toHaveLength(0);
    });

    it('warns for missing alt field', () => {
        const m: MediaManifest = { version: '1', assets: [{ key: 'a', file: 'a.png' }] };
        expect(checkMediaMissingAlt(m)).toHaveLength(1);
    });
});

describe('checkBreadcrumbDepth', () => {
    it('no warnings for shallow routes', () => {
        expect(checkBreadcrumbDepth(baseManifest)).toHaveLength(0);
    });

    it('warns for deep route without parent', () => {
        const m = {
            ...baseManifest,
            pages: [...baseManifest.pages, { id: 'deep', route: '/docs/api/auth', spec: 'deep.json' }],
        };
        const w = checkBreadcrumbDepth(m);
        expect(w).toHaveLength(1);
        expect(w[0].type).toBe('cms-breadcrumb-depth');
    });

    it('no warning when parent route exists', () => {
        const m = {
            ...baseManifest,
            pages: [
                ...baseManifest.pages,
                { id: 'docs-api', route: '/docs/api', spec: 'api.json' },
                { id: 'deep', route: '/docs/api/auth', spec: 'deep.json' },
            ],
        };
        expect(checkBreadcrumbDepth(m)).toHaveLength(0);
    });
});

describe('checkLanguageCoverage', () => {
    it('warns for keys in one language but not another', () => {
        const content = new Map([
            ['it', new Set(['nav.home', 'nav.about', 'hero.title'])],
            ['en', new Set(['nav.home', 'nav.about'])],
        ]);
        const w = checkLanguageCoverage(content);
        expect(w).toHaveLength(1);
        expect(w[0].message).toContain('hero.title');
    });

    it('no warnings when languages are aligned', () => {
        const content = new Map([
            ['it', new Set(['nav.home', 'nav.about'])],
            ['en', new Set(['nav.home', 'nav.about'])],
        ]);
        expect(checkLanguageCoverage(content)).toHaveLength(0);
    });

    it('detects gaps in both directions', () => {
        const content = new Map([
            ['it', new Set(['a', 'b'])],
            ['en', new Set(['b', 'c'])],
        ]);
        const w = checkLanguageCoverage(content);
        expect(w).toHaveLength(2); // 'a' missing in EN, 'c' missing in IT
    });
});

describe('checkDuplicateRoutes', () => {
    it('no warnings for unique routes', () => {
        expect(checkDuplicateRoutes(baseManifest)).toHaveLength(0);
    });

    it('errors on duplicate routes', () => {
        const m = {
            ...baseManifest,
            pages: [...baseManifest.pages, { id: 'about-v2', route: '/about', spec: 'about-v2.json' }],
        };
        const w = checkDuplicateRoutes(m);
        expect(w).toHaveLength(1);
        expect(w[0].severity).toBe('error');
        expect(w[0].type).toBe('cms-duplicate-route');
    });
});

describe('collectPureCmsWarnings', () => {
    it('runs all checks', () => {
        const w = collectPureCmsWarnings(baseManifest);
        expect(Array.isArray(w)).toBe(true);
    });

    it('includes new checks when options provided', () => {
        const w = collectPureCmsWarnings(baseManifest, {
            mediaManifest: baseMedia,
            contentByLang: new Map([
                ['it', new Set(['nav.home'])],
                ['en', new Set(['nav.home'])],
            ]),
        });
        expect(Array.isArray(w)).toBe(true);
    });
});

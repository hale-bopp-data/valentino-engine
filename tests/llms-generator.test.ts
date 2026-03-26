import { describe, it, expect } from 'vitest';
import { generateLlmsTxt, generateLlmsFullTxt } from '../src/index.js';
import type { PagesManifestV1, PageSpecV1 } from '../src/index.js';

const manifest: PagesManifestV1 = {
    version: '1',
    defaultLanguage: 'it',
    navigation: { interactionMode: 'hover', items: [] },
    pages: [
        { id: 'home', route: '/', spec: '/pages/home.json', nav: { labelKey: 'nav.home', order: 10 }, titleKey: 'home.title' },
        { id: 'about', route: '/about', spec: '/pages/about.json', nav: { labelKey: 'nav.about', order: 20 }, titleKey: 'about.title' },
        { id: 'draft-page', route: '/draft', spec: '/pages/draft.json', status: 'draft' as const },
        { id: 'not-found', route: '/404', spec: '/pages/not-found.json' },
    ],
};

const contentMap: Record<string, string> = {
    'nav.home': 'Home',
    'nav.about': 'About Us',
    'home.title': 'Welcome to EasyWay',
    'about.title': 'Our Story',
};

const resolveContent = (key: string) => contentMap[key];

describe('generateLlmsTxt', () => {
    it('generates header with site name and tagline', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'EasyWay', tagline: 'Sovereign Intelligence' });
        expect(txt).toContain('# EasyWay');
        expect(txt).toContain('> Sovereign Intelligence');
    });

    it('lists visible navigable pages', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'Test', resolveContent });
        expect(txt).toContain('## Pages');
        expect(txt).toContain('/: Home');
        expect(txt).toContain('/about: About Us');
    });

    it('excludes draft pages', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'Test', resolveContent });
        expect(txt).not.toContain('draft-page');
        expect(txt).not.toContain('/draft');
    });

    it('excludes pages without nav', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'Test', resolveContent });
        expect(txt).not.toContain('not-found');
    });

    it('includes title description when different from label', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'Test', resolveContent });
        expect(txt).toContain('About Us — Our Story');
    });

    it('includes capabilities', () => {
        const txt = generateLlmsTxt(manifest, {
            siteName: 'Test',
            capabilities: ['CMS governato', 'Multilingua IT/EN'],
        });
        expect(txt).toContain('## Capabilities');
        expect(txt).toContain('- CMS governato');
        expect(txt).toContain('- Multilingua IT/EN');
    });

    it('stays under ~50 lines for small manifests', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'Test', resolveContent });
        const lines = txt.split('\n').length;
        expect(lines).toBeLessThanOrEqual(50);
    });

    it('works without resolveContent', () => {
        const txt = generateLlmsTxt(manifest, { siteName: 'Test' });
        expect(txt).toContain('## Pages');
        expect(txt).toContain('/: home');
    });
});

describe('generateLlmsFullTxt', () => {
    it('generates detailed header', () => {
        const txt = generateLlmsFullTxt(manifest, {
            siteName: 'EasyWay',
            tagline: 'Sovereign Intelligence',
            baseUrl: 'https://easywaydata.com',
        });
        expect(txt).toContain('# EasyWay — Full Site Map');
        expect(txt).toContain('> Sovereign Intelligence');
        expect(txt).toContain('> https://easywaydata.com');
    });

    it('includes URL and route for each page', () => {
        const txt = generateLlmsFullTxt(manifest, {
            siteName: 'Test',
            baseUrl: 'https://example.com',
            resolveContent,
        });
        expect(txt).toContain('- URL: https://example.com/');
        expect(txt).toContain('- URL: https://example.com/about');
        expect(txt).toContain('- Route: /about');
    });

    it('excludes draft pages', () => {
        const txt = generateLlmsFullTxt(manifest, { siteName: 'Test' });
        expect(txt).not.toContain('draft-page');
    });

    it('includes section breakdown from specs', () => {
        const specsById = new Map<string, PageSpecV1>([
            ['home', { id: 'home', sections: [{ type: 'hero' }, { type: 'cards' }, { type: 'cta' }] } as PageSpecV1],
        ]);
        const txt = generateLlmsFullTxt(manifest, { siteName: 'Test', resolveContent, specsById });
        expect(txt).toContain('Sections (3): hero, cards, cta');
    });

    it('includes SEO metadata from specs', () => {
        const specsById = new Map<string, PageSpecV1>([
            ['about', { id: 'about', seo: { metaTitle: 'About EasyWay', metaDescription: 'Our story.' }, sections: [] } as unknown as PageSpecV1],
        ]);
        const txt = generateLlmsFullTxt(manifest, { siteName: 'Test', resolveContent, specsById });
        expect(txt).toContain('- Title: About EasyWay');
        expect(txt).toContain('- Description: Our story.');
    });

    it('shows navigation visibility', () => {
        const txt = generateLlmsFullTxt(manifest, { siteName: 'Test', resolveContent });
        expect(txt).toContain('Navigation: visible');
        expect(txt).toContain('Navigation: hidden');
    });

    it('includes default language', () => {
        const txt = generateLlmsFullTxt(manifest, { siteName: 'Test' });
        expect(txt).toContain('## Languages');
        expect(txt).toContain('- Default: it');
    });
});

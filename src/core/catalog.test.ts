import { describe, it, expect } from 'vitest';
import { mergePresentation, isGovernanceAllowed, resolvePageSpecWithCatalog } from './catalog.js';
import type { PageSpecV1, ValentinoCatalogV1 } from './types.js';

const emptyCatalog: ValentinoCatalogV1 = {
    version: '1',
    templates: {},
    sectionPresets: {},
    transitionProfiles: {},
    pageBlueprints: {},
};

describe('mergePresentation', () => {
    it('returns undefined when all inputs are undefined', () => {
        expect(mergePresentation(undefined, undefined, undefined)).toBeUndefined();
    });

    it('merges preset + inline', () => {
        const result = mergePresentation(
            { surface: 'muted', tone: 'default' },
            undefined,
            { tone: 'elevated' },
        );
        expect(result).toEqual({ surface: 'muted', tone: 'elevated' });
    });

    it('inline overrides transition overrides preset', () => {
        const result = mergePresentation(
            { surface: 'muted' },
            { surface: 'accent' },
            { surface: 'dark' },
        );
        expect(result?.surface).toBe('dark');
    });
});

describe('isGovernanceAllowed', () => {
    it('allows everything when no governance', () => {
        expect(isGovernanceAllowed('hero', 'home-signature')).toBe(true);
    });

    it('blocks section type not in allowedSectionTypes', () => {
        expect(isGovernanceAllowed('hero', 'home-signature', {
            allowedSectionTypes: ['cards', 'cta'],
        })).toBe(false);
    });

    it('allows section type in allowedSectionTypes', () => {
        expect(isGovernanceAllowed('cards', 'home-signature', {
            allowedSectionTypes: ['cards', 'cta'],
        })).toBe(true);
    });

    it('blocks page profile not in allowedPageProfiles', () => {
        expect(isGovernanceAllowed('hero', 'conversion-form', {
            allowedPageProfiles: ['home-signature'],
        })).toBe(false);
    });

    it('allows page profile in allowedPageProfiles', () => {
        expect(isGovernanceAllowed('hero', 'home-signature', {
            allowedPageProfiles: ['home-signature'],
        })).toBe(true);
    });

    it('blocks when page profile is undefined', () => {
        expect(isGovernanceAllowed('hero', undefined, {
            allowedPageProfiles: ['home-signature'],
        })).toBe(false);
    });
});

describe('resolvePageSpecWithCatalog', () => {
    it('passes through a spec with no catalog refs', () => {
        const spec: PageSpecV1 = {
            version: '1',
            id: 'test',
            sections: [{ type: 'hero', titleKey: 'h1' }],
        };
        const resolved = resolvePageSpecWithCatalog(spec, emptyCatalog);
        expect(resolved.id).toBe('test');
        expect(resolved.sections).toHaveLength(1);
    });

    it('resolves preset presentation', () => {
        const catalog: ValentinoCatalogV1 = {
            ...emptyCatalog,
            sectionPresets: {
                'hero-home': { presentation: { surface: 'shell-dark', tone: 'immersive' } },
            },
        };
        const spec: PageSpecV1 = {
            version: '1',
            id: 'test',
            sections: [{
                type: 'hero',
                titleKey: 'h1',
                presentation: { presetId: 'hero-home' },
            }],
        };
        const resolved = resolvePageSpecWithCatalog(spec, catalog);
        expect(resolved.sections[0].presentation?.surface).toBe('shell-dark');
        expect(resolved.sections[0].presentation?.tone).toBe('immersive');
    });

    it('resolves template and blueprint', () => {
        const catalog: ValentinoCatalogV1 = {
            ...emptyCatalog,
            templates: {
                'product-tpl': { page: { profile: 'product-surface', themeId: 'dark' } },
            },
            pageBlueprints: {
                'product-bp': {
                    spec: {
                        version: '1',
                        id: 'blueprint',
                        templateId: 'product-tpl',
                        sections: [{ type: 'hero', titleKey: 'bp.hero' }],
                    },
                },
            },
        };
        const spec: PageSpecV1 = {
            version: '1',
            id: 'my-page',
            blueprintId: 'product-bp',
            sections: [],
        };
        const resolved = resolvePageSpecWithCatalog(spec, catalog);
        expect(resolved.id).toBe('my-page');
        expect(resolved.profile).toBe('product-surface');
        expect(resolved.themeId).toBe('dark');
        expect(resolved.sections).toHaveLength(1);
        expect((resolved.sections[0] as any).titleKey).toBe('bp.hero');
    });
});

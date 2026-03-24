import { describe, it, expect } from 'vitest';
import { probeHeroContract } from './hero-contract.js';
import type { HeroSection } from './types.js';

function makeHero(overrides: Partial<HeroSection> = {}): HeroSection {
    return { type: 'hero', titleKey: 'hero.title', ...overrides };
}

describe('probeHeroContract', () => {
    it('passes for a minimal hero', () => {
        const result = probeHeroContract(makeHero());
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('passes with 2 CTAs', () => {
        const result = probeHeroContract(makeHero({
            cta: { labelKey: 'c1', action: { type: 'link', href: '/' } },
            ctaSecondary: { labelKey: 'c2', action: { type: 'noop' } },
        }));
        expect(result.valid).toBe(true);
    });

    it('warns with 3 CTAs', () => {
        const result = probeHeroContract(makeHero({
            cta: { labelKey: 'c1', action: { type: 'link', href: '/' } },
            ctaSecondary: { labelKey: 'c2', action: { type: 'noop' } },
            ctaTertiary: { labelKey: 'c3', action: { type: 'noop' } },
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'cta-discipline' }));
    });

    it('warns on single-decorative-source violation', () => {
        const result = probeHeroContract(makeHero({
            visualAssetPath: '/img/hero.jpg',
            presentation: { visualStage: 'parallax-stars' },
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'single-decorative-source' }));
    });

    it('does not warn when visualStage is "none"', () => {
        const result = probeHeroContract(makeHero({
            visualAssetPath: '/img/hero.jpg',
            presentation: { visualStage: 'none' },
        }));
        const decorWarnings = result.warnings.filter(w => w.rule === 'single-decorative-source');
        expect(decorWarnings).toHaveLength(0);
    });

    it('warns on copy-density exceeding 5', () => {
        const result = probeHeroContract(makeHero({
            titleKey: 't',
            eyebrowKey: 'e',
            taglineKey: 'tg',
            supportKey: 's',
            mottoKey: 'm',
            poeticAsideKey: 'p',
        }));
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'copy-density' }));
    });

    it('passes with 5 text anchors', () => {
        const result = probeHeroContract(makeHero({
            titleKey: 't',
            eyebrowKey: 'e',
            taglineKey: 'tg',
            supportKey: 's',
            mottoKey: 'm',
        }));
        expect(result.valid).toBe(true);
    });

    it('warns on action rail > 6 items', () => {
        const items = Array.from({ length: 7 }, (_, i) => ({
            labelKey: `l${i}`, href: '/', icon: 'star' as const,
        }));
        const result = probeHeroContract(makeHero({ actionRail: items }));
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'rail-item-geometry' }));
    });

    it('passes with 6 action rail items', () => {
        const items = Array.from({ length: 6 }, (_, i) => ({
            labelKey: `l${i}`, href: '/', icon: 'star' as const,
        }));
        const result = probeHeroContract(makeHero({ actionRail: items }));
        expect(result.valid).toBe(true);
    });
});

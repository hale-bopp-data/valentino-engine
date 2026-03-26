import { describe, it, expect } from 'vitest';
import { probeAnimations, resolveAnimationCSS, ANIMATION_PRESETS } from '../src/index.js';
import type { SectionSpec } from '../src/index.js';

const makeSection = (type: string, animation?: any): SectionSpec =>
    ({ type, animation, titleKey: 'test' }) as unknown as SectionSpec;

describe('probeAnimations', () => {
    it('no warnings for sections without animation', () => {
        const sections = [makeSection('hero'), makeSection('cards')];
        expect(probeAnimations(sections)).toHaveLength(0);
    });

    it('no warnings for valid animation', () => {
        const sections = [makeSection('cards', { entrance: 'fade-up', delay: 'stagger', trigger: 'viewport' })];
        expect(probeAnimations(sections)).toHaveLength(0);
    });

    it('warns for invalid preset', () => {
        const sections = [makeSection('hero', { entrance: 'bounce' })];
        const w = probeAnimations(sections);
        expect(w).toHaveLength(1);
        expect(w[0].type).toBe('animation-invalid-preset');
    });

    it('warns for invalid delay', () => {
        const sections = [makeSection('hero', { delay: 'random' })];
        const w = probeAnimations(sections);
        expect(w[0].type).toBe('animation-invalid-delay');
    });

    it('warns for invalid trigger', () => {
        const sections = [makeSection('hero', { trigger: 'hover' })];
        const w = probeAnimations(sections);
        expect(w[0].type).toBe('animation-invalid-trigger');
    });

    it('warns for duration out of range', () => {
        const sections = [makeSection('hero', { entrance: 'fade-in', duration: 10000 })];
        const w = probeAnimations(sections);
        expect(w[0].type).toBe('animation-duration-out-of-range');
    });

    it('accepts duration within range', () => {
        const sections = [makeSection('hero', { entrance: 'fade-in', duration: 600 })];
        expect(probeAnimations(sections)).toHaveLength(0);
    });

    it('warns stagger on non-list section', () => {
        const sections = [makeSection('hero', { entrance: 'fade-up', delay: 'stagger' })];
        const w = probeAnimations(sections);
        expect(w[0].type).toBe('animation-stagger-no-effect');
    });

    it('no stagger warning on list sections', () => {
        for (const type of ['cards', 'stats', 'how-it-works', 'data-list', 'component-showcase']) {
            const sections = [makeSection(type, { entrance: 'fade-up', delay: 'stagger' })];
            expect(probeAnimations(sections)).toHaveLength(0);
        }
    });

    it('reports correct section index', () => {
        const sections = [
            makeSection('hero'),
            makeSection('cards', { entrance: 'invalid-thing' }),
        ];
        const w = probeAnimations(sections);
        expect(w[0].section).toBe(1);
    });
});

describe('resolveAnimationCSS', () => {
    it('returns empty for none', () => {
        expect(resolveAnimationCSS({ entrance: 'none' })).toEqual({});
    });

    it('returns CSS vars for fade-up', () => {
        const css = resolveAnimationCSS({ entrance: 'fade-up' });
        expect(css['--v-anim-opacity']).toBe('0');
        expect(css['--v-anim-transform']).toBe('translateY(20px)');
        expect(css['--v-anim-duration']).toBe('400ms');
    });

    it('returns CSS vars for slide-left', () => {
        const css = resolveAnimationCSS({ entrance: 'slide-left' });
        expect(css['--v-anim-transform']).toBe('translateX(40px)');
    });

    it('returns CSS vars for slide-right', () => {
        const css = resolveAnimationCSS({ entrance: 'slide-right' });
        expect(css['--v-anim-transform']).toBe('translateX(-40px)');
    });

    it('returns CSS vars for scale-in', () => {
        const css = resolveAnimationCSS({ entrance: 'scale-in' });
        expect(css['--v-anim-transform']).toBe('scale(0.95)');
    });

    it('respects custom duration', () => {
        const css = resolveAnimationCSS({ entrance: 'fade-in', duration: 800 });
        expect(css['--v-anim-duration']).toBe('800ms');
    });

    it('includes delay mode', () => {
        const css = resolveAnimationCSS({ entrance: 'fade-up', delay: 'stagger' });
        expect(css['--v-anim-delay-mode']).toBe('stagger');
    });
});

describe('ANIMATION_PRESETS', () => {
    it('has 6 presets', () => {
        expect(ANIMATION_PRESETS).toHaveLength(6);
    });

    it('includes all expected values', () => {
        expect(ANIMATION_PRESETS).toContain('fade-up');
        expect(ANIMATION_PRESETS).toContain('fade-in');
        expect(ANIMATION_PRESETS).toContain('slide-left');
        expect(ANIMATION_PRESETS).toContain('slide-right');
        expect(ANIMATION_PRESETS).toContain('scale-in');
        expect(ANIMATION_PRESETS).toContain('none');
    });
});

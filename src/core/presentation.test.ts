import { describe, it, expect } from 'vitest';
import { inferRhythmProfile, resolvePresentation, DEFAULT_PRESENTATION } from './presentation.js';
import type { SectionSpec } from './types.js';

describe('inferRhythmProfile', () => {
    it('returns "hero" for hero sections', () => {
        expect(inferRhythmProfile({ type: 'hero', titleKey: 'h' } as SectionSpec)).toBe('hero');
    });

    it('returns "transition" for cta sections', () => {
        expect(inferRhythmProfile({ type: 'cta', titleKey: 't' } as SectionSpec)).toBe('transition');
    });

    it('returns "transition" for spacer sections', () => {
        expect(inferRhythmProfile({ type: 'spacer' } as SectionSpec)).toBe('transition');
    });

    it('returns "feature" for cards sections', () => {
        expect(inferRhythmProfile({ type: 'cards', variant: 'catalog', items: [] } as SectionSpec)).toBe('feature');
    });

    it('returns "reading" for manifesto sections', () => {
        expect(inferRhythmProfile({ type: 'manifesto' } as SectionSpec)).toBe('reading');
    });

    it('returns "metrics" for stats sections', () => {
        expect(inferRhythmProfile({ type: 'stats', items: [] } as SectionSpec)).toBe('metrics');
    });

    it('returns "ops" for agent-dashboard sections', () => {
        expect(inferRhythmProfile({ type: 'agent-dashboard' } as SectionSpec)).toBe('ops');
    });

    it('returns "ops" for data-list sections', () => {
        expect(inferRhythmProfile({ type: 'data-list', dataUrl: '/api', columns: [] } as SectionSpec)).toBe('ops');
    });

    it('returns "feature" for how-it-works sections', () => {
        expect(inferRhythmProfile({ type: 'how-it-works', steps: [] } as SectionSpec)).toBe('feature');
    });
});

describe('resolvePresentation', () => {
    it('returns all defaults for a section with no presentation', () => {
        const result = resolvePresentation({ type: 'cards', variant: 'catalog', items: [] } as SectionSpec);
        expect(result.surface).toBe('default');
        expect(result.rhythmProfile).toBe('feature'); // inferred
    });

    it('preserves explicit presentation values', () => {
        const result = resolvePresentation({
            type: 'hero',
            titleKey: 'h',
            presentation: { surface: 'shell-dark', tone: 'immersive' },
        } as SectionSpec);
        expect(result.surface).toBe('shell-dark');
        expect(result.tone).toBe('immersive');
        expect(result.rhythmProfile).toBe('hero'); // inferred from type
    });

    it('explicit rhythmProfile overrides inferred', () => {
        const result = resolvePresentation({
            type: 'hero',
            titleKey: 'h',
            presentation: { rhythmProfile: 'reading' },
        } as SectionSpec);
        expect(result.rhythmProfile).toBe('reading');
    });

    it('returns all keys from DEFAULT_PRESENTATION', () => {
        const result = resolvePresentation({ type: 'spacer' } as SectionSpec);
        for (const key of Object.keys(DEFAULT_PRESENTATION)) {
            expect(result).toHaveProperty(key);
        }
    });
});

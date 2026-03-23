import { describe, it, expect } from 'vitest';
import { probeRhythm } from './rhythm.js';
import type { PageSpecV1 } from './types.js';

function makeSpec(sections: any[]): PageSpecV1 {
    return { version: '1', id: 'test', sections };
}

describe('probeRhythm', () => {
    it('returns valid for empty sections', () => {
        const result = probeRhythm(makeSpec([]));
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('returns valid for hero-first sequence', () => {
        const result = probeRhythm(makeSpec([
            { type: 'hero', titleKey: 'h' },
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'cta', titleKey: 'c' },
        ]));
        expect(result.valid).toBe(true);
    });

    it('warns when hero is not first', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'hero', titleKey: 'h' },
        ]));
        expect(result.valid).toBe(false);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'hero-first' }));
    });

    it('warns on consecutive same rhythmProfile', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'how-it-works', steps: [] },
        ]));
        // Both infer "feature" rhythmProfile
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'no-consecutive-rhythm' }));
    });

    it('allows consecutive transition sections (cta + spacer)', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cta', titleKey: 'c' },
            { type: 'spacer' },
        ]));
        const transitionWarnings = result.warnings.filter(w => w.rule === 'no-consecutive-rhythm');
        expect(transitionWarnings).toHaveLength(0);
    });

    it('warns on same non-default surface without spacer', () => {
        const result = probeRhythm(makeSpec([
            { type: 'hero', titleKey: 'h', presentation: { surface: 'accent' } },
            { type: 'cards', variant: 'catalog', items: [], presentation: { surface: 'accent' } },
        ]));
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'spacer-between-same-surface' }));
    });

    it('does not warn on same default surface', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'comparison', titleKey: 't', left: { titleKey: 'l', itemsKeys: [] }, right: { titleKey: 'r', itemsKeys: [] } },
        ]));
        const surfaceWarnings = result.warnings.filter(w => w.rule === 'spacer-between-same-surface');
        expect(surfaceWarnings).toHaveLength(0);
    });

    it('does not warn when spacer separates same surface', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [], presentation: { surface: 'muted' } },
            { type: 'spacer' },
            { type: 'cards', variant: 'catalog', items: [], presentation: { surface: 'muted' } },
        ]));
        const surfaceWarnings = result.warnings.filter(w => w.rule === 'spacer-between-same-surface');
        expect(surfaceWarnings).toHaveLength(0);
    });
});

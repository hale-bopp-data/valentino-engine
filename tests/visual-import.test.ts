/**
 * Tests for Visual Import module.
 * Feature #784, PBI #785 (Screenshot Import MVP).
 */

import { describe, it, expect } from 'vitest';
import { importFromImage } from '../src/core/visual-import.js';
import type { VisionLlmCallback } from '../src/core/visual-import.js';
import { COCKPIT_SECTION_TYPES } from '../src/core/cockpit-api.js';

// ---------------------------------------------------------------------------
// Mock LLM callbacks
// ---------------------------------------------------------------------------

/** Mock LLM that returns a valid PageSpecV1 */
const mockValidLlm: VisionLlmCallback = async () => JSON.stringify({
    version: '1',
    id: 'mock-page',
    profile: 'home-signature',
    sections: [
        {
            type: 'hero',
            titleKey: 'imported.hero.title',
            taglineKey: 'imported.hero.tagline',
            presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
        },
        {
            type: 'cards',
            variant: 'catalog',
            titleKey: 'imported.cards.title',
            items: [
                { titleKey: 'imported.cards.item1', descKey: 'imported.cards.desc1' },
                { titleKey: 'imported.cards.item2', descKey: 'imported.cards.desc2' },
            ],
            presentation: { surface: 'default', rhythmProfile: 'feature' },
        },
        {
            type: 'cta',
            titleKey: 'imported.cta.title',
            presentation: { surface: 'accent', rhythmProfile: 'proof' },
        },
    ],
});

/** Mock LLM that returns JSON with markdown fences */
const mockFencedLlm: VisionLlmCallback = async () => '```json\n' + JSON.stringify({
    version: '1',
    id: 'fenced',
    sections: [
        { type: 'hero', titleKey: 'fenced.hero', presentation: { rhythmProfile: 'hero' } },
    ],
}) + '\n```';

/** Mock LLM that returns invalid JSON */
const mockInvalidJsonLlm: VisionLlmCallback = async () => 'This is not JSON at all';

/** Mock LLM that returns unknown section types */
const mockUnknownTypesLlm: VisionLlmCallback = async () => JSON.stringify({
    version: '1',
    id: 'unknown',
    sections: [
        { type: 'hero', titleKey: 'ok.hero', presentation: { rhythmProfile: 'hero' } },
        { type: 'carousel', titleKey: 'bad.carousel' },
        { type: 'testimonials', titleKey: 'bad.testimonials' },
        { type: 'cta', titleKey: 'ok.cta', presentation: { rhythmProfile: 'proof' } },
    ],
});

/** Mock LLM that throws */
const mockErrorLlm: VisionLlmCallback = async () => { throw new Error('API rate limited'); };

/** Mock LLM that returns empty sections */
const mockEmptySectionsLlm: VisionLlmCallback = async () => JSON.stringify({
    version: '1',
    id: 'empty',
    sections: [],
});

// Fake base64 image (1x1 white PNG)
const FAKE_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Visual Import — Valid LLM response', () => {
    it('imports successfully with 3 sections', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockValidLlm, { id: 'test-import' });
        expect(result.success).toBe(true);
        expect(result.spec).not.toBeNull();
        expect(result.spec!.id).toBe('test-import');
        expect(result.spec!.sections).toHaveLength(3);
        expect(result.detectedSections).toEqual(['hero', 'cards', 'cta']);
    });

    it('overrides page id from options', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockValidLlm, { id: 'custom-id' });
        expect(result.spec!.id).toBe('custom-id');
    });

    it('preserves profile from LLM', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockValidLlm, { id: 'p' });
        expect(result.spec!.profile).toBe('home-signature');
    });
});

describe('Visual Import — Fenced JSON', () => {
    it('strips markdown fences', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockFencedLlm, { id: 'fenced' });
        expect(result.success).toBe(true);
        expect(result.spec!.sections).toHaveLength(1);
    });
});

describe('Visual Import — Error handling', () => {
    it('handles invalid JSON gracefully', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockInvalidJsonLlm, { id: 'bad' });
        expect(result.success).toBe(false);
        expect(result.spec).toBeNull();
        expect(result.warnings[0]).toContain('invalid JSON');
    });

    it('handles LLM error gracefully', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockErrorLlm, { id: 'err' });
        expect(result.success).toBe(false);
        expect(result.spec).toBeNull();
        expect(result.warnings[0]).toContain('rate limited');
    });
});

describe('Visual Import — Section filtering', () => {
    it('filters unknown section types with warnings', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockUnknownTypesLlm, { id: 'filtered' });
        expect(result.success).toBe(true);
        expect(result.spec!.sections).toHaveLength(2);
        expect(result.spec!.sections[0].type).toBe('hero');
        expect(result.spec!.sections[1].type).toBe('cta');
        expect(result.warnings).toContain('Skipped unknown section type: carousel');
        expect(result.warnings).toContain('Skipped unknown section type: testimonials');
    });

    it('adds default hero if all sections filtered', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockEmptySectionsLlm, { id: 'empty' });
        expect(result.success).toBe(true);
        expect(result.spec!.sections).toHaveLength(1);
        expect(result.spec!.sections[0].type).toBe('hero');
        expect(result.warnings).toContain('No valid sections after filtering — adding default hero');
    });
});

describe('Visual Import — Closed registry enforcement', () => {
    it('all detected section types are from closed registry', async () => {
        const result = await importFromImage(FAKE_IMAGE, 'image/png', mockValidLlm, { id: 'registry' });
        for (const section of result.spec!.sections) {
            expect(COCKPIT_SECTION_TYPES).toContain(section.type);
        }
    });
});

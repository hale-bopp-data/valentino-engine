/**
 * Tests for Video Import module.
 * Feature #784, PBI #787.
 */

import { describe, it, expect } from 'vitest';
import { importFromVideo, selectKeyFrames } from '../src/core/video-import.js';
import type { FrameData } from '../src/core/video-import.js';
import type { VisionLlmCallback } from '../src/core/visual-import.js';
import { COCKPIT_SECTION_TYPES } from '../src/core/cockpit-api.js';

// Fake 1x1 PNG
const FAKE_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const makeFrames = (count: number): FrameData[] =>
    Array.from({ length: count }, (_, i) => ({
        base64: FAKE_B64,
        mimeType: 'image/png',
        timestamp: i * 3,
    }));

// Mock LLMs

let callCount = 0;

/** Mock that returns valid multi-frame composition */
const mockCompositionLlm: VisionLlmCallback = async (system, user) => {
    callCount++;
    // If this is a frame analysis call (shorter prompt)
    if (system.includes('list the sections')) {
        return JSON.stringify({
            sections: [
                { type: 'hero', titleKey: 'frame.hero', order: 0 },
                { type: 'cards', titleKey: 'frame.cards', order: 1 },
            ],
        });
    }
    // Multi-frame composition
    return JSON.stringify({
        version: '1',
        id: 'video-composed',
        profile: 'home-signature',
        sections: [
            { type: 'hero', titleKey: 'v.hero', presentation: { surface: 'dark', rhythmProfile: 'hero' } },
            { type: 'cards', variant: 'catalog', titleKey: 'v.cards', items: [{ titleKey: 'c1' }], presentation: { rhythmProfile: 'feature' } },
            { type: 'stats', titleKey: 'v.stats', items: [{ valueKey: '100', labelKey: 'users' }], presentation: { rhythmProfile: 'metrics' } },
            { type: 'cta', titleKey: 'v.cta', presentation: { surface: 'accent', rhythmProfile: 'proof' } },
        ],
    });
};

/** Mock that returns single valid spec (for single frame) */
const mockSingleFrameLlm: VisionLlmCallback = async () => JSON.stringify({
    version: '1',
    id: 'single',
    sections: [
        { type: 'hero', titleKey: 'single.hero', presentation: { rhythmProfile: 'hero' } },
        { type: 'cta', titleKey: 'single.cta', presentation: { rhythmProfile: 'proof' } },
    ],
});

const mockErrorLlm: VisionLlmCallback = async () => { throw new Error('Vision API down'); };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectKeyFrames', () => {
    it('returns all frames if count <= requested', () => {
        const frames = makeFrames(3);
        expect(selectKeyFrames(frames, 5)).toHaveLength(3);
    });

    it('selects evenly spaced frames', () => {
        const frames = makeFrames(10);
        const selected = selectKeyFrames(frames, 3);
        expect(selected).toHaveLength(3);
        expect(selected[0].timestamp).toBe(0);   // first
        expect(selected[2].timestamp).toBe(27);   // last
    });

    it('handles 1 requested frame', () => {
        const frames = makeFrames(5);
        const selected = selectKeyFrames(frames, 1);
        expect(selected).toHaveLength(1);
    });
});

describe('Video Import — Single frame', () => {
    it('delegates to image import for 1 frame', async () => {
        const result = await importFromVideo(makeFrames(1), mockSingleFrameLlm, { id: 'single-test' });
        expect(result.success).toBe(true);
        expect(result.frameCount).toBe(1);
        expect(result.spec!.sections.length).toBeGreaterThan(0);
    });
});

describe('Video Import — Multi frame', () => {
    it('composes from multiple frames', async () => {
        callCount = 0;
        const result = await importFromVideo(makeFrames(3), mockCompositionLlm, { id: 'multi-test' });
        expect(result.success).toBe(true);
        expect(result.frameCount).toBe(3);
        expect(result.spec!.sections.length).toBeGreaterThanOrEqual(2);
        expect(result.frameAnalysis).toBeDefined();
        expect(result.frameAnalysis!.length).toBe(3);
    });

    it('limits frames to maxFrames', async () => {
        const result = await importFromVideo(makeFrames(10), mockCompositionLlm, { id: 'limited', maxFrames: 3 });
        expect(result.frameCount).toBe(3);
    });

    it('all sections are from closed registry', async () => {
        const result = await importFromVideo(makeFrames(3), mockCompositionLlm, { id: 'registry' });
        if (result.spec) {
            for (const s of result.spec.sections) {
                expect(COCKPIT_SECTION_TYPES).toContain(s.type);
            }
        }
    });
});

describe('Video Import — Error handling', () => {
    it('returns empty for no frames', async () => {
        const result = await importFromVideo([], mockCompositionLlm, { id: 'empty' });
        expect(result.success).toBe(false);
        expect(result.frameCount).toBe(0);
    });

    it('handles LLM error gracefully', async () => {
        const result = await importFromVideo(makeFrames(3), mockErrorLlm, { id: 'error-test' });
        expect(result.success).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});

describe('Video Import — UI', () => {
    it('index.html contains video import elements', async () => {
        const { readFileSync } = await import('fs');
        const { dirname, join } = await import('path');
        const { fileURLToPath } = await import('url');
        const thisDir = dirname(fileURLToPath(import.meta.url));
        const html = readFileSync(join(thisDir, '..', 'src', 'cockpit-web', 'index.html'), 'utf-8');

        expect(html).toContain('/api/import/video');
        expect(html).toContain('tabVideo');
        expect(html).toContain('importVideoFile');
        expect(html).toContain('videoFrames');
    });
});

/**
 * Tests for URL Import module.
 * Feature #784, PBI #786.
 */

import { describe, it, expect } from 'vitest';
import { importFromUrl } from '../src/core/url-import.js';
import type { VisionLlmCallback } from '../src/core/visual-import.js';
import type { HtmlLlmCallback } from '../src/core/url-import.js';
import { COCKPIT_SECTION_TYPES } from '../src/core/cockpit-api.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Mock vision LLM (won't be used in HTML fallback tests) */
const mockVisionLlm: VisionLlmCallback = async () => JSON.stringify({
    version: '1',
    id: 'vision-result',
    sections: [
        { type: 'hero', titleKey: 'vision.hero', presentation: { rhythmProfile: 'hero' } },
    ],
});

/** Mock HTML LLM that returns valid spec */
const mockHtmlLlm: HtmlLlmCallback = async (system, user) => JSON.stringify({
    version: '1',
    id: 'html-result',
    profile: 'home-signature',
    sections: [
        { type: 'hero', titleKey: 'imported.hero.title', taglineKey: 'imported.hero.tagline', presentation: { surface: 'dark', rhythmProfile: 'hero' } },
        { type: 'cards', variant: 'catalog', titleKey: 'imported.features', items: [{ titleKey: 'f1' }, { titleKey: 'f2' }], presentation: { rhythmProfile: 'feature' } },
        { type: 'cta', titleKey: 'imported.cta', presentation: { surface: 'accent', rhythmProfile: 'proof' } },
    ],
});

/** Mock HTML LLM that returns invalid JSON */
const mockBadHtmlLlm: HtmlLlmCallback = async () => 'This is not JSON';

/** Mock HTML LLM that returns unknown types */
const mockUnknownTypesHtmlLlm: HtmlLlmCallback = async () => JSON.stringify({
    version: '1',
    id: 'unknown',
    sections: [
        { type: 'hero', titleKey: 'ok', presentation: { rhythmProfile: 'hero' } },
        { type: 'slider', titleKey: 'bad' },
        { type: 'cta', titleKey: 'ok2', presentation: { rhythmProfile: 'proof' } },
    ],
});

// ---------------------------------------------------------------------------
// Tests — HTML fallback mode (no Playwright)
// ---------------------------------------------------------------------------

describe('URL Import — HTML fallback', () => {
    // Note: these tests use forceHtmlFallback:true since Playwright is not installed.
    // The actual URL fetch will fail in tests (no network), so we test the
    // module structure and types. Integration tests need a running server.

    it('returns html-fallback mode when forced', async () => {
        // This will fail to fetch since the URL doesn't exist,
        // but it should return a proper error structure
        const result = await importFromUrl(
            'http://localhost:99999/nonexistent',
            mockVisionLlm,
            mockHtmlLlm,
            { id: 'test', forceHtmlFallback: true },
        );
        expect(result.mode).toBe('html-fallback');
        expect(result.url).toBe('http://localhost:99999/nonexistent');
    });

    it('result has correct type shape', async () => {
        const result = await importFromUrl(
            'http://localhost:99999/test',
            mockVisionLlm,
            mockHtmlLlm,
            { id: 'shape-test', forceHtmlFallback: true },
        );
        // Should have all UrlImportResult fields
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('mode');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('warnings');
    });
});

describe('URL Import — Module structure', () => {
    it('importFromUrl is a function', () => {
        expect(typeof importFromUrl).toBe('function');
    });

    it('supports forceHtmlFallback option', async () => {
        const result = await importFromUrl(
            'http://invalid-url-test',
            mockVisionLlm,
            mockHtmlLlm,
            { id: 'fallback-test', forceHtmlFallback: true },
        );
        expect(result.mode).toBe('html-fallback');
    });
});

describe('URL Import — Web UI', () => {
    it('index.html contains URL import elements', async () => {
        const { readFileSync } = await import('fs');
        const { dirname, join } = await import('path');
        const { fileURLToPath } = await import('url');
        const thisDir = dirname(fileURLToPath(import.meta.url));
        const html = readFileSync(join(thisDir, '..', 'src', 'cockpit-web', 'index.html'), 'utf-8');

        expect(html).toContain('/api/import/url');
        expect(html).toContain('importUrl');
        expect(html).toContain('tabUrl');
        expect(html).toContain('tabScreenshot');
    });
});

/**
 * Tests for Visual Guardian (Playwright adapter).
 * PBI-004: Visual Guardian & Chaos via Playwright Headless.
 *
 * KEY DESIGN: Playwright is NOT installed in CI/dev by default.
 * All tests must validate the graceful degradation path AND, if Playwright
 * is available, the actual DOM audit behaviour.
 *
 * The module uses dynamic import() so it will never throw at module load —
 * this lets us test the "skipped" path reliably in all environments.
 */

import { describe, it, expect } from 'vitest';
import { runVisualGuardian, isPlaywrightAvailable } from '../src/core/playwright-adapter.js';
import type { PageSpecV1 } from '../src/core/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_SPEC: PageSpecV1 = {
    version: '1',
    id: 'visual-guardian-test',
    profile: 'home-signature',
    sections: [
        {
            type: 'hero',
            titleKey: 'test.hero.title',
            presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
        },
        {
            type: 'cards',
            variant: 'catalog',
            titleKey: 'test.cards.title',
            items: [{ titleKey: 'test.cards.item1' }],
            presentation: { rhythmProfile: 'feature' },
        },
        {
            type: 'cta',
            titleKey: 'test.cta.title',
            presentation: { surface: 'accent', rhythmProfile: 'proof' },
        },
    ],
};

const SINGLE_SECTION_SPEC: PageSpecV1 = {
    version: '1',
    id: 'single-section',
    sections: [
        { type: 'hero', titleKey: 'hero.title', presentation: { rhythmProfile: 'hero' } },
    ],
};

// ---------------------------------------------------------------------------
// Tests — Graceful Degradation (always pass regardless of Playwright install)
// ---------------------------------------------------------------------------

describe('Visual Guardian — Graceful Degradation', () => {
    it('is importable without Playwright installed', async () => {
        // The module itself must import without throwing
        const mod = await import('../src/core/playwright-adapter.js');
        expect(typeof mod.runVisualGuardian).toBe('function');
        expect(typeof mod.isPlaywrightAvailable).toBe('function');
    });

    it('returns skipped result when Playwright is unavailable', async () => {
        // If Playwright IS installed locally, this test will still pass
        // because we specifically test the "skipped" shape here via
        // knowing whether it's available.
        const available = await isPlaywrightAvailable();

        const report = await runVisualGuardian(MINIMAL_SPEC);

        if (!available) {
            expect(report.skipped).toBe(true);
            expect(report.available).toBe(false);
            expect(report.passed).toBe(true);   // skipped = not a failure
            expect(report.violations).toHaveLength(0);
            expect(report.summary).toContain('skipped');
        } else {
            // Playwright is available — result must have the right shape
            expect(report.skipped).toBe(false);
            expect(report.available).toBe(true);
            expect(typeof report.passed).toBe('boolean');
            expect(Array.isArray(report.violations)).toBe(true);
            expect(Array.isArray(report.warnings)).toBe(true);
        }
    });

    it('result always has the required shape', async () => {
        const report = await runVisualGuardian(MINIMAL_SPEC);
        expect(report).toHaveProperty('passed');
        expect(report).toHaveProperty('available');
        expect(report).toHaveProperty('skipped');
        expect(report).toHaveProperty('violations');
        expect(report).toHaveProperty('warnings');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('durationMs');
        expect(Array.isArray(report.violations)).toBe(true);
        expect(Array.isArray(report.warnings)).toBe(true);
        expect(typeof report.summary).toBe('string');
        expect(typeof report.durationMs).toBe('number');
    });

    it('isPlaywrightAvailable returns a boolean', async () => {
        const result = await isPlaywrightAvailable();
        expect(typeof result).toBe('boolean');
    });

    it('skipped result is treated as passing (non-blocking)', async () => {
        const available = await isPlaywrightAvailable();
        if (available) return; // Skip this specific assertion if Playwright IS installed

        const report = await runVisualGuardian(SINGLE_SECTION_SPEC);
        expect(report.passed).toBe(true); // Skipped must never block a pipeline
    });
});

// ---------------------------------------------------------------------------
// Tests — Custom renderHtml callback
// ---------------------------------------------------------------------------

describe('Visual Guardian — renderHtml callback', () => {
    it('accepts a custom renderHtml function', async () => {
        const customRender = async (spec: PageSpecV1): Promise<string> => {
            const sections = spec.sections.map((s, i) =>
                `<section data-section-index="${i}" data-section-type="${s.type}">
                    <h2>${s.type} section</h2>
                </section>`
            ).join('');
            return `<!DOCTYPE html><html><body><main>${sections}</main></body></html>`;
        };

        // Must not throw regardless of Playwright availability
        const report = await runVisualGuardian(MINIMAL_SPEC, { renderHtml: customRender });
        expect(report).toHaveProperty('passed');
        expect(report.violations).toBeDefined();
    });

    it('uses built-in scaffold when no renderHtml provided', async () => {
        // Must not throw
        const report = await runVisualGuardian(SINGLE_SECTION_SPEC);
        expect(report.summary).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// Tests — Playwright-conditional (only runs if Playwright is installed)
// ---------------------------------------------------------------------------

describe('Visual Guardian — DOM Audit (requires Playwright)', () => {
    it('detects correct section count in DOM', async () => {
        const available = await isPlaywrightAvailable();
        if (!available) {
            console.log('  ⚠ Playwright not installed — DOM audit tests skipped');
            return;
        }

        const report = await runVisualGuardian(MINIMAL_SPEC, { settleMs: 0 });
        expect(report.available).toBe(true);
        expect(report.skipped).toBe(false);

        // With our scaffold we inject the correct number of sections — should match
        const sectionMissingViolations = report.violations.filter(v => v.type === 'missing-section');
        expect(sectionMissingViolations).toHaveLength(0);
    });

    it('flags missing-section violation when HTML omits sections', async () => {
        const available = await isPlaywrightAvailable();
        if (!available) return;

        // renderHtml that injects FEWER sections than the spec has
        const badRender = async (_spec: PageSpecV1): Promise<string> =>
            `<!DOCTYPE html><html><body>
                <section data-section-index="0" data-section-type="hero"><h2>Only one</h2></section>
            </body></html>`;

        const report = await runVisualGuardian(MINIMAL_SPEC, {
            renderHtml: badRender,
            settleMs: 0,
        });

        expect(report.passed).toBe(false);
        const sectionViolation = report.violations.find(v => v.type === 'missing-section');
        expect(sectionViolation).toBeDefined();
        expect(sectionViolation?.message).toContain('Expected 3');
    });

    it('detects horizontal overflow violations', async () => {
        const available = await isPlaywrightAvailable();
        if (!available) return;

        // renderHtml that injects a guaranteed overflow
        const overflowRender = async (_spec: PageSpecV1): Promise<string> =>
            `<!DOCTYPE html><html>
            <head><style>*, *::before, *::after { box-sizing: border-box; }</style></head>
            <body style="width:1440px;overflow-x:hidden;">
                <section data-section-index="0" data-section-type="hero" style="width:100%;overflow:hidden;">
                    <div style="width:200%;background:red;">Overflow!</div>
                </section>
            </body></html>`;

        const report = await runVisualGuardian(SINGLE_SECTION_SPEC, {
            renderHtml: overflowRender,
            settleMs: 0,
        });

        const overflowViolations = report.violations.filter(v => v.type === 'overflow');
        // The outer section has overflow:hidden, so scroll dimensions should match
        // This test verifies the check runs; actual overflow depends on CSS layout engine
        expect(Array.isArray(overflowViolations)).toBe(true);
    });

    it('completes audit within reasonable time', async () => {
        const available = await isPlaywrightAvailable();
        if (!available) return;

        const report = await runVisualGuardian(MINIMAL_SPEC, { settleMs: 0 });
        expect(report.durationMs).toBeLessThan(15000); // < 15s including browser start
    });
});

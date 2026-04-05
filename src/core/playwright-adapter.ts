/**
 * Visual Guardian — Playwright headless DOM audit for PageSpecV1.
 * PBI-004: Visual Guardian & Chaos via Playwright Headless.
 *
 * OPTIONAL peer dependency: `playwright` must be installed separately.
 * If not installed, all methods return a graceful "skipped" result.
 *
 * Usage:
 *   import { runVisualGuardian } from './playwright-adapter.js';
 *   const report = await runVisualGuardian(spec, { renderHtml });
 *
 * What it checks:
 * 1. Overflow Chaos   — elements wider/taller than their container (layout breaks)
 * 2. Bounding Box Collisions — overlapping sections (z-index or positioning bugs)
 * 3. Visual Contrast  — text elements with foreground/background contrast < 4.5:1 (WCAG AA)
 * 4. Section Count    — confirms all expected sections have rendered to DOM
 */

import type { PageSpecV1 } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VisualViolation = {
    type: 'overflow' | 'collision' | 'contrast' | 'missing-section';
    severity: 'error' | 'warning';
    sectionIndex?: number;
    sectionType?: string;
    message: string;
    /** Element selector that triggered the violation */
    selector?: string;
};

export type VisualGuardianReport = {
    passed: boolean;
    available: boolean;  // false if Playwright not installed
    skipped: boolean;    // true if Playwright is unavailable
    violations: VisualViolation[];
    warnings: VisualViolation[];
    summary: string;
    /** Duration in ms */
    durationMs: number;
};

export type RenderHtmlCallback = (spec: PageSpecV1) => string | Promise<string>;

export type VisualGuardianOptions = {
    /**
     * Callback that produces the HTML to render.
     * Receives the PageSpecV1 and must return a complete self-contained HTML document string.
     * If not provided, a minimal scaffold is used for structural auditing.
     */
    renderHtml?: RenderHtmlCallback;
    /** Viewport width (default: 1440) */
    viewportWidth?: number;
    /** Viewport height (default: 900) */
    viewportHeight?: number;
    /** WCAG contrast ratio threshold (default: 4.5 — AA level) */
    contrastThreshold?: number;
    /** Max ms to wait for the page to settle (default: 2000) */
    settleMs?: number;
};

// ---------------------------------------------------------------------------
// HTML scaffold builder (minimal — used if no renderHtml provided)
// ---------------------------------------------------------------------------

function buildMinimalScaffold(spec: PageSpecV1): string {
    const sectionDivs = spec.sections.map((s, i) =>
        `<section data-section-index="${i}" data-section-type="${s.type}" style="display:block;width:100%;padding:2rem 0;">
            <div class="section-inner" style="max-width:1200px;margin:0 auto;padding:0 1rem;">
                <h2>${s.type} #${i}</h2>
            </div>
        </section>`
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Valentino Visual Guardian — ${spec.id}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #fff; color: #111; }
    section { position: relative; overflow: hidden; }
  </style>
</head>
<body>
  <main data-valentino-page="${spec.id}">
${sectionDivs}
  </main>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Playwright checks (runs inside page.evaluate)
// ---------------------------------------------------------------------------

const OVERFLOW_CHECK_SCRIPT = `
() => {
    const violations = [];
    const sections = document.querySelectorAll('[data-section-index]');
    sections.forEach(section => {
        const idx = section.getAttribute('data-section-index');
        const type = section.getAttribute('data-section-type');
        const rect = section.getBoundingClientRect();
        const scrollWidth = section.scrollWidth;
        const scrollHeight = section.scrollHeight;
        if (scrollWidth > section.clientWidth + 2) {
            violations.push({
                type: 'overflow',
                severity: 'error',
                sectionIndex: parseInt(idx),
                sectionType: type,
                message: 'Horizontal overflow detected: scrollWidth=' + scrollWidth + ' > clientWidth=' + section.clientWidth,
                selector: '[data-section-index="' + idx + '"]'
            });
        }
    });
    return violations;
}
`;

const COLLISION_CHECK_SCRIPT = `
() => {
    const violations = [];
    const sections = Array.from(document.querySelectorAll('[data-section-index]'));
    const rects = sections.map(s => ({
        idx: parseInt(s.getAttribute('data-section-index')),
        type: s.getAttribute('data-section-type'),
        rect: s.getBoundingClientRect()
    }));
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i].rect;
            const b = rects[j].rect;
            const overlap =
                a.left < b.right && a.right > b.left &&
                a.top < b.bottom && a.bottom > b.top;
            const significant = overlap &&
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 10 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 10;
            if (significant) {
                violations.push({
                    type: 'collision',
                    severity: 'warning',
                    sectionIndex: rects[i].idx,
                    sectionType: rects[i].type,
                    message: 'Bounding box collision between section #' + rects[i].idx + ' (' + rects[i].type + ') and #' + rects[j].idx + ' (' + rects[j].type + ')',
                });
            }
        }
    }
    return violations;
}
`;

function buildContrastCheckScript(threshold: number): string {
    return `
() => {
    const violations = [];
    const threshold = ${threshold};
    function luminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }
    function contrastRatio(c1, c2) {
        const l1 = luminance(...c1), l2 = luminance(...c2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function parseColor(color) {
        const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
    }
    const headings = document.querySelectorAll('h1, h2, h3, [data-section-index] p');
    headings.forEach(el => {
        const style = window.getComputedStyle(el);
        const fg = parseColor(style.color);
        const bg = parseColor(style.backgroundColor);
        if (fg && bg && bg[3] !== 0) {
            const ratio = contrastRatio(fg, bg);
            if (ratio < threshold) {
                const section = el.closest('[data-section-index]');
                const idx = section ? parseInt(section.getAttribute('data-section-index')) : undefined;
                violations.push({
                    type: 'contrast',
                    severity: 'warning',
                    sectionIndex: idx,
                    message: 'Low contrast ratio ' + ratio.toFixed(2) + ':1 (required >=' + threshold + ') on ' + el.tagName,
                    selector: el.tagName.toLowerCase()
                });
            }
        }
    });
    return violations;
}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const SKIPPED_REPORT: VisualGuardianReport = {
    passed: true,
    available: false,
    skipped: true,
    violations: [],
    warnings: [],
    summary: 'Visual Guardian skipped: Playwright not installed. Run `npm install --save-dev playwright` and `npx playwright install chromium` to enable.',
    durationMs: 0,
};

/**
 * Run the Visual Guardian audit on a PageSpecV1.
 *
 * Requires Playwright to be installed as a devDependency or peerDependency.
 * If Playwright is not available, returns a graceful "skipped" result.
 *
 * @param spec        - The PageSpecV1 to audit
 * @param options     - Guardian options (renderHtml, viewport, thresholds)
 */
export async function runVisualGuardian(
    spec: PageSpecV1,
    options: VisualGuardianOptions = {},
): Promise<VisualGuardianReport> {
    const t0 = Date.now();

    // Dynamic import — zero hard dependency (Playwright is an optional peer)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pw: any;
    try {
        // @ts-ignore — optional peer dependency, not in devDependencies
        pw = await import(/* webpackIgnore: true */ 'playwright');
    } catch {
        return SKIPPED_REPORT;
    }

    const {
        viewportWidth = 1440,
        viewportHeight = 900,
        contrastThreshold = 4.5,
        settleMs = 2000,
        renderHtml = buildMinimalScaffold,
    } = options;

    const violations: VisualViolation[] = [];
    const warnings: VisualViolation[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null;

    try {
        const html = await renderHtml(spec);
        browser = await pw.chromium.launch({ headless: true });

        const page = await browser.newPage({
            viewport: { width: viewportWidth, height: viewportHeight },
        });

        // Load HTML directly (no server needed)
        await page.setContent(html, { waitUntil: 'networkidle' });
        if (settleMs > 0) {
            await page.waitForTimeout(settleMs);
        }

        // --- Check 1: Section count ---
        const renderedSections = await page.$$('[data-section-index]');
        if (renderedSections.length !== spec.sections.length) {
            violations.push({
                type: 'missing-section',
                severity: 'error',
                message: `Expected ${spec.sections.length} sections in DOM, found ${renderedSections.length}`,
            });
        }

        // --- Check 2: Overflow ---
        const overflowResults = await page.evaluate(OVERFLOW_CHECK_SCRIPT) as VisualViolation[];
        violations.push(...overflowResults.filter(v => v.severity === 'error'));
        warnings.push(...overflowResults.filter(v => v.severity === 'warning'));

        // --- Check 3: Collisions ---
        const collisionResults = await page.evaluate(COLLISION_CHECK_SCRIPT) as VisualViolation[];
        warnings.push(...collisionResults);

        // --- Check 4: Contrast ---
        const contrastResults = await page.evaluate(buildContrastCheckScript(contrastThreshold)) as VisualViolation[];
        warnings.push(...contrastResults);

        const passed = violations.length === 0;
        const durationMs = Date.now() - t0;

        return {
            passed,
            available: true,
            skipped: false,
            violations,
            warnings,
            durationMs,
            summary: passed
                ? `Visual Guardian passed in ${durationMs}ms — ${renderedSections.length} sections OK${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}`
                : `Visual Guardian FAILED in ${durationMs}ms — ${violations.length} violation(s), ${warnings.length} warning(s)`,
        };
    } catch (err) {
        return {
            passed: false,
            available: true,
            skipped: false,
            violations: [{
                type: 'overflow',
                severity: 'error',
                message: `Visual Guardian runtime error: ${err instanceof Error ? err.message : String(err)}`,
            }],
            warnings: [],
            durationMs: Date.now() - t0,
            summary: `Visual Guardian crashed: ${err instanceof Error ? err.message : String(err)}`,
        };
    } finally {
        await browser?.close();
    }
}

/**
 * Check if Playwright is available in the current environment.
 * Useful for CI/CD to decide whether to include visual checks.
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
    try {
        // @ts-ignore — optional peer dependency
        await import(/* webpackIgnore: true */ 'playwright');
        return true;
    } catch {
        return false;
    }
}

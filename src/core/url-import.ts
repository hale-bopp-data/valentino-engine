/**
 * URL Import — Fetch web page → screenshot → PageSpecV1.
 * Feature #784 (Il Sarto Copia), PBI #786.
 *
 * Two modes:
 * - Playwright mode: headless browser screenshot → vision LLM (best quality)
 * - HTML mode: fetch HTML → LLM text analysis (fallback, no Playwright needed)
 *
 * Zero hard dependencies on Playwright — dynamic import, graceful fallback.
 */

import type { PageSpecV1 } from './types.js';
import { importFromImage } from './visual-import.js';
import type { VisionLlmCallback, VisualImportResult, VisualImportOptions } from './visual-import.js';
import { COCKPIT_SECTION_TYPES } from './cockpit-api.js';
import { validatePageSpec } from './page-spec.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UrlImportResult = VisualImportResult & {
    mode: 'playwright' | 'html-fallback';
    url: string;
    /** Page title extracted from HTML */
    pageTitle?: string;
};

export type UrlImportOptions = VisualImportOptions & {
    /** Viewport width for screenshot (default: 1440) */
    viewportWidth?: number;
    /** Viewport height for screenshot (default: 900) */
    viewportHeight?: number;
    /** Wait time in ms after page load (default: 2000) */
    waitAfterLoad?: number;
    /** Force HTML fallback even if Playwright is available */
    forceHtmlFallback?: boolean;
};

export type HtmlLlmCallback = (
    systemPrompt: string,
    userPrompt: string,
) => Promise<string>;

// ---------------------------------------------------------------------------
// Playwright screenshot (dynamic import)
// ---------------------------------------------------------------------------

async function takeScreenshot(
    url: string,
    options: UrlImportOptions,
): Promise<{ base64: string; title: string } | null> {
    try {
        // Dynamic import — won't fail if Playwright not installed
        // @ts-ignore — playwright is an optional peer dependency
        const pw = await import(/* webpackIgnore: true */ 'playwright');
        const browser = await pw.chromium.launch({ headless: true });

        try {
            const page = await browser.newPage({
                viewport: {
                    width: options.viewportWidth || 1440,
                    height: options.viewportHeight || 900,
                },
            });

            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            if (options.waitAfterLoad) {
                await page.waitForTimeout(options.waitAfterLoad);
            }

            const title = await page.title();
            const buffer = await page.screenshot({ fullPage: true, type: 'png' });
            const base64 = buffer.toString('base64');

            return { base64, title };
        } finally {
            await browser.close();
        }
    } catch {
        // Playwright not available or failed
        return null;
    }
}

// ---------------------------------------------------------------------------
// HTML fallback — fetch + LLM text analysis
// ---------------------------------------------------------------------------

const HTML_SYSTEM_PROMPT = `You are Valentino's URL Import engine. You analyze the HTML structure of a web page and generate a structured PageSpecV1 JSON.

RULES:
1. Return ONLY valid JSON — no markdown fences, no explanation
2. The JSON must be a valid PageSpecV1 with version:"1", id, and sections array
3. You can ONLY use these section types: ${COCKPIT_SECTION_TYPES.join(', ')}
4. Analyze the HTML structure: identify headers, content sections, CTAs, forms, footers
5. Map HTML patterns to Valentino section types:
   - <header>, <h1> hero area → "hero"
   - Feature grids, card layouts → "cards"
   - Call-to-action blocks → "cta"
   - Statistics/numbers → "stats"
   - Step-by-step content → "how-it-works"
   - <form> elements → "form"
   - Comparison tables → "comparison"
   - Long text blocks → "manifesto"
6. Use descriptive i18n keys: "page.<context>.<section>.<field>"
7. Extract visible text content into key values
8. Set appropriate presentation tokens (surface, rhythmProfile)`;

async function fetchAndAnalyzeHtml(
    url: string,
    htmlLlm: HtmlLlmCallback,
    options: UrlImportOptions,
): Promise<UrlImportResult> {
    const warnings: string[] = [];
    let pageTitle: string | undefined;

    try {
        // Fetch the page HTML
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Valentino-Engine/1.0 (Visual Import)' },
            redirect: 'follow',
        });

        if (!response.ok) {
            return {
                success: false,
                spec: null,
                warnings: [`Failed to fetch URL: ${response.status} ${response.statusText}`],
                mode: 'html-fallback',
                url,
            };
        }

        const html = await response.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
        pageTitle = titleMatch?.[1]?.trim();

        // Truncate HTML to avoid token limits (keep first 15k chars — head + main content)
        const truncatedHtml = html.length > 15000
            ? html.substring(0, 15000) + '\n<!-- truncated -->'
            : html;

        const userPrompt = [
            `Analyze this web page and generate a PageSpecV1 JSON.`,
            `URL: ${url}`,
            `Page ID: "${options.id}"`,
            options.language ? `Language: ${options.language}` : '',
            '',
            '--- HTML ---',
            truncatedHtml,
        ].join('\n');

        const raw = await htmlLlm(HTML_SYSTEM_PROMPT, userPrompt);
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        let parsed: unknown;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return {
                success: false,
                spec: null,
                warnings: ['LLM returned invalid JSON from HTML analysis'],
                rawResponse: cleaned.substring(0, 500),
                mode: 'html-fallback',
                url,
                pageTitle,
            };
        }

        // Validate and fix
        const rawObj = parsed as Record<string, unknown>;
        const spec: PageSpecV1 = {
            version: '1',
            id: options.id,
            profile: (rawObj.profile as any) || undefined,
            titleKey: pageTitle || undefined,
            sections: [],
        };

        if (Array.isArray(rawObj.sections)) {
            for (const section of rawObj.sections) {
                if (typeof section !== 'object' || section === null) continue;
                const s = section as Record<string, unknown>;
                if (!s.type || !COCKPIT_SECTION_TYPES.includes(s.type as string)) {
                    if (s.type) warnings.push(`Skipped unknown section type: ${s.type}`);
                    continue;
                }
                spec.sections.push(section as any);
            }
        }

        if (spec.sections.length === 0) {
            warnings.push('No valid sections — adding default hero');
            spec.sections.push({
                type: 'hero',
                titleKey: pageTitle || `page.${options.id}.hero.title`,
                presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
            });
        }

        if (!validatePageSpec(spec)) {
            warnings.push('Generated spec failed validation');
        }

        return {
            success: true,
            spec,
            warnings,
            detectedSections: spec.sections.map(s => s.type),
            mode: 'html-fallback',
            url,
            pageTitle,
        };
    } catch (err) {
        return {
            success: false,
            spec: null,
            warnings: [`HTML analysis failed: ${err instanceof Error ? err.message : String(err)}`],
            mode: 'html-fallback',
            url,
        };
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import a web page by URL → PageSpecV1.
 *
 * Tries Playwright screenshot first (best quality).
 * Falls back to HTML fetch + LLM text analysis.
 *
 * @param url - The web page URL to import
 * @param visionLlm - Vision LLM callback (for screenshot mode)
 * @param htmlLlm - Text LLM callback (for HTML fallback mode)
 * @param options - Import options
 */
export async function importFromUrl(
    url: string,
    visionLlm: VisionLlmCallback,
    htmlLlm: HtmlLlmCallback,
    options: UrlImportOptions,
): Promise<UrlImportResult> {
    // Try Playwright screenshot first
    if (!options.forceHtmlFallback) {
        const screenshot = await takeScreenshot(url, options);

        if (screenshot) {
            // Extract title for page ID fallback
            const result = await importFromImage(
                screenshot.base64,
                'image/png',
                visionLlm,
                options,
            );
            return {
                ...result,
                mode: 'playwright',
                url,
                pageTitle: screenshot.title,
            };
        }
    }

    // Fallback: HTML analysis
    return fetchAndAnalyzeHtml(url, htmlLlm, options);
}

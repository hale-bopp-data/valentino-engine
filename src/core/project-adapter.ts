/**
 * Project Adapter — HTML/CSS existing project → PageSpecV1.
 * Feature #784 (Il Sarto Copia), PBI #788.
 *
 * Reads HTML files from a local directory, analyzes structure via heuristics
 * + LLM, and generates governed PageSpecV1 specs.
 *
 * Uses Node fs for file reading. No external parsing libs — regex heuristics
 * for HTML structure, LLM for intelligent mapping.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, extname, basename, relative } from 'path';
import type { PageSpecV1 } from './types.js';
import { validatePageSpec } from './page-spec.js';
import { COCKPIT_SECTION_TYPES } from './cockpit-api.js';
import type { HtmlLlmCallback } from './url-import.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectScanResult = {
    /** All HTML files found */
    htmlFiles: string[];
    /** All CSS files found */
    cssFiles: string[];
    /** Detected framework (if any) */
    framework?: string;
    /** Extracted color palette from CSS */
    colors: string[];
    /** Extracted fonts from CSS */
    fonts: string[];
};

export type ProjectPageResult = {
    success: boolean;
    file: string;
    spec: PageSpecV1 | null;
    warnings: string[];
    /** Sections detected via heuristics (before LLM) */
    heuristicSections?: string[];
};

export type ProjectAdapterResult = {
    success: boolean;
    projectPath: string;
    scan: ProjectScanResult;
    pages: ProjectPageResult[];
    /** The primary page spec (first/index page) */
    primarySpec: PageSpecV1 | null;
    warnings: string[];
};

export type ProjectAdapterOptions = {
    /** Max HTML files to process (default: 10) */
    maxFiles?: number;
    /** Language for i18n keys */
    language?: string;
};

// ---------------------------------------------------------------------------
// Project scanning
// ---------------------------------------------------------------------------

function scanProject(projectPath: string): ProjectScanResult {
    const htmlFiles: string[] = [];
    const cssFiles: string[] = [];
    const colors = new Set<string>();
    const fonts = new Set<string>();

    function walk(dir: string, depth = 0): void {
        if (depth > 5) return; // max depth
        try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath, depth + 1);
                } else {
                    const ext = extname(entry.name).toLowerCase();
                    if (ext === '.html' || ext === '.htm') htmlFiles.push(fullPath);
                    else if (ext === '.css') cssFiles.push(fullPath);
                }
            }
        } catch { /* permission denied, etc */ }
    }

    walk(projectPath);

    // Extract colors and fonts from CSS files
    for (const cssFile of cssFiles.slice(0, 5)) {
        try {
            const css = readFileSync(cssFile, 'utf-8');
            // Hex colors
            const hexMatches = css.match(/#[0-9a-fA-F]{3,8}\b/g);
            if (hexMatches) hexMatches.forEach(c => colors.add(c.toLowerCase()));
            // Font families
            const fontMatches = css.match(/font-family:\s*([^;]+)/gi);
            if (fontMatches) fontMatches.forEach(f => {
                const value = f.replace(/font-family:\s*/i, '').trim();
                fonts.add(value);
            });
        } catch { /* ignore */ }
    }

    // Detect framework
    let framework: string | undefined;
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps.react || deps['react-dom']) framework = 'react';
            else if (deps.vue) framework = 'vue';
            else if (deps.svelte) framework = 'svelte';
            else if (deps.angular || deps['@angular/core']) framework = 'angular';
            else if (deps.next) framework = 'next';
            else if (deps.nuxt) framework = 'nuxt';
            else if (deps.astro) framework = 'astro';
        } catch { /* ignore */ }
    }

    return {
        htmlFiles: htmlFiles.sort(),
        cssFiles: cssFiles.sort(),
        framework,
        colors: [...colors].slice(0, 20),
        fonts: [...fonts].slice(0, 10),
    };
}

// ---------------------------------------------------------------------------
// HTML heuristic analysis
// ---------------------------------------------------------------------------

type HeuristicSection = {
    type: string;
    tag: string;
    content: string;
};

function analyzeHtmlHeuristic(html: string): HeuristicSection[] {
    const sections: HeuristicSection[] = [];

    // Hero: <header>, first <h1>, or elements with hero/banner classes
    if (/<header[\s>]/i.test(html) || /class="[^"]*hero[^"]*"/i.test(html) || /class="[^"]*banner[^"]*"/i.test(html)) {
        const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
        sections.push({ type: 'hero', tag: 'header/h1', content: h1Match?.[1]?.replace(/<[^>]+>/g, '').trim() || '' });
    }

    // Cards: <div> grids with repeated structures, .card classes
    if (/class="[^"]*card[^"]*"/i.test(html) || /class="[^"]*grid[^"]*"/i.test(html) || /class="[^"]*feature[^"]*"/i.test(html)) {
        sections.push({ type: 'cards', tag: 'cards/grid', content: '' });
    }

    // Form: <form> elements
    if (/<form[\s>]/i.test(html)) {
        sections.push({ type: 'form', tag: 'form', content: '' });
    }

    // Stats: elements with number-like content
    if (/class="[^"]*stat[^"]*"/i.test(html) || /class="[^"]*counter[^"]*"/i.test(html) || /class="[^"]*metric[^"]*"/i.test(html)) {
        sections.push({ type: 'stats', tag: 'stats/metrics', content: '' });
    }

    // Steps: ordered lists, .step classes
    if (/class="[^"]*step[^"]*"/i.test(html) || /class="[^"]*process[^"]*"/i.test(html) || /class="[^"]*how-it-works[^"]*"/i.test(html)) {
        sections.push({ type: 'how-it-works', tag: 'steps', content: '' });
    }

    // CTA: call-to-action blocks
    if (/class="[^"]*cta[^"]*"/i.test(html) || /class="[^"]*call-to-action[^"]*"/i.test(html)) {
        sections.push({ type: 'cta', tag: 'cta', content: '' });
    }

    // Comparison: tables with vs/comparison
    if (/class="[^"]*comparison[^"]*"/i.test(html) || /class="[^"]*pricing[^"]*"/i.test(html)) {
        sections.push({ type: 'comparison', tag: 'comparison/pricing', content: '' });
    }

    // Long content: <article>, .content, long text blocks
    if (/<article[\s>]/i.test(html) || /class="[^"]*content[^"]*"/i.test(html) || /class="[^"]*manifesto[^"]*"/i.test(html)) {
        sections.push({ type: 'manifesto', tag: 'article/content', content: '' });
    }

    // Footer CTA fallback: if no CTA found but has <footer>
    if (sections.every(s => s.type !== 'cta') && /<footer[\s>]/i.test(html)) {
        sections.push({ type: 'cta', tag: 'footer', content: '' });
    }

    // Ensure hero exists
    if (sections.every(s => s.type !== 'hero')) {
        const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
        if (h1Match) {
            sections.unshift({ type: 'hero', tag: 'h1', content: h1Match[1].replace(/<[^>]+>/g, '').trim() });
        }
    }

    return sections;
}

// ---------------------------------------------------------------------------
// LLM-enhanced page analysis
// ---------------------------------------------------------------------------

const PROJECT_SYSTEM_PROMPT = `You are Valentino's Project Adapter. You analyze existing HTML files and generate a structured PageSpecV1 JSON.

RULES:
1. Return ONLY valid JSON — no markdown, no explanation
2. Generate a PageSpecV1 with version:"1", id, and sections array
3. Only use these section types: ${COCKPIT_SECTION_TYPES.join(', ')}
4. Map HTML structure to the closest Valentino section type
5. Extract visible text into i18n keys
6. Set presentation tokens based on the CSS/visual style
7. If the HTML has dark backgrounds → use surface:"dark" or "shell-dark"
8. If the HTML has light backgrounds → use surface:"default" or "reading-light"`;

async function analyzePageWithLlm(
    html: string,
    fileName: string,
    scan: ProjectScanResult,
    llm: HtmlLlmCallback,
    options: ProjectAdapterOptions,
): Promise<ProjectPageResult> {
    const warnings: string[] = [];
    const heuristics = analyzeHtmlHeuristic(html);
    const heuristicSections = heuristics.map(h => h.type);

    // Truncate HTML
    const truncated = html.length > 12000
        ? html.substring(0, 12000) + '\n<!-- truncated -->'
        : html;

    const prompt = [
        `Analyze this HTML file and generate a PageSpecV1 JSON.`,
        `File: ${fileName}`,
        `Detected framework: ${scan.framework || 'none'}`,
        `Color palette: ${scan.colors.slice(0, 8).join(', ') || 'not detected'}`,
        `Heuristic sections detected: ${heuristicSections.join(', ') || 'none'}`,
        options.language ? `Language: ${options.language}` : '',
        '',
        '--- HTML ---',
        truncated,
    ].join('\n');

    try {
        const raw = await llm(PROJECT_SYSTEM_PROMPT, prompt);
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        let parsed: unknown;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return {
                success: false,
                file: fileName,
                spec: null,
                warnings: ['LLM returned invalid JSON'],
                heuristicSections,
            };
        }

        const rawObj = parsed as Record<string, unknown>;
        const pageId = basename(fileName, extname(fileName)).replace(/[^a-zA-Z0-9-]/g, '-');
        const spec: PageSpecV1 = {
            version: '1',
            id: pageId,
            profile: (rawObj.profile as any) || undefined,
            sections: [],
        };

        if (Array.isArray(rawObj.sections)) {
            for (const section of rawObj.sections) {
                if (typeof section !== 'object' || section === null) continue;
                const s = section as Record<string, unknown>;
                if (!s.type || !COCKPIT_SECTION_TYPES.includes(s.type as string)) {
                    if (s.type) warnings.push(`Skipped: ${s.type}`);
                    continue;
                }
                spec.sections.push(section as any);
            }
        }

        if (spec.sections.length === 0 && heuristics.length > 0) {
            warnings.push('LLM produced no valid sections — using heuristic fallback');
            for (const h of heuristics) {
                if (COCKPIT_SECTION_TYPES.includes(h.type)) {
                    spec.sections.push(buildFallbackSection(h, pageId));
                }
            }
        }

        if (spec.sections.length === 0) {
            spec.sections.push({
                type: 'hero',
                titleKey: `page.${pageId}.hero.title`,
                presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
            });
        }

        if (!validatePageSpec(spec)) {
            warnings.push('Generated spec failed validation');
        }

        return { success: true, file: fileName, spec, warnings, heuristicSections };
    } catch (err) {
        return {
            success: false,
            file: fileName,
            spec: null,
            warnings: [`Analysis failed: ${err instanceof Error ? err.message : String(err)}`],
            heuristicSections,
        };
    }
}

function buildFallbackSection(h: HeuristicSection, pageId: string): any {
    const prefix = `page.${pageId}.${h.type}`;
    switch (h.type) {
        case 'hero':
            return { type: 'hero', titleKey: h.content || `${prefix}.title`, presentation: { surface: 'shell-dark', rhythmProfile: 'hero' } };
        case 'cards':
            return { type: 'cards', variant: 'catalog', titleKey: `${prefix}.title`, items: [{ titleKey: `${prefix}.item1` }], presentation: { rhythmProfile: 'feature' } };
        case 'cta':
            return { type: 'cta', titleKey: `${prefix}.title`, presentation: { surface: 'accent', rhythmProfile: 'proof' } };
        case 'form':
            return { type: 'form', titleKey: `${prefix}.title`, submitKey: `${prefix}.submit`, fields: [{ name: 'email', type: 'email', labelKey: `${prefix}.email` }] };
        case 'stats':
            return { type: 'stats', items: [{ valueKey: `${prefix}.v1`, labelKey: `${prefix}.l1` }], presentation: { rhythmProfile: 'metrics' } };
        case 'how-it-works':
            return { type: 'how-it-works', steps: [{ numKey: '1', titleKey: `${prefix}.s1.title`, descKey: `${prefix}.s1.desc` }] };
        case 'manifesto':
            return { type: 'manifesto', contentPrefix: prefix, presentation: { surface: 'reading-light', rhythmProfile: 'reading' } };
        default:
            return { type: h.type, presentation: {} };
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan a project directory and generate PageSpecV1 for each HTML file.
 *
 * @param projectPath - Local path to the project directory
 * @param llm - Text LLM callback for HTML analysis
 * @param options - Adapter options
 */
export async function importFromProject(
    projectPath: string,
    llm: HtmlLlmCallback,
    options: ProjectAdapterOptions = {},
): Promise<ProjectAdapterResult> {
    const warnings: string[] = [];

    if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
        return {
            success: false,
            projectPath,
            scan: { htmlFiles: [], cssFiles: [], colors: [], fonts: [] },
            pages: [],
            primarySpec: null,
            warnings: [`Directory not found: ${projectPath}`],
        };
    }

    // Scan
    const scan = scanProject(projectPath);
    if (scan.htmlFiles.length === 0) {
        return {
            success: false,
            projectPath,
            scan,
            pages: [],
            primarySpec: null,
            warnings: ['No HTML files found in project directory'],
        };
    }

    if (scan.framework) {
        warnings.push(`Detected framework: ${scan.framework}`);
    }

    // Process HTML files (limited)
    const maxFiles = options.maxFiles || 10;
    const filesToProcess = prioritizeHtmlFiles(scan.htmlFiles).slice(0, maxFiles);
    const pages: ProjectPageResult[] = [];

    for (const file of filesToProcess) {
        try {
            const html = readFileSync(file, 'utf-8');
            const relPath = relative(projectPath, file);
            const result = await analyzePageWithLlm(html, relPath, scan, llm, options);
            pages.push(result);
        } catch (err) {
            pages.push({
                success: false,
                file: relative(projectPath, file),
                spec: null,
                warnings: [`Read failed: ${err instanceof Error ? err.message : String(err)}`],
            });
        }
    }

    // Primary = index.html or first successful
    const primaryPage = pages.find(p => p.file.includes('index')) || pages.find(p => p.success);

    return {
        success: pages.some(p => p.success),
        projectPath,
        scan,
        pages,
        primarySpec: primaryPage?.spec || null,
        warnings,
    };
}

/**
 * Scan a project directory without LLM analysis.
 * Useful for showing project info before running the full import.
 */
export function scanProjectDirectory(projectPath: string): ProjectScanResult {
    return scanProject(projectPath);
}

/**
 * Analyze HTML with heuristics only (no LLM needed).
 */
export function analyzeHtmlStructure(html: string): HeuristicSection[] {
    return analyzeHtmlHeuristic(html);
}

// ---------------------------------------------------------------------------
// File prioritization — index first, then by name
// ---------------------------------------------------------------------------

function prioritizeHtmlFiles(files: string[]): string[] {
    return [...files].sort((a, b) => {
        const aName = basename(a).toLowerCase();
        const bName = basename(b).toLowerCase();
        // index.html first
        if (aName.startsWith('index')) return -1;
        if (bName.startsWith('index')) return 1;
        // Then alphabetical
        return aName.localeCompare(bName);
    });
}

export { analyzeHtmlHeuristic as _analyzeHtmlHeuristic, prioritizeHtmlFiles as _prioritizeHtmlFiles };

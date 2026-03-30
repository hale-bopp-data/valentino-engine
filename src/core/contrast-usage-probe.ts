/**
 * Contrast Usage Probe — static CSS analysis for unremediated text variables.
 *
 * Scans CSS to find text/accent CSS variables used in selectors that could
 * render on light surfaces WITHOUT being remapped by a surface-aware override.
 *
 * Catches: `.card-desc { color: var(--text-secondary) }` used inside
 * `.valentino-section-shell[data-surface='default']` where --text-secondary
 * is NOT remapped to a surface-safe value.
 *
 * Pure function, zero DOM.
 */

import { inferTokenRole } from './theme-audit.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ContrastUsageWarning = {
    /** CSS variable used as foreground color */
    token: string;
    /** The CSS selector where it's used */
    selector: string;
    /** Line number in the CSS file */
    line: number;
    /** Surfaces where the token is NOT remapped */
    unremappedSurfaces: string[];
    /** Severity: error if used on light surfaces without remap */
    severity: 'warning' | 'error';
    message: string;
};

export type ContrastUsageProbeResult = {
    warnings: ContrastUsageWarning[];
    /** Tokens that ARE properly remapped per surface */
    remappedTokens: Map<string, string[]>;
    valid: boolean;
};

// ── Surface detection ────────────────────────────────────────────────────────

const LIGHT_SURFACES = ['default', 'muted', 'accent', 'reading-light', 'ops-light'];
const DARK_SURFACES = ['dark', 'shell-dark'];

/** Pattern to find surface-scoped blocks that remap a variable */
const SURFACE_REMAP_RE = /\.valentino-section-shell\[data-surface=['"]([^'"]+)['"]\]\s*\{([^}]+)\}/g;

/** Pattern to find var(--token) usage in CSS property values */
const VAR_USAGE_RE = /:\s*var\((--[a-z][a-z0-9-]*)\)/g;

/** Pattern to find rgba(var(--rgb-*), alpha) usage — common for glow/shadow on interactive states */
const RGBA_VAR_USAGE_RE = /rgba\(\s*var\((--rgb-[a-z][a-z0-9-]*)\)/g;

/**
 * Tokens that contain "text" or "font" in their name but are NOT colors.
 * These are size/typography tokens and should be excluded from contrast checks.
 */
function isNonColorToken(token: string): boolean {
    const lower = token.toLowerCase();
    // Font family, size steps, line heights, letter spacing
    if (lower.includes('font-family') || lower.includes('font-size') || lower.includes('font-weight')) return true;
    if (/--text-step-\d/.test(lower)) return true;
    if (lower.includes('leading') || lower.includes('tracking') || lower.includes('measure')) return true;
    return false;
}

/**
 * Tokens scoped to a specific surface kind in their name (e.g., --action-widget-dark-*)
 * should not be checked against the opposite surface kind.
 */
function isSurfaceScopedToken(token: string): 'light' | 'dark' | null {
    const lower = token.toLowerCase();
    if (lower.includes('-dark-')) return 'dark';
    if (lower.includes('-light-')) return 'light';
    return null;
}

/** Pattern to find variable definitions (--token: value) */
const VAR_DEFINE_RE = /(--[a-z][a-z0-9-]*):\s*var\((--[a-z][a-z0-9-]*)\)|(-[a-z][a-z0-9-]*):\s*([^;]+)/g;

// ── Core probe ───────────────────────────────────────────────────────────────

/**
 * Parse which tokens are remapped in each surface block.
 * Returns: Map<tokenName, surfaceName[]>
 */
export function parseRemappedTokens(css: string): Map<string, string[]> {
    const remaps = new Map<string, string[]>();

    let match;
    SURFACE_REMAP_RE.lastIndex = 0;
    while ((match = SURFACE_REMAP_RE.exec(css)) !== null) {
        const surfaceName = match[1];
        const blockContent = match[2];

        // Find all variable definitions in this surface block
        const defRe = /(--[a-z][a-z0-9-]*):/g;
        let defMatch;
        while ((defMatch = defRe.exec(blockContent)) !== null) {
            const token = defMatch[1];
            if (!remaps.has(token)) remaps.set(token, []);
            remaps.get(token)!.push(surfaceName);
        }
    }

    return remaps;
}

/**
 * Find all text/accent CSS variable usages outside of surface remap blocks.
 * Returns: Array of {token, selector, line}
 */
export function parseTextTokenUsages(css: string): Array<{ token: string; selector: string; line: number }> {
    const usages: Array<{ token: string; selector: string; line: number }> = [];
    const lines = css.split('\n');

    // Track which line ranges are inside surface remap blocks (skip those)
    const surfaceBlockRanges: Array<{ start: number; end: number }> = [];
    SURFACE_REMAP_RE.lastIndex = 0;
    let blockMatch;
    while ((blockMatch = SURFACE_REMAP_RE.exec(css)) !== null) {
        const startOffset = blockMatch.index;
        const endOffset = startOffset + blockMatch[0].length;
        const startLine = css.substring(0, startOffset).split('\n').length;
        const endLine = css.substring(0, endOffset).split('\n').length;
        surfaceBlockRanges.push({ start: startLine, end: endLine });
    }

    function isInsideSurfaceBlock(lineNum: number): boolean {
        return surfaceBlockRanges.some(r => lineNum >= r.start && lineNum <= r.end);
    }

    // Simple CSS selector tracker
    let currentSelector = '';
    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i].trim();

        // Skip lines inside surface remap blocks
        if (isInsideSurfaceBlock(lineNum)) continue;

        // Track selectors (crude but effective for this purpose)
        if (line.includes('{') && !line.startsWith('/*')) {
            currentSelector = line.replace(/\s*\{.*/, '').trim();
        }

        // Find var(--token) usages
        VAR_USAGE_RE.lastIndex = 0;
        let varMatch;
        while ((varMatch = VAR_USAGE_RE.exec(line)) !== null) {
            const token = varMatch[1];
            if (isNonColorToken(token)) continue;
            const role = inferTokenRole(token);
            if (role === 'text' || role === 'accent') {
                usages.push({ token, selector: currentSelector, line: lineNum });
            }
        }

        // Also catch rgba(var(--rgb-*)) pattern — map --rgb-X to its parent --X token
        RGBA_VAR_USAGE_RE.lastIndex = 0;
        let rgbaMatch;
        while ((rgbaMatch = RGBA_VAR_USAGE_RE.exec(line)) !== null) {
            const rgbToken = rgbaMatch[1]; // e.g. --rgb-neural-cyan
            // Infer the parent token: --rgb-neural-cyan → --accent-neural-cyan
            // These are used in color/background contexts so they're accent-like
            usages.push({ token: rgbToken, selector: currentSelector, line: lineNum });
        }
    }

    return usages;
}

/**
 * Probe CSS for text/accent variables that are used on elements which could
 * appear inside light surfaces, but are NOT remapped in those surface blocks.
 *
 * @param css - Full CSS content (e.g., framework.css)
 * @param options.textTokens - Specific tokens to check. If omitted, discovers all var(--text-*) usages.
 */
export function probeContrastUsage(css: string): ContrastUsageProbeResult {
    const remappedTokens = parseRemappedTokens(css);
    const usages = parseTextTokenUsages(css);
    const warnings: ContrastUsageWarning[] = [];

    // For each text token usage, check if it's remapped in all light surfaces
    const checkedTokens = new Set<string>();

    for (const usage of usages) {
        // Only warn once per token (not per usage)
        if (checkedTokens.has(usage.token)) continue;
        checkedTokens.add(usage.token);

        const remappedIn = remappedTokens.get(usage.token) ?? [];

        // Skip tokens scoped to a specific surface kind (e.g., --action-widget-dark-text)
        const scopedKind = isSurfaceScopedToken(usage.token);
        if (scopedKind === 'dark') continue; // Dark-scoped tokens don't need light remaps
        const surfacesToCheck = scopedKind === 'light' ? LIGHT_SURFACES : LIGHT_SURFACES;

        const missingLightSurfaces = surfacesToCheck.filter(s => !remappedIn.includes(s));

        if (missingLightSurfaces.length > 0) {
            warnings.push({
                token: usage.token,
                selector: usage.selector,
                line: usage.line,
                unremappedSurfaces: missingLightSurfaces,
                severity: 'error',
                message: `"${usage.token}" used in "${usage.selector}" (line ${usage.line}) is not remapped in light surfaces: ${missingLightSurfaces.join(', ')}. Text may be invisible on white backgrounds.`,
            });
        }
    }

    return {
        warnings,
        remappedTokens,
        valid: warnings.length === 0,
    };
}

// ── Shadow DOM extraction ────────────────────────────────────────────────────

/**
 * Extract CSS from Shadow DOM Web Component source files.
 * Looks for tagged template literals containing <style> blocks,
 * which is the standard pattern for Lit/vanilla Shadow DOM components.
 *
 * Returns array of { componentName, css } for each component found.
 */
export function extractShadowDomStyles(
    source: string,
    fileName?: string,
): Array<{ componentName: string; css: string }> {
    const results: Array<{ componentName: string; css: string }> = [];

    // Match <style>...</style> inside template literals
    const styleRe = /<style>([\s\S]*?)<\/style>/g;
    let match;
    while ((match = styleRe.exec(source)) !== null) {
        results.push({
            componentName: fileName ?? 'unknown-component',
            css: match[1],
        });
    }

    return results;
}

// ── Multi-source probe ───────────────────────────────────────────────────────

export type ContrastUsageMultiResult = {
    /** Combined warnings from all sources */
    warnings: ContrastUsageWarning[];
    /** Per-source results for reporting */
    sources: Array<{ source: string; warningCount: number }>;
    valid: boolean;
};

/**
 * Probe multiple CSS sources at once (framework.css + Shadow DOM components).
 * Surface remaps are read from the primary CSS (framework.css).
 * Token usages are collected from ALL sources (framework + components).
 */
export function probeContrastUsageMulti(
    primaryCss: string,
    additionalSources?: Array<{ name: string; css: string }>,
): ContrastUsageMultiResult {
    // Remaps only come from the primary CSS (framework.css has the surface blocks)
    const remappedTokens = parseRemappedTokens(primaryCss);

    // Collect usages from all sources
    const allSources = [
        { name: 'framework.css', css: primaryCss },
        ...(additionalSources ?? []),
    ];

    const warnings: ContrastUsageWarning[] = [];
    const checkedTokens = new Set<string>();
    const sourceSummary: Array<{ source: string; warningCount: number }> = [];

    for (const { name, css } of allSources) {
        const usages = parseTextTokenUsages(css);
        let sourceWarnings = 0;

        for (const usage of usages) {
            if (checkedTokens.has(usage.token)) continue;
            checkedTokens.add(usage.token);

            const remappedIn = remappedTokens.get(usage.token) ?? [];
            const scopedKind = isSurfaceScopedToken(usage.token);
            if (scopedKind === 'dark') continue;

            const missingLightSurfaces = LIGHT_SURFACES.filter(s => !remappedIn.includes(s));

            if (missingLightSurfaces.length > 0) {
                sourceWarnings++;
                warnings.push({
                    token: usage.token,
                    selector: usage.selector,
                    line: usage.line,
                    unremappedSurfaces: missingLightSurfaces,
                    severity: 'error',
                    message: `[${name}] "${usage.token}" used in "${usage.selector}" (line ${usage.line}) is not remapped in light surfaces: ${missingLightSurfaces.join(', ')}`,
                });
            }
        }

        sourceSummary.push({ source: name, warningCount: sourceWarnings });
    }

    return {
        warnings,
        sources: sourceSummary,
        valid: warnings.length === 0,
    };
}

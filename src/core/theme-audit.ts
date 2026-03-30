/**
 * Theme Audit — static contrast analysis for theme-packs against surfaces.
 *
 * Crosses every text token in a theme-pack with every Valentino surface
 * background and reports WCAG contrast violations.
 * Pure function, zero DOM, zero fetch.
 */

import { checkWcagContrast, parseColor, type ContrastLevel } from './contrast.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type SurfaceKind = 'light' | 'dark';

export type SurfaceDefinition = {
    /** Surface name matching data-surface attribute (e.g. 'default', 'muted') */
    name: string;
    /** Flat background color for contrast calculation (hex). For gradients, use the lightest stop. */
    background: string;
    /** Whether this surface is light or dark — determines which tokens are at risk */
    kind: SurfaceKind;
};

export type ThemePackTokens = {
    /** Theme-pack id (e.g. 'accoglienza') */
    id: string;
    /** CSS variable overrides: key = var name, value = color string */
    cssVars: Record<string, string>;
};

export type TokenRole = 'text' | 'background' | 'border' | 'accent' | 'unknown';

export type ThemeAuditViolation = {
    /** CSS variable name (e.g. '--text-secondary') */
    token: string;
    /** Role inferred from token name */
    role: TokenRole;
    /** The color value from the theme-pack */
    value: string;
    /** Surface where the violation occurs */
    surface: string;
    /** Background color of that surface */
    surfaceBackground: string;
    /** Computed contrast ratio */
    ratio: number;
    /** Required minimum ratio */
    required: number;
    /** WCAG level tested */
    level: ContrastLevel;
};

export type ThemeAuditResult = {
    themePackId: string;
    level: ContrastLevel;
    violations: ThemeAuditViolation[];
    checked: number;
    passed: boolean;
};

// ── Default surface map ──────────────────────────────────────────────────────

/**
 * Default Valentino surface backgrounds.
 * For gradients, we use the lightest color (worst-case for dark text)
 * or darkest color (worst-case for light text).
 */
export const VALENTINO_SURFACES: SurfaceDefinition[] = [
    { name: 'default',       background: '#ffffff', kind: 'light' },
    { name: 'muted',         background: '#f8fafc', kind: 'light' },
    { name: 'accent',        background: '#fff7fb', kind: 'light' },
    { name: 'reading-light', background: '#ffffff', kind: 'light' },
    { name: 'ops-light',     background: '#f8fafc', kind: 'light' },
    { name: 'dark',          background: '#020617', kind: 'dark'  },
    { name: 'shell-dark',    background: '#020617', kind: 'dark'  },
];

// ── Token role inference ─────────────────────────────────────────────────────

export function inferTokenRole(varName: string): TokenRole {
    const lower = varName.toLowerCase();
    // Border check BEFORE color — --border-color is a border, not text
    if (lower.includes('border') || lower.includes('glass-border'))
        return 'border';
    if (lower.includes('bg') || lower.includes('background') || lower.includes('surface'))
        return 'background';
    if (lower.includes('text') || lower.includes('font'))
        return 'text';
    if (lower.includes('accent') || lower.includes('gold') || lower.includes('cyan') || lower.includes('violet'))
        return 'accent';
    return 'unknown';
}

// ── Core audit function ──────────────────────────────────────────────────────

/**
 * Audit a theme-pack's text tokens against all surfaces.
 *
 * For each text token (--text-*, --font-* excluded since fonts aren't colors):
 * - Check contrast on every light surface (text on light bg)
 * - Check contrast on every dark surface (text on dark bg)
 *
 * Accent tokens are also checked since they may be used as interactive text.
 *
 * If `foundationTokens` is provided, tokens NOT overridden by the theme-pack
 * are checked using the foundation (CSS :root) value. This catches the case
 * where the base theme defines a color that fails on a surface, and no
 * theme-pack overrides it.
 */
export function auditThemePack(
    themePack: ThemePackTokens,
    options?: {
        surfaces?: SurfaceDefinition[];
        level?: ContrastLevel;
        /** Foundation :root tokens (base theme). Tokens not in the theme-pack are checked from here. */
        foundationTokens?: Record<string, string>;
    },
): ThemeAuditResult {
    const surfaces = options?.surfaces ?? VALENTINO_SURFACES;
    const level = options?.level ?? 'AA';
    const violations: ThemeAuditViolation[] = [];
    let checked = 0;

    // Merge: theme-pack overrides foundation
    const effectiveTokens: Record<string, string> = {
        ...(options?.foundationTokens ?? {}),
        ...themePack.cssVars,
    };

    for (const [varName, value] of Object.entries(effectiveTokens)) {
        const role = inferTokenRole(varName);

        // Only check tokens that are used as foreground text/accent
        if (role !== 'text' && role !== 'accent') continue;

        // Skip non-color values (e.g. font-family)
        if (!parseColor(value)) continue;

        for (const surface of surfaces) {
            checked++;
            const result = checkWcagContrast(value, surface.background, level);

            if (!result.passes) {
                violations.push({
                    token: varName,
                    role,
                    value,
                    surface: surface.name,
                    surfaceBackground: surface.background,
                    ratio: result.ratio,
                    required: level === 'AAA' ? 7.0 : 4.5,
                    level,
                });
            }
        }
    }

    return {
        themePackId: themePack.id,
        level,
        violations,
        checked,
        passed: violations.length === 0,
    };
}

// ── Registry validation ──────────────────────────────────────────────────────

export type RegistryViolation = {
    token: string;
    themePackId: string;
    reason: string;
};

/**
 * Validate that a theme-pack only overrides tokens allowed by the registry
 * and that overridden values are parseable colors.
 */
export function validateThemePackAgainstRegistry(
    themePack: ThemePackTokens,
    registry: { mutableTokens: string[] },
): RegistryViolation[] {
    const violations: RegistryViolation[] = [];
    const allowed = new Set(registry.mutableTokens);

    for (const varName of Object.keys(themePack.cssVars)) {
        if (!allowed.has(varName)) {
            violations.push({
                token: varName,
                themePackId: themePack.id,
                reason: `Token "${varName}" is not in the registry's mutableTokens list`,
            });
        }
    }

    return violations;
}

// ── Batch audit ──────────────────────────────────────────────────────────────

export type BatchAuditResult = {
    results: ThemeAuditResult[];
    registryViolations: RegistryViolation[];
    allPassed: boolean;
};

/**
 * Audit multiple theme-packs at once, optionally validating against the registry.
 */
export function auditThemePacks(
    themePacks: ThemePackTokens[],
    options?: {
        surfaces?: SurfaceDefinition[];
        level?: ContrastLevel;
        registry?: { mutableTokens: string[] };
    },
): BatchAuditResult {
    const results = themePacks.map(tp => auditThemePack(tp, options));
    const registryViolations = options?.registry
        ? themePacks.flatMap(tp => validateThemePackAgainstRegistry(tp, options.registry!))
        : [];

    return {
        results,
        registryViolations,
        allPassed: results.every(r => r.passed) && registryViolations.length === 0,
    };
}

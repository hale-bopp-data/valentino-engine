/**
 * WCAG Contrast Checker — pure luminance-based contrast ratio calculation.
 * Implements WCAG 2.1 relative luminance and contrast ratio formulas.
 * No DOM, no canvas.
 */

export type ContrastLevel = 'AA' | 'AAA';

export type ContrastResult = {
    ratio: number;
    passes: boolean;
    level: ContrastLevel;
    foreground: string;
    background: string;
};

/**
 * Parse a hex color string to [r, g, b] (0-255).
 * Supports #RGB, #RRGGBB, #RRGGBBAA.
 */
export function parseHexColor(hex: string): [number, number, number] | null {
    const clean = hex.replace('#', '');
    if (clean.length === 3) {
        return [
            parseInt(clean[0] + clean[0], 16),
            parseInt(clean[1] + clean[1], 16),
            parseInt(clean[2] + clean[2], 16),
        ];
    }
    if (clean.length === 6 || clean.length === 8) {
        return [
            parseInt(clean.slice(0, 2), 16),
            parseInt(clean.slice(2, 4), 16),
            parseInt(clean.slice(4, 6), 16),
        ];
    }
    return null;
}

/**
 * Parse rgb(r, g, b) or rgba(r, g, b, a) to [r, g, b].
 */
export function parseRgbColor(rgb: string): [number, number, number] | null {
    const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return null;
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

/**
 * Parse a color string (hex or rgb/rgba) to [r, g, b].
 */
export function parseColor(color: string): [number, number, number] | null {
    const trimmed = color.trim().toLowerCase();
    if (trimmed.startsWith('#')) return parseHexColor(trimmed);
    if (trimmed.startsWith('rgb')) return parseRgbColor(trimmed);
    return null;
}

/**
 * Compute relative luminance per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const sRGB = c / 255;
        return sRGB <= 0.04045
            ? sRGB / 12.92
            : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Compute contrast ratio between two luminance values.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Minimum contrast ratios per WCAG 2.1 for normal text.
 */
const MIN_RATIO: Record<ContrastLevel, number> = {
    AA: 4.5,
    AAA: 7.0,
};

/**
 * Check WCAG contrast between two colors.
 * Returns ratio, pass/fail, and the level tested.
 */
export function checkWcagContrast(
    foreground: string,
    background: string,
    level: ContrastLevel = 'AA',
): ContrastResult {
    const fg = parseColor(foreground);
    const bg = parseColor(background);

    if (!fg || !bg) {
        return { ratio: 0, passes: false, level, foreground, background };
    }

    const fgLum = relativeLuminance(...fg);
    const bgLum = relativeLuminance(...bg);
    const ratio = contrastRatio(fgLum, bgLum);

    return {
        ratio: Math.round(ratio * 100) / 100,
        passes: ratio >= MIN_RATIO[level],
        level,
        foreground,
        background,
    };
}

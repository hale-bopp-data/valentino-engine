import { describe, it, expect } from 'vitest';
import {
    probeContrastUsage, probeContrastUsageMulti,
    parseRemappedTokens, parseTextTokenUsages,
    extractShadowDomStyles,
} from './contrast-usage-probe.js';

// ── parseRemappedTokens ──────────────────────────────────────────────────────

describe('parseRemappedTokens', () => {
    it('detects tokens remapped in surface blocks', () => {
        const css = `
.valentino-section-shell[data-surface='default'] {
    --valentino-surface-bg: #ffffff;
    --text-secondary: var(--valentino-surface-default-text-muted);
}
.valentino-section-shell[data-surface='muted'] {
    --text-secondary: var(--valentino-surface-muted-text-muted);
}`;
        const result = parseRemappedTokens(css);
        expect(result.get('--text-secondary')).toContain('default');
        expect(result.get('--text-secondary')).toContain('muted');
    });

    it('returns empty map for CSS without surface blocks', () => {
        const css = `.nav-links a { color: var(--text-secondary); }`;
        const result = parseRemappedTokens(css);
        expect(result.size).toBe(0);
    });
});

// ── parseTextTokenUsages ─────────────────────────────────────────────────────

describe('parseTextTokenUsages', () => {
    it('finds text token usages outside surface blocks', () => {
        const css = `.nav-links a { color: var(--text-secondary); }`;
        const usages = parseTextTokenUsages(css);
        expect(usages).toHaveLength(1);
        expect(usages[0].token).toBe('--text-secondary');
    });

    it('skips usages inside surface remap blocks', () => {
        const css = `
.valentino-section-shell[data-surface='default'] {
    --text-secondary: var(--valentino-surface-default-text-muted);
}
.card-desc { color: var(--text-secondary); }`;
        const usages = parseTextTokenUsages(css);
        // Only the .card-desc usage, not the remap inside the surface block
        expect(usages).toHaveLength(1);
        expect(usages[0].selector).toContain('card-desc');
    });

    it('ignores background tokens', () => {
        const css = `.hero { background: var(--bg-deep-void); }`;
        const usages = parseTextTokenUsages(css);
        expect(usages).toHaveLength(0);
    });

    it('finds accent tokens', () => {
        const css = `.link:hover { color: var(--accent-neural-cyan); }`;
        const usages = parseTextTokenUsages(css);
        expect(usages).toHaveLength(1);
        expect(usages[0].token).toBe('--accent-neural-cyan');
    });
});

// ── probeContrastUsage ───────────────────────────────────────────────────────

describe('probeContrastUsage', () => {
    it('warns when --text-secondary is used but not remapped in light surfaces', () => {
        const css = `
.valentino-section-shell[data-surface='default'] {
    --valentino-surface-bg: #ffffff;
    --valentino-surface-text: #0f172a;
}
.nav-links a { color: var(--text-secondary); }`;

        const result = probeContrastUsage(css);
        expect(result.valid).toBe(false);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].token).toBe('--text-secondary');
        expect(result.warnings[0].unremappedSurfaces).toContain('default');
    });

    it('passes when --text-secondary is remapped in all light surfaces', () => {
        const css = `
.valentino-section-shell[data-surface='default'] { --text-secondary: #475569; }
.valentino-section-shell[data-surface='muted'] { --text-secondary: #475569; }
.valentino-section-shell[data-surface='accent'] { --text-secondary: #4b5563; }
.valentino-section-shell[data-surface='reading-light'] { --text-secondary: #334155; }
.valentino-section-shell[data-surface='ops-light'] { --text-secondary: #475569; }
.nav-links a { color: var(--text-secondary); }`;

        const result = probeContrastUsage(css);
        expect(result.valid).toBe(true);
    });

    it('warns for multiple tokens independently', () => {
        const css = `
.hero h1 { color: var(--text-primary); }
.card-desc { color: var(--text-secondary); }`;

        const result = probeContrastUsage(css);
        expect(result.warnings).toHaveLength(2);
        const tokens = result.warnings.map(w => w.token);
        expect(tokens).toContain('--text-primary');
        expect(tokens).toContain('--text-secondary');
    });

    it('only warns once per token even if used multiple times', () => {
        const css = `
.nav-links a { color: var(--text-secondary); }
.card-desc { color: var(--text-secondary); }
.hero p.tagline { color: var(--text-secondary); }`;

        const result = probeContrastUsage(css);
        expect(result.warnings).toHaveLength(1);
    });

    it('no warnings for CSS with no text token usage', () => {
        const css = `.hero { background: var(--bg-deep-void); padding: 2rem; }`;
        const result = probeContrastUsage(css);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('catches rgba(var(--rgb-*)) pattern used in hover states', () => {
        const css = `.btn:hover { box-shadow: 0 0 10px rgba(var(--rgb-neural-cyan), 0.4); }`;
        const result = probeContrastUsage(css);
        const rgbWarnings = result.warnings.filter(w => w.token === '--rgb-neural-cyan');
        expect(rgbWarnings.length).toBeGreaterThan(0);
    });

    it('skips dark-scoped tokens even with rgba pattern', () => {
        const css = `.widget { color: var(--action-widget-dark-text); }`;
        const result = probeContrastUsage(css);
        const darkWarnings = result.warnings.filter(w => w.token === '--action-widget-dark-text');
        expect(darkWarnings).toHaveLength(0);
    });
});

// ── extractShadowDomStyles ───────────────────────────────────────────────────

describe('extractShadowDomStyles', () => {
    it('extracts CSS from <style> blocks in template literals', () => {
        const source = `
class MyComponent extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = \`
            <style>
                .footer-col a { color: var(--text-secondary); }
                .footer-col a:hover { color: var(--accent-neural-cyan); }
            </style>
            <div class="footer-col"><a href="/">Home</a></div>
        \`;
    }
}`;
        const styles = extractShadowDomStyles(source, 'my-component.ts');
        expect(styles).toHaveLength(1);
        expect(styles[0].componentName).toBe('my-component.ts');
        expect(styles[0].css).toContain('--text-secondary');
        expect(styles[0].css).toContain('--accent-neural-cyan');
    });

    it('extracts multiple <style> blocks', () => {
        const source = `
            <style>.a { color: var(--text-primary); }</style>
            <style>.b { color: var(--text-secondary); }</style>
        `;
        const styles = extractShadowDomStyles(source, 'multi.ts');
        expect(styles).toHaveLength(2);
    });

    it('returns empty for files without <style> blocks', () => {
        const source = `export function helper() { return 42; }`;
        expect(extractShadowDomStyles(source)).toEqual([]);
    });
});

// ── probeContrastUsageMulti ──────────────────────────────────────────────────

describe('probeContrastUsageMulti', () => {
    const primaryCss = `
.valentino-section-shell[data-surface='default'] {
    --valentino-surface-bg: #ffffff;
}
.nav-links a { color: var(--text-secondary); }`;

    it('finds warnings from primary CSS', () => {
        const result = probeContrastUsageMulti(primaryCss);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.sources).toHaveLength(1);
    });

    it('finds warnings from additional Shadow DOM sources', () => {
        const componentCss = `.footer-col a { color: var(--text-muted); }`;
        const result = probeContrastUsageMulti(primaryCss, [
            { name: 'sovereign-footer.ts', css: componentCss },
        ]);
        // --text-secondary from primary + --text-muted from component
        const tokens = result.warnings.map(w => w.token);
        expect(tokens).toContain('--text-secondary');
        expect(tokens).toContain('--text-muted');
        expect(result.sources).toHaveLength(2);
    });

    it('deduplicates tokens across sources', () => {
        const componentCss = `.link { color: var(--text-secondary); }`;
        const result = probeContrastUsageMulti(primaryCss, [
            { name: 'component.ts', css: componentCss },
        ]);
        // --text-secondary appears in both but should warn only once
        const textSecWarnings = result.warnings.filter(w => w.token === '--text-secondary');
        expect(textSecWarnings).toHaveLength(1);
    });
});

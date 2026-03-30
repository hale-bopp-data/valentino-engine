import { describe, it, expect } from 'vitest';
import {
    auditThemePack,
    auditThemePacks,
    validateThemePackAgainstRegistry,
    inferTokenRole,
    VALENTINO_SURFACES,
    type ThemePackTokens,
} from './theme-audit.js';

// ── inferTokenRole ───────────────────────────────────────────────────────────

describe('inferTokenRole', () => {
    it('classifies --text-secondary as text', () => {
        expect(inferTokenRole('--text-secondary')).toBe('text');
    });
    it('classifies --text-primary as text', () => {
        expect(inferTokenRole('--text-primary')).toBe('text');
    });
    it('classifies --text-sovereign-gold as text', () => {
        expect(inferTokenRole('--text-sovereign-gold')).toBe('text');
    });
    it('classifies --accent-neural-cyan as accent', () => {
        expect(inferTokenRole('--accent-neural-cyan')).toBe('accent');
    });
    it('classifies --bg-deep-void as background', () => {
        expect(inferTokenRole('--bg-deep-void')).toBe('background');
    });
    it('classifies --glass-border as border', () => {
        expect(inferTokenRole('--glass-border')).toBe('border');
    });
    it('classifies --font-family as text', () => {
        expect(inferTokenRole('--font-family')).toBe('text');
    });
});

// ── auditThemePack ──────────────────────────────────────────────────────────

describe('auditThemePack', () => {
    const accoglienza: ThemePackTokens = {
        id: 'accoglienza',
        cssVars: {
            '--bg-deep-void': '#0b1221',
            '--text-sovereign-gold': '#fbbf24',
            '--accent-neural-cyan': '#60a5fa',
            '--glass-border': 'rgba(96, 165, 250, 0.22)',
            '--glass-bg': 'rgba(11, 18, 33, 0.72)',
            '--text-primary': '#f8fafc',
            '--text-secondary': '#d1d5db',
            '--font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        },
    };

    it('detects --text-secondary failing on light surfaces', () => {
        const result = auditThemePack(accoglienza);
        const textSecondaryFails = result.violations.filter(v => v.token === '--text-secondary');
        expect(textSecondaryFails.length).toBeGreaterThan(0);
        // Should fail on all 5 light surfaces
        const lightSurfaces = textSecondaryFails.map(v => v.surface);
        expect(lightSurfaces).toContain('default');
        expect(lightSurfaces).toContain('muted');
    });

    it('detects --text-primary failing on light surfaces (light text on white)', () => {
        const result = auditThemePack(accoglienza);
        const textPrimaryFails = result.violations.filter(v => v.token === '--text-primary');
        // #f8fafc on #ffffff → ~1.01:1, should fail
        expect(textPrimaryFails.length).toBeGreaterThan(0);
    });

    it('passes a well-configured dark-only theme-pack on dark surfaces only', () => {
        const result = auditThemePack(accoglienza, {
            surfaces: VALENTINO_SURFACES.filter(s => s.kind === 'dark'),
        });
        // --text-primary (#f8fafc) and --text-secondary (#d1d5db) should pass on dark (#020617)
        const textFails = result.violations.filter(v => v.token.startsWith('--text'));
        expect(textFails).toEqual([]);
    });

    it('skips non-color values like font-family', () => {
        const result = auditThemePack(accoglienza);
        const fontFails = result.violations.filter(v => v.token === '--font-family');
        expect(fontFails).toEqual([]);
    });

    it('skips background/border tokens', () => {
        const result = auditThemePack(accoglienza);
        const bgFails = result.violations.filter(v => v.token === '--bg-deep-void');
        const borderFails = result.violations.filter(v => v.token === '--glass-border');
        expect(bgFails).toEqual([]);
        expect(borderFails).toEqual([]);
    });

    it('supports AAA level', () => {
        const result = auditThemePack(accoglienza, { level: 'AAA' });
        // AAA requires 7.0:1, should have more violations than AA
        const aaResult = auditThemePack(accoglienza, { level: 'AA' });
        expect(result.violations.length).toBeGreaterThanOrEqual(aaResult.violations.length);
    });

    it('reports correct ratio and required values', () => {
        const result = auditThemePack(accoglienza);
        for (const v of result.violations) {
            expect(v.ratio).toBeGreaterThan(0);
            expect(v.required).toBe(4.5);
            expect(v.level).toBe('AA');
        }
    });

    it('passes a theme-pack with high-contrast text tokens', () => {
        const highContrast: ThemePackTokens = {
            id: 'high-contrast',
            cssVars: {
                '--text-primary': '#000000',
                '--text-secondary': '#333333',
            },
        };
        const result = auditThemePack(highContrast);
        // #000000 and #333333 on any bg should pass (or at worst #333333 on dark)
        const lightFails = result.violations.filter(
            v => VALENTINO_SURFACES.find(s => s.name === v.surface)?.kind === 'light'
        );
        expect(lightFails).toEqual([]);
    });
});

// ── validateThemePackAgainstRegistry ─────────────────────────────────────────

describe('validateThemePackAgainstRegistry', () => {
    const registry = {
        mutableTokens: [
            '--bg-deep-void', '--text-sovereign-gold', '--accent-neural-cyan',
            '--glass-border', '--glass-bg', '--text-primary', '--text-secondary',
            '--font-family',
        ],
    };

    it('passes when all tokens are in the allowed list', () => {
        const tp: ThemePackTokens = {
            id: 'test',
            cssVars: { '--text-primary': '#000', '--text-secondary': '#333' },
        };
        expect(validateThemePackAgainstRegistry(tp, registry)).toEqual([]);
    });

    it('reports unauthorized tokens', () => {
        const tp: ThemePackTokens = {
            id: 'rogue',
            cssVars: { '--text-primary': '#000', '--custom-sneaky': '#f00' },
        };
        const violations = validateThemePackAgainstRegistry(tp, registry);
        expect(violations).toHaveLength(1);
        expect(violations[0].token).toBe('--custom-sneaky');
    });
});

// ── foundationTokens (base theme fallback) ──────────────────────────────────

describe('auditThemePack with foundationTokens', () => {
    const foundation: Record<string, string> = {
        '--text-primary': '#f8fafc',
        '--text-secondary': '#cbd5e1',
        '--accent-neural-cyan': '#0cd6c7',
    };

    it('checks foundation tokens when no theme-pack overrides them', () => {
        const emptyPack: ThemePackTokens = { id: 'empty', cssVars: {} };
        const result = auditThemePack(emptyPack, { foundationTokens: foundation });
        // --text-primary (#f8fafc) and --text-secondary (#cbd5e1) fail on light
        const lightFails = result.violations.filter(
            v => VALENTINO_SURFACES.find(s => s.name === v.surface)?.kind === 'light'
        );
        expect(lightFails.length).toBeGreaterThan(0);
    });

    it('theme-pack override takes precedence over foundation', () => {
        const overridePack: ThemePackTokens = {
            id: 'override',
            cssVars: { '--text-secondary': '#333333' },
        };
        const result = auditThemePack(overridePack, { foundationTokens: foundation });
        // --text-secondary is now #333333 (from pack), not #cbd5e1 (from foundation)
        const textSecLight = result.violations.filter(
            v => v.token === '--text-secondary' && VALENTINO_SURFACES.find(s => s.name === v.surface)?.kind === 'light'
        );
        expect(textSecLight).toEqual([]);
    });

    it('foundation tokens not in theme-pack are still checked', () => {
        const partialPack: ThemePackTokens = {
            id: 'partial',
            cssVars: { '--text-secondary': '#333333' },
        };
        const result = auditThemePack(partialPack, { foundationTokens: foundation });
        // --text-primary (#f8fafc from foundation) still fails on light
        const textPrimaryFails = result.violations.filter(v => v.token === '--text-primary');
        expect(textPrimaryFails.length).toBeGreaterThan(0);
    });

    it('checked count includes both foundation and theme-pack tokens', () => {
        const emptyPack: ThemePackTokens = { id: 'empty', cssVars: {} };
        const result = auditThemePack(emptyPack, { foundationTokens: foundation });
        // 3 tokens × 7 surfaces = 21 checks
        expect(result.checked).toBe(21);
    });
});

// ── auditThemePacks (batch) ─────────────────────────────────────────────────

describe('auditThemePacks', () => {
    it('audits multiple theme-packs and aggregates results', () => {
        const packs: ThemePackTokens[] = [
            { id: 'a', cssVars: { '--text-secondary': '#cbd5e1' } },
            { id: 'b', cssVars: { '--text-secondary': '#333333' } },
        ];
        const result = auditThemePacks(packs);
        expect(result.results).toHaveLength(2);
        // Pack 'a' should fail on light, pack 'b' should pass on light
        expect(result.results[0].passed).toBe(false);
        // Pack 'b' #333333 on dark (#020617) might also fail, so just check light violations
        const bLightViolations = result.results[1].violations.filter(
            v => VALENTINO_SURFACES.find(s => s.name === v.surface)?.kind === 'light'
        );
        expect(bLightViolations).toEqual([]);
    });
});

// ── VALENTINO_SURFACES ──────────────────────────────────────────────────────

describe('VALENTINO_SURFACES', () => {
    it('has 7 surfaces', () => {
        expect(VALENTINO_SURFACES).toHaveLength(7);
    });
    it('has 5 light and 2 dark surfaces', () => {
        expect(VALENTINO_SURFACES.filter(s => s.kind === 'light')).toHaveLength(5);
        expect(VALENTINO_SURFACES.filter(s => s.kind === 'dark')).toHaveLength(2);
    });
});

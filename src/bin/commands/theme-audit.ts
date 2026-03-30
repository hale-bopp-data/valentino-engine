/**
 * CLI command: valentino theme-audit <theme-pack.json> [--surfaces surfaces.json] [--registry registry.json] [--level AA|AAA]
 *
 * Static contrast analysis: crosses theme-pack text tokens with Valentino surfaces.
 */

import { readFileSync } from 'node:fs';
import {
    auditThemePack,
    validateThemePackAgainstRegistry,
    VALENTINO_SURFACES,
    type ThemePackTokens,
    type SurfaceDefinition,
} from '../../core/theme-audit.js';
import type { ContrastLevel } from '../../core/contrast.js';

function loadJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function parseThemePack(raw: unknown): ThemePackTokens {
    const obj = raw as Record<string, unknown>;
    return {
        id: (obj.id as string) ?? 'unknown',
        cssVars: (obj.cssVars as Record<string, string>) ?? {},
    };
}

export function runThemeAudit(args: string[]): void {
    if (args.length === 0) {
        console.error('Usage: valentino theme-audit <theme-pack.json> [--surfaces surfaces.json] [--registry registry.json] [--level AA|AAA]');
        process.exit(1);
    }

    const themePackPath = args[0];
    let surfacesPath: string | null = null;
    let registryPath: string | null = null;
    let level: ContrastLevel = 'AA';

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--surfaces' && args[i + 1]) { surfacesPath = args[++i]; }
        else if (args[i] === '--registry' && args[i + 1]) { registryPath = args[++i]; }
        else if (args[i] === '--level' && args[i + 1]) { level = args[++i] as ContrastLevel; }
    }

    const themePack = parseThemePack(loadJson(themePackPath));

    const surfaces: SurfaceDefinition[] = surfacesPath
        ? (loadJson(surfacesPath) as SurfaceDefinition[])
        : VALENTINO_SURFACES;

    // Contrast audit
    const result = auditThemePack(themePack, { surfaces, level });

    // Registry validation (if provided)
    const registryViolations = registryPath
        ? validateThemePackAgainstRegistry(
            themePack,
            (loadJson(registryPath) as { themePacks: { mutableTokens: string[] } }).themePacks,
        )
        : [];

    // Output
    console.log(`\nTheme-pack: ${result.themePackId}`);
    console.log(`Level: ${level} | Checks: ${result.checked} | Surfaces: ${surfaces.length}`);
    console.log('─'.repeat(70));

    if (registryViolations.length > 0) {
        console.log(`\n⚠ Registry violations (${registryViolations.length}):\n`);
        for (const v of registryViolations) {
            console.log(`  ${v.token} — ${v.reason}`);
        }
    }

    if (result.violations.length > 0) {
        console.log(`\n✗ Contrast violations (${result.violations.length}):\n`);
        for (const v of result.violations) {
            console.log(`  ${v.token}: ${v.value} on ${v.surface} (${v.surfaceBackground})`);
            console.log(`    ratio ${v.ratio}:1 — needs ${v.required}:1\n`);
        }
        process.exit(1);
    } else {
        console.log(`\n✓ All ${result.checked} token×surface pairs pass ${level} contrast.\n`);
    }
}

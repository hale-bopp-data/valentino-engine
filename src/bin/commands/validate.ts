import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { validatePageSpec } from '../../core/page-spec.js';
import { collectPureCmsWarnings } from '../../core/guardrails-cms.js';
import type { PagesManifestV1 } from '../../core/types.js';
import type { RedirectRule } from '../../core/redirects.js';
import type { CmsWarning } from '../../core/guardrails-cms.js';

type GuardrailSeverityOverride = { severity: string; [k: string]: unknown };
type GuardrailsProfile = {
    template: string;
    guardrails: Record<string, GuardrailSeverityOverride>;
};

function findProjectRoot(startDir: string): string | null {
    let dir = resolve(startDir);
    for (let i = 0; i < 10; i++) {
        if (existsSync(resolve(dir, 'valentino.config.json'))) return dir;
        if (existsSync(resolve(dir, 'valentino.guardrails.json'))) return dir;
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function loadGuardrailsProfile(projectRoot: string): GuardrailsProfile | null {
    const filePath = resolve(projectRoot, 'valentino.guardrails.json');
    if (!existsSync(filePath)) return null;
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { return null; }
}

function loadJSON<T>(filePath: string): T | null {
    if (!existsSync(filePath)) return null;
    try { return JSON.parse(readFileSync(filePath, 'utf-8')); } catch { return null; }
}

function filterByProfile(warnings: CmsWarning[], profile: GuardrailsProfile): CmsWarning[] {
    return warnings.filter((w) => {
        // Map warning type to guardrail key
        const key = mapWarningTypeToKey(w.type);
        const override = profile.guardrails[key];
        if (!override) return true; // No override → keep as-is
        if (override.severity === 'off') return false; // Disabled
        // Upgrade/downgrade severity
        if (override.severity === 'error') w.severity = 'error';
        if (override.severity === 'warning') w.severity = 'warning';
        return true;
    });
}

function mapWarningTypeToKey(type: string): string {
    const map: Record<string, string> = {
        'cms-draft-orphan': 'draft-orphan',
        'cms-publishat-invalid': 'publishAt',
        'cms-publishat-past': 'publishAt',
        'cms-maintenance-mode-active': 'maintenance',
        'cms-no-404-page': '404',
        'cms-redirect-target-missing': 'redirect',
        'cms-redirect-chain': 'redirect',
        'cms-seo-missing': 'seo',
        'cms-language-coverage': 'i18n',
        'cms-media-orphan': 'media',
        'cms-media-missing-alt': 'media',
        'cms-media-oversize': 'media',
        'cms-media-format-legacy': 'media',
    };
    return map[type] || type;
}

export function runValidate(args: string[]): void {
    const files = args.filter((a) => !a.startsWith('-'));
    const cmsMode = args.includes('--cms') || args.includes('--all');
    const quietMode = args.includes('--quiet');

    if (!files.length) {
        console.error('Usage: valentino validate <spec.json> [spec2.json ...] [--cms] [--all] [--quiet]');
        process.exit(1);
    }

    // Find project root and guardrails profile
    const projectRoot = findProjectRoot(process.cwd()) || findProjectRoot(dirname(resolve(files[0])));
    const profile = projectRoot ? loadGuardrailsProfile(projectRoot) : null;

    let hasErrors = false;
    let totalWarnings = 0;
    let totalErrors = 0;

    // 1. Validate each page spec
    for (const file of files) {
        const json = loadJSON<any>(resolve(file));
        if (!json) {
            console.error(`  ❌ Cannot read: ${file}`);
            hasErrors = true;
            continue;
        }

        const valid = validatePageSpec(json);
        if (!valid) {
            console.error(`  ❌ Invalid PageSpec: ${file}`);
            hasErrors = true;
        } else if (!quietMode) {
            console.log(`  ✅ ${file}`);
        }
    }

    // 2. CMS guardrails (if --cms/--all or if guardrails profile exists)
    if (cmsMode || profile) {
        const manifestPath = projectRoot
            ? resolve(projectRoot, 'public/pages/pages.manifest.json')
            : null;

        if (manifestPath && existsSync(manifestPath)) {
            const manifest = loadJSON<PagesManifestV1>(manifestPath);
            if (manifest) {
                // Load redirects
                const redirectsPath = resolve(dirname(manifestPath), '..', 'redirects.json');
                const redirectsData = loadJSON<{ rules: RedirectRule[] }>(redirectsPath);

                // Load specs for SEO check
                const specsById = new Map<string, { seo?: any }>();
                for (const page of manifest.pages) {
                    const specPath = resolve(dirname(manifestPath), '..', page.spec.replace(/^\//, ''));
                    const spec = loadJSON<any>(specPath);
                    if (spec) specsById.set(page.id, spec);
                }

                let warnings = collectPureCmsWarnings(manifest, {
                    redirectRules: redirectsData?.rules,
                    specsById,
                });

                // Apply guardrails profile
                if (profile) {
                    warnings = filterByProfile(warnings, profile);
                }

                for (const w of warnings) {
                    if (w.severity === 'error') {
                        console.error(`  ❌ [${w.type}] ${w.message}`);
                        totalErrors++;
                        hasErrors = true;
                    } else {
                        console.log(`  ⚠  [${w.type}] ${w.message}`);
                        totalWarnings++;
                    }
                }
            }
        }
    }

    // Summary
    if (!quietMode) {
        const profileLabel = profile ? ` (profile: ${profile.template})` : '';
        if (totalErrors > 0 || totalWarnings > 0) {
            console.log(`\n  ${totalErrors} error(s), ${totalWarnings} warning(s)${profileLabel}`);
        } else if (cmsMode || profile) {
            console.log(`\n  All checks passed${profileLabel}`);
        }
    }

    if (hasErrors) process.exit(1);
}

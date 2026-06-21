import { readFileSync } from 'fs';
import { validatePageSpec } from '../../core/page-spec.js';
import { probeRhythm } from '../../core/rhythm.js';
import { probeHeroContract } from '../../core/hero-contract.js';
import { probeSectionIntegrity } from '../../core/section-integrity.js';
import { isValidProfile } from '../../core/spa-profile.js';
import type { AuditProfile } from '../../core/spa-profile.js';
import { createJsonOutput, printJson } from '../../core/json-output.js';
import type { JsonSection } from '../../core/json-output.js';
import type { PageSpecV1, HeroSection } from '../../core/types.js';

function loadSpec(file: string): PageSpecV1 {
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    if (!validatePageSpec(json)) {
        console.error('❌ File is not a valid PageSpecV1.');
        process.exit(1);
    }
    return json;
}

function printWarnings(label: string, warnings: { rule: string; message: string }[]): boolean {
    if (warnings.length === 0) {
        console.log(`  ✅ ${label}: no issues`);
        return true;
    }
    console.log(`  ❌ ${label}: ${warnings.length} issue(s)`);
    warnings.forEach(w => console.log(`     • [${w.rule}] ${w.message}`));
    return false;
}

export function runProbe(subcommand: string, args: string[]): void {
    const file = args.find(a => !a.startsWith('-'));
    const json = args.includes('--json');
    const profileArg = args.find(a => a.startsWith('--profile'))?.split('=')[1]
        || (args.includes('--profile') ? args[args.indexOf('--profile') + 1] : undefined);
    const profile: AuditProfile = profileArg && isValidProfile(profileArg) ? profileArg : 'landing';

    if (!file) {
        console.error('Usage: valentino probe <rhythm|hero|integrity|all> <path-to-spec.json> [--json] [--profile landing|spa|dashboard|chat|data-table|form]');
        process.exit(1);
    }

    const spec = loadSpec(file);
    const sections: JsonSection[] = [];
    let allValid = true;

    if (subcommand === 'rhythm' || subcommand === 'all') {
        const result = probeRhythm(spec, { profile });
        if (!result.valid) allValid = false;
        sections.push({
            name: 'Rhythm',
            status: result.valid ? 'pass' : 'fail',
            violations: result.warnings,
            warnings: [],
        });
    }

    if (subcommand === 'hero' || subcommand === 'all') {
        const heroes = spec.sections.filter((s): s is HeroSection => s.type === 'hero');
        for (const hero of heroes) {
            const result = probeHeroContract(hero);
            if (!result.valid) allValid = false;
            sections.push({
                name: `Hero (${hero.titleKey})`,
                status: result.valid ? 'pass' : 'fail',
                violations: result.warnings,
                warnings: [],
            });
        }
        if (heroes.length === 0) {
            sections.push({ name: 'Hero', status: 'skip', violations: [], warnings: [] });
        }
    }

    if (subcommand === 'integrity' || subcommand === 'all') {
        const result = probeSectionIntegrity(spec.sections);
        if (!result.valid) allValid = false;
        sections.push({
            name: 'Section Integrity',
            status: result.valid ? 'pass' : 'fail',
            violations: result.warnings,
            warnings: [],
        });
    }

    if (json) {
        printJson(createJsonOutput({
            tool: 'probe',
            file,
            passed: allValid,
            exitCode: allValid ? 0 : 1,
            sections,
            summary: allValid ? 'All probes passed' : 'Probe violations found',
        }));
        if (!allValid) process.exit(1);
        return;
    }

    console.log(`\n🔍 Valentino Probe — ${file} [profile: ${profile}]\n`);
    for (const sec of sections) {
        if (sec.status === 'skip') {
            console.log(`  ⏭️  ${sec.name}: skipped`);
        } else {
            printWarnings(sec.name, sec.violations as { rule: string; message: string }[]);
        }
    }

    console.log();
    if (!allValid) process.exit(1);
}

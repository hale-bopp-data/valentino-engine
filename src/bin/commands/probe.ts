import { readFileSync } from 'fs';
import { validatePageSpec } from '../../core/page-spec.js';
import { probeRhythm } from '../../core/rhythm.js';
import { probeHeroContract } from '../../core/hero-contract.js';
import { probeSectionIntegrity } from '../../core/section-integrity.js';
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
    const file = args[0];
    if (!file) {
        console.error('Usage: valentino probe <rhythm|hero|integrity|all> <path-to-spec.json>');
        process.exit(1);
    }

    const spec = loadSpec(file);
    let allValid = true;

    console.log(`\n🔍 Valentino Probe — ${file}\n`);

    if (subcommand === 'rhythm' || subcommand === 'all') {
        const result = probeRhythm(spec);
        if (!printWarnings('Rhythm', result.warnings)) allValid = false;
    }

    if (subcommand === 'hero' || subcommand === 'all') {
        const heroes = spec.sections.filter((s): s is HeroSection => s.type === 'hero');
        if (heroes.length === 0) {
            console.log('  ⏭️  Hero: no hero section found');
        } else {
            for (const hero of heroes) {
                const result = probeHeroContract(hero);
                if (!printWarnings(`Hero (${hero.titleKey})`, result.warnings)) allValid = false;
            }
        }
    }

    if (subcommand === 'integrity' || subcommand === 'all') {
        const result = probeSectionIntegrity(spec.sections);
        if (!printWarnings('Section Integrity', result.warnings)) allValid = false;
    }

    console.log();
    if (!allValid) process.exit(1);
}

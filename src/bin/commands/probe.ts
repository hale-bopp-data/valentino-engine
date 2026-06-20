import { readFileSync } from 'fs';
import { validatePageSpec } from '../../core/page-spec.js';
import { probeRhythm } from '../../core/rhythm.js';
import { probeHeroContract } from '../../core/hero-contract.js';
import { probeSectionIntegrity } from '../../core/section-integrity.js';
import { isValidProfile } from '../../core/spa-profile.js';
import type { AuditProfile } from '../../core/spa-profile.js';
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
    const profileArg = args.find(a => a.startsWith('--profile'))?.split('=')[1]
        || args[args.indexOf('--profile') + 1];
    const profile: AuditProfile = profileArg && isValidProfile(profileArg) ? profileArg : 'landing';

    if (!file) {
        console.error('Usage: valentino probe <rhythm|hero|integrity|all> <path-to-spec.json> [--profile landing|spa|dashboard]');
        process.exit(1);
    }

    const spec = loadSpec(file);
    let allValid = true;

    console.log(`\n🔍 Valentino Probe — ${file} [profile: ${profile}]\n`);

    if (subcommand === 'rhythm' || subcommand === 'all') {
        const result = probeRhythm(spec, { profile });
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

import { readFileSync } from 'fs';
import { dirname } from 'path';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor, fixNamedColors } from '../../core/guardrails.js';
import type { GuardrailOptions } from '../../core/guardrails.js';
import { createBackup, computeDiff, formatDiff, writeFixed, parseFixArgs } from '../../core/backup.js';
import { resolveGuardrailOptions } from '../../core/guardrail-config.js';
import { createJsonOutput, printJson } from '../../core/json-output.js';

export function runAudit(args: string[]): void {
    const { fix, noBackup, file } = parseFixArgs(args);
    const allowTokenDefs = args.includes('--allow-token-definitions');
    const json = args.includes('--json');
    if (!file) {
        console.error('Usage: valentino audit <path-to-css-file> [--fix] [--no-backup] [--allow-token-definitions] [--json]');
        process.exit(1);
    }
    const css = readFileSync(file, 'utf-8');
    const opts: GuardrailOptions | undefined = resolveGuardrailOptions(allowTokenDefs, dirname(file));
    const px = checkNoHardcodedPx(css, opts);
    const color = checkNoHardcodedColor(css, opts);
    const named = checkNoNamedColor(css, opts);
    const all = [...px, ...color, ...named];

    if (json) {
        const passed = all.length === 0;
        printJson(createJsonOutput({
            tool: 'audit',
            file,
            passed,
            exitCode: passed ? 0 : 1,
            sections: [
                { name: 'Hardcoded px', status: px.length === 0 ? 'pass' : 'fail', violations: px, warnings: [] },
                { name: 'Hardcoded color', status: color.length === 0 ? 'pass' : 'fail', violations: color, warnings: [] },
                { name: 'Named color', status: named.length === 0 ? 'pass' : 'fail', violations: named, warnings: [] },
            ],
            summary: passed ? 'No guardrail violations' : `${all.length} violation(s) found`,
        }));
        if (!passed) process.exit(1);
        return;
    }
    if (all.length === 0) {
        console.log('✅ No guardrail violations found.');
        return;
    }

    console.log(`❌ ${all.length} violation(s) found:\n`);
    all.forEach(v => console.log('  •', v));

    if (!fix) {
        process.exit(1);
    }

    const fixed = fixNamedColors(css);
    if (fixed === css) {
        console.log('\nNo auto-fixable violations found (only named-color violations are auto-fixable).');
        process.exit(1);
    }

    if (!noBackup) {
        const { backupPath } = createBackup(file);
        console.log(`\n📦 Backup created: ${backupPath}`);
    }

    writeFixed(file, fixed);

    const hunks = computeDiff(css, fixed);
    console.log(`\n${formatDiff(hunks, file)}`);

    const remaining = [
        ...checkNoHardcodedPx(fixed, opts),
        ...checkNoHardcodedColor(fixed, opts),
        ...checkNoNamedColor(fixed, opts),
    ];
    if (remaining.length === 0) {
        console.log('\n✅ All violations fixed.');
    } else {
        console.log(`\n⚠️  ${remaining.length} violation(s) remain (not auto-fixable):`);
        remaining.forEach(v => console.log('  •', v));
        process.exit(1);
    }
}

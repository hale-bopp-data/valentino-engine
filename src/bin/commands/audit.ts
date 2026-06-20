import { readFileSync } from 'fs';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor, fixNamedColors } from '../../core/guardrails.js';
import { createBackup, computeDiff, formatDiff, writeFixed, parseFixArgs } from '../../core/backup.js';

export function runAudit(args: string[]): void {
    const { fix, noBackup, file } = parseFixArgs(args);
    if (!file) {
        console.error('Usage: valentino audit <path-to-css-file> [--fix] [--no-backup]');
        process.exit(1);
    }
    const css = readFileSync(file, 'utf-8');
    const all = [
        ...checkNoHardcodedPx(css),
        ...checkNoHardcodedColor(css),
        ...checkNoNamedColor(css),
    ];
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
        ...checkNoHardcodedPx(fixed),
        ...checkNoHardcodedColor(fixed),
        ...checkNoNamedColor(fixed),
    ];
    if (remaining.length === 0) {
        console.log('\n✅ All violations fixed.');
    } else {
        console.log(`\n⚠️  ${remaining.length} violation(s) remain (not auto-fixable):`);
        remaining.forEach(v => console.log('  •', v));
        process.exit(1);
    }
}

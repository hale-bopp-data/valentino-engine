import { readFileSync } from 'fs';
import { validateTokens, fixSelfReferences } from '../../core/validate-tokens.js';
import { createBackup, computeDiff, formatDiff, writeFixed, parseFixArgs } from '../../core/backup.js';

export function runValidateTokens(args: string[]): void {
    const { fix, noBackup, file } = parseFixArgs(args);
    if (!file) {
        console.error('Usage: valentino validate-tokens <path-to-css-file> [--fix] [--no-backup]');
        process.exit(1);
    }
    const css = readFileSync(file, 'utf-8');
    const result = validateTokens(css);
    console.log(`Scanned: ${result.tokenCount} CSS custom properties\n`);
    if (result.valid) {
        console.log('✅ All tokens resolve correctly. No cycles or unresolved references.');
        return;
    }

    console.log(`❌ ${result.violations.length} violation(s) found:\n`);
    result.violations.forEach(v => {
        const icon = v.type === 'self-reference' ? '🔄' : v.type === 'cycle' ? '♻️' : '❓';
        console.log(`  ${icon} [${v.type}] ${v.detail}`);
    });

    if (!fix) {
        process.exit(1);
    }

    const fixed = fixSelfReferences(css);
    if (fixed === css) {
        console.log('\nNo auto-fixable violations found (only self-references are auto-fixable).');
        process.exit(1);
    }

    if (!noBackup) {
        const { backupPath } = createBackup(file);
        console.log(`\n📦 Backup created: ${backupPath}`);
    }

    writeFixed(file, fixed);

    const hunks = computeDiff(css, fixed);
    console.log(`\n${formatDiff(hunks, file)}`);

    const remaining = validateTokens(fixed);
    if (remaining.valid) {
        console.log('\n✅ All violations fixed.');
    } else {
        console.log(`\n⚠️  ${remaining.violations.length} violation(s) remain (not auto-fixable):`);
        remaining.violations.forEach(v => {
            const icon = v.type === 'self-reference' ? '🔄' : v.type === 'cycle' ? '♻️' : '❓';
            console.log(`  ${icon} [${v.type}] ${v.detail}`);
        });
        process.exit(1);
    }
}

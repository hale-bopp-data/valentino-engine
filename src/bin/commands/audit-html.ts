import { readFileSync } from 'fs';
import { auditHtml, fixHtml } from '../../core/audit-html.js';
import { createBackup, computeDiff, formatDiff, writeFixed, parseFixArgs } from '../../core/backup.js';

export function runAuditHtml(args: string[]): void {
    const { fix, noBackup, file } = parseFixArgs(args);
    if (!file) {
        console.error('Usage: valentino audit-html <path-to-html-file> [--fix] [--no-backup]');
        process.exit(1);
    }
    const html = readFileSync(file, 'utf-8');
    const result = auditHtml(html);
    console.log(`Scanned: ${result.styleTagCount} <style> tag(s), ${result.inlineStyleCount} inline style(s)\n`);
    if (result.valid) {
        console.log('✅ No guardrail violations found.');
        return;
    }

    console.log(`❌ ${result.violations.length} violation(s) found:\n`);
    result.violations.forEach(v => {
        const src = v.source === 'inline-style' ? `<${v.element}> inline` : '<style>';
        console.log(`  • [${src}, line ${v.line}] ${v.message}`);
    });

    if (!fix) {
        process.exit(1);
    }

    const fixed = fixHtml(html);
    if (fixed === html) {
        console.log('\nNo auto-fixable violations found (only named-color violations are auto-fixable).');
        process.exit(1);
    }

    if (!noBackup) {
        const { backupPath } = createBackup(file);
        console.log(`\n📦 Backup created: ${backupPath}`);
    }

    writeFixed(file, fixed);

    const hunks = computeDiff(html, fixed);
    console.log(`\n${formatDiff(hunks, file)}`);

    const remaining = auditHtml(fixed);
    if (remaining.valid) {
        console.log('\n✅ All violations fixed.');
    } else {
        console.log(`\n⚠️  ${remaining.violations.length} violation(s) remain (not auto-fixable):`);
        remaining.violations.forEach(v => {
            const src = v.source === 'inline-style' ? `<${v.element}> inline` : '<style>';
            console.log(`  • [${src}, line ${v.line}] ${v.message}`);
        });
        process.exit(1);
    }
}

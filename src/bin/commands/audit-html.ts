import { readFileSync } from 'fs';
import { dirname } from 'path';
import { auditHtml, fixHtml } from '../../core/audit-html.js';
import type { GuardrailOptions } from '../../core/guardrails.js';
import { createBackup, computeDiff, formatDiff, writeFixed, parseFixArgs } from '../../core/backup.js';
import { resolveGuardrailOptions } from '../../core/guardrail-config.js';
import { createJsonOutput, printJson } from '../../core/json-output.js';

export function runAuditHtml(args: string[]): void {
    const { fix, noBackup, file } = parseFixArgs(args);
    const allowTokenDefs = args.includes('--allow-token-definitions');
    const json = args.includes('--json');
    if (!file) {
        console.error('Usage: valentino audit-html <path-to-html-file> [--fix] [--no-backup] [--allow-token-definitions] [--json]');
        process.exit(1);
    }
    const html = readFileSync(file, 'utf-8');
    const opts: GuardrailOptions | undefined = resolveGuardrailOptions(allowTokenDefs, dirname(file));
    const result = auditHtml(html, opts);

    if (json) {
        const passed = result.valid;
        printJson(createJsonOutput({
            tool: 'audit-html',
            file,
            passed,
            exitCode: passed ? 0 : 1,
            sections: [{
                name: 'HTML Audit',
                status: passed ? 'pass' : 'fail',
                violations: result.violations,
                warnings: [],
            }],
            summary: passed
                ? `No violations in ${result.styleTagCount} <style> tag(s), ${result.inlineStyleCount} inline style(s)`
                : `${result.violations.length} violation(s) in ${result.styleTagCount} <style> tag(s), ${result.inlineStyleCount} inline style(s)`,
        }));
        if (!passed) process.exit(1);
        return;
    }

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

    const remaining = auditHtml(fixed, opts);
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

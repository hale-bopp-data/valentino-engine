import { readFileSync } from 'fs';
import { auditHtml } from '../../core/audit-html.js';

export function runAuditHtml(args: string[]): void {
    const file = args[0];
    if (!file) {
        console.error('Usage: valentino audit-html <path-to-html-file>');
        process.exit(1);
    }
    const html = readFileSync(file, 'utf-8');
    const result = auditHtml(html);
    console.log(`Scanned: ${result.styleTagCount} <style> tag(s), ${result.inlineStyleCount} inline style(s)\n`);
    if (result.valid) {
        console.log('✅ No guardrail violations found.');
    } else {
        console.log(`❌ ${result.violations.length} violation(s) found:\n`);
        result.violations.forEach(v => {
            const src = v.source === 'inline-style' ? `<${v.element}> inline` : '<style>';
            console.log(`  • [${src}, line ${v.line}] ${v.message}`);
        });
        process.exit(1);
    }
}

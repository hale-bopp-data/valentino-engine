import { readFileSync } from 'fs';
import { certifySecurity, certifySecurityCss, formatCertification } from '../../core/certify-security.js';
import { createJsonOutput, printJson } from '../../core/json-output.js';

export function runCertify(args: string[]): void {
    const subcommand = args[0];
    if (subcommand !== '--security') {
        console.error('Usage: valentino certify --security <file.html|file.css> [--json]');
        console.error('       Audits: inline styles, token overrides, event handlers,');
        console.error('               a11y (missing alt, missing aria-label, heading order, focus management)');
        process.exit(1);
    }

    const file = args.find(a => a !== '--security' && a !== '--json' && !a.startsWith('-'));
    const json = args.includes('--json');
    if (!file) {
        console.error('Usage: valentino certify --security <file.html|file.css> [--json]');
        console.error('       Audits: inline styles, token overrides, event handlers,');
        console.error('               a11y (missing alt, missing aria-label, heading order, focus management)');
        process.exit(1);
    }

    const content = readFileSync(file, 'utf-8');
    const isHtml = file.toLowerCase().endsWith('.html') || file.toLowerCase().endsWith('.htm');
    const cert = isHtml ? certifySecurity(content) : certifySecurityCss(content);

    if (json) {
        const critical = cert.violations.filter(v => v.severity === 'critical');
        const warnings = cert.violations.filter(v => v.severity === 'warning');
        printJson(createJsonOutput({
            tool: 'certify',
            file,
            passed: cert.certified,
            exitCode: cert.certified ? 0 : 1,
            sections: [{
                name: 'Security Certification',
                status: cert.certified ? (warnings.length > 0 ? 'warn' : 'pass') : 'fail',
                violations: critical,
                warnings,
            }],
            summary: cert.certified
                ? `Security certified${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ''}`
                : `Security certification failed: ${critical.length} critical violation(s)`,
        }));
        if (!cert.certified) process.exit(1);
        return;
    }

    console.log(formatCertification(cert, file));

    if (!cert.certified) {
        process.exit(1);
    }
}

import { readFileSync } from 'fs';
import { certifySecurity, certifySecurityCss, formatCertification } from '../../core/certify-security.js';

export function runCertify(args: string[]): void {
    const subcommand = args[0];
    if (subcommand !== '--security') {
        console.error('Usage: valentino certify --security <file.html|file.css>');
        process.exit(1);
    }

    const file = args[1];
    if (!file) {
        console.error('Usage: valentino certify --security <file.html|file.css>');
        process.exit(1);
    }

    const content = readFileSync(file, 'utf-8');
    const isHtml = file.toLowerCase().endsWith('.html') || file.toLowerCase().endsWith('.htm');
    const cert = isHtml ? certifySecurity(content) : certifySecurityCss(content);

    console.log(formatCertification(cert, file));

    if (!cert.certified) {
        process.exit(1);
    }
}

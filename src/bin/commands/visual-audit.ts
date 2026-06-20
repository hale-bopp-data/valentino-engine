import { readFileSync } from 'fs';
import { runVisualAudit, formatVisualAudit } from '../../core/visual-audit.js';

export async function runVisualAuditCmd(args: string[]): Promise<void> {
    const file = args.find(a => !a.startsWith('-'));
    if (!file) {
        console.error('Usage: valentino visual-audit <file.html>');
        process.exit(1);
    }

    const html = readFileSync(file, 'utf-8');
    const result = await runVisualAudit(html);
    console.log(formatVisualAudit(result, file));

    if (!result.passed) process.exit(1);
}

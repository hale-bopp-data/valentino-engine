import { readFileSync } from 'fs';
import { runVisualAudit, runResponsiveAudit, formatVisualAudit, formatResponsiveAudit, EXIT_CODES } from '../../core/visual-audit.js';

function isUrl(input: string): boolean {
    return /^https?:\/\//i.test(input);
}

export async function runVisualAuditCmd(args: string[]): Promise<void> {
    const source = args.find(a => !a.startsWith('-'));
    const responsive = args.includes('--responsive');
    const json = args.includes('--json');

    if (!source) {
        console.error('Usage: valentino visual-audit <file.html|URL> [--responsive] [--json]');
        process.exit(EXIT_CODES.TOOL_ERROR);
    }

    try {
        const htmlOrUrl = isUrl(source) ? source : readFileSync(source, 'utf-8');

        if (responsive) {
            const result = await runResponsiveAudit(htmlOrUrl);
            if (json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(formatResponsiveAudit(result, source));
            }
            if (!result.viewports[0]?.available) process.exit(EXIT_CODES.NO_BROWSER);
            if (!result.passed) process.exit(EXIT_CODES.VIOLATIONS);
        } else {
            const result = await runVisualAudit(htmlOrUrl);
            if (json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(formatVisualAudit(result, source));
            }
            if (!result.available) process.exit(EXIT_CODES.NO_BROWSER);
            if (!result.passed) process.exit(EXIT_CODES.VIOLATIONS);
        }
    } catch (err) {
        console.error(`Visual audit error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(EXIT_CODES.TOOL_ERROR);
    }
}

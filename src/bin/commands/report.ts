import { dirname } from 'path';
import { generateReport, formatReport } from '../../core/report.js';
import { loadTokenConfig } from '../../core/guardrail-config.js';

export function runReport(args: string[]): void {
    const file = args.find(a => !a.startsWith('-'));
    const json = args.includes('--json');
    const allowTokenDefs = args.includes('--allow-token-definitions');

    if (!file) {
        console.error('Usage: valentino report <file.css|file.html> [--json] [--allow-token-definitions]');
        process.exit(2);
    }

    try {
        const config = allowTokenDefs ? loadTokenConfig(dirname(file)) : undefined;
        const report = generateReport(file, {
            allowTokenDefinitions: allowTokenDefs,
            allowedTokenPrefixes: config?.allowedTokenPrefixes,
        });

        if (json) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(formatReport(report));
        }

        if (!report.passed) process.exit(1);
    } catch (err) {
        console.error(`Report error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(2);
    }
}

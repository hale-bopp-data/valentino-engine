import { readFileSync } from 'fs';
import { suggestFixes, formatPatch, formatTable, suggestFixToJson } from '../../core/suggest-fix.js';

export function runSuggestFix(args: string[]): void {
    const file = args.find(a => !a.startsWith('-'));
    const formatArg = args.find(a => a.startsWith('--format'))?.split('=')[1]
        || (args.includes('--format') ? args[args.indexOf('--format') + 1] : undefined);
    const format = formatArg || 'table';
    const json = args.includes('--json');

    if (!file) {
        console.error('Usage: valentino suggest-fix <file> [--format patch|table|json] [--json]');
        process.exit(2);
    }

    try {
        const content = readFileSync(file, 'utf-8');
        const result = suggestFixes(content, file);

        if (json || format === 'json') {
            console.log(JSON.stringify(suggestFixToJson(result), null, 2));
        } else if (format === 'patch') {
            console.log(formatPatch(result));
        } else {
            console.log(formatTable(result));
        }

        if (!result.passed) process.exit(1);
    } catch (err) {
        console.error(`suggest-fix error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(2);
    }
}

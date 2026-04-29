import { readFileSync } from 'fs';
import { figmaToPageSpec, fetchFigmaFile } from '../../core/figma-import.js';

export function runFigmaImport(args: string[]): void {
    const fileKeyIdx = args.indexOf('--file-key');
    const tokenIdx = args.indexOf('--figma-token');
    const fileIdx = args.indexOf('--file');
    const templateIdx = args.indexOf('--template');
    const outputIdx = args.indexOf('--output');

    const fileKey = fileKeyIdx >= 0 ? args[fileKeyIdx + 1] : undefined;
    const token = tokenIdx >= 0 ? args[tokenIdx + 1] : undefined;
    const filePath = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
    const template = templateIdx >= 0 ? args[templateIdx + 1] : undefined;
    const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

    if (!fileKey && !filePath) {
        console.error('Usage: valentino figma import --file <figma.json> OR --file-key <key> --figma-token <token> [--template corporate] [--output page.json]');
        process.exit(1);
    }

    async function run() {
        try {
            let result;

            if (filePath) {
                const raw = readFileSync(filePath, 'utf-8');
                const doc = JSON.parse(raw);
                result = figmaToPageSpec(doc, { template });
            } else if (fileKey && token) {
                const doc = await fetchFigmaFile(fileKey, token);
                result = figmaToPageSpec(doc, { template });
            } else {
                console.error('Error: provide --file or (--file-key + --figma-token)');
                process.exit(1);
                return;
            }

            if (outputPath) {
                const fs = await import('fs');
                fs.writeFileSync(outputPath, JSON.stringify(result.pageSpec, null, 2));
                console.log(`PageSpec written to ${outputPath}`);
            }

            console.log(JSON.stringify({
                stats: result.stats,
                warnings: result.warnings,
                sections: result.pageSpec.sections.map(s => ({ type: s.type, titleKey: (s as any).titleKey })),
            }, null, 2));
        } catch (e) {
            console.error('Figma import failed:', e);
            process.exit(1);
        }
    }

    run();
}

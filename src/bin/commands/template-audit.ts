import { readFileSync } from 'fs';
import {
  detectTemplateEngine, auditTemplateExpressions,
  formatTemplateAudit, SUPPORTED_ENGINES,
} from '../../core/template-engine.js';
import type { TemplateEngine } from '../../core/template-engine.js';

export function runTemplateAudit(args: string[]): void {
    let file: string | undefined;
    let engine: TemplateEngine | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--template' && args[i + 1]) {
            const val = args[i + 1].toLowerCase();
            if (SUPPORTED_ENGINES.includes(val as TemplateEngine)) {
                engine = val as TemplateEngine;
                i++;
            } else {
                console.error(`Unknown template engine: ${val}. Supported: ${SUPPORTED_ENGINES.join(', ')}`);
                process.exit(1);
            }
        } else if (!args[i].startsWith('-')) {
            file = file ?? args[i];
        }
    }

    if (!file) {
        console.error('Usage: valentino template-audit <file> [--template jinja2|twig|ejs]');
        process.exit(1);
    }

    const content = readFileSync(file, 'utf-8');

    if (!engine) {
        engine = detectTemplateEngine(content) ?? undefined;
        if (!engine) {
            console.log('No template engine syntax detected.');
            return;
        }
        console.log(`Auto-detected: ${engine}`);
    }

    const result = auditTemplateExpressions(content, engine);
    console.log(formatTemplateAudit(result, file));

    if (result.warnings.length > 0) process.exit(1);
}

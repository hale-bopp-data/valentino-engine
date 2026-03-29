/**
 * CLI command: valentino cockpit
 * Interactive cockpit for page spec manipulation.
 *
 * Usage:
 *   valentino cockpit <spec.json>                     Interactive REPL (Phase 1)
 *   valentino cockpit <spec.json> <action.json>       Execute action on spec
 *   valentino cockpit <spec.json> --describe          Describe page structure
 *   valentino cockpit <spec.json> --validate          Validate page spec
 *   valentino cockpit <spec.json> --parse "text"      Parse intent (dry run)
 *   valentino cockpit --schema page                   Print PageSpecV1 JSON Schema
 *   valentino cockpit --schema action                 Print CockpitAction JSON Schema
 *   valentino cockpit --schema section <type>         Print section JSON Schema
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { PageSpecV1 } from '../../core/types.js';
import type { CockpitAction } from '../../core/cockpit-api.js';
import {
    executeCockpitAction,
    validateCockpitAction,
    describeCockpitAction,
} from '../../core/cockpit-api.js';
import {
    getPageSpecSchema,
    getCockpitActionSchema,
    getSectionSchema,
    getSchemaDefinedSectionTypes,
} from '../../core/schema-export.js';
import { parseIntentLocal } from '../../core/intent-parser.js';
import { startRepl } from '../../core/cockpit-repl.js';
import { startCockpitServer } from '../../cockpit-server.js';

function loadJSON<T>(filePath: string): T | null {
    if (!existsSync(filePath)) return null;
    try { return JSON.parse(readFileSync(filePath, 'utf-8')); } catch { return null; }
}

export async function runCockpit(args: string[]): Promise<void> {
    // Schema mode
    if (args.includes('--schema')) {
        const schemaIdx = args.indexOf('--schema');
        const schemaType = args[schemaIdx + 1];

        switch (schemaType) {
            case 'page':
                console.log(JSON.stringify(getPageSpecSchema(), null, 2));
                return;
            case 'action':
                console.log(JSON.stringify(getCockpitActionSchema(), null, 2));
                return;
            case 'section': {
                const sectionType = args[schemaIdx + 2];
                if (!sectionType) {
                    console.log('Available section types:', getSchemaDefinedSectionTypes().join(', '));
                    return;
                }
                const schema = getSectionSchema(sectionType);
                if (!schema) {
                    console.error(`Unknown section type: ${sectionType}`);
                    console.log('Available:', getSchemaDefinedSectionTypes().join(', '));
                    process.exit(1);
                }
                console.log(JSON.stringify(schema, null, 2));
                return;
            }
            default:
                console.error('Usage: valentino cockpit --schema <page|action|section [type]>');
                process.exit(1);
        }
    }

    // Need a spec file for all other operations
    const files = args.filter(a => !a.startsWith('-'));
    if (!files.length) {
        console.log(`
  valentino cockpit — Conversational Cockpit for page spec manipulation

  Usage:
    valentino cockpit <spec.json>                     Interactive REPL
    valentino cockpit <spec.json> --serve [--port N]  Web cockpit (default: 3781)
    valentino cockpit <spec.json> <action.json>       Execute action on spec
    valentino cockpit <spec.json> --describe          Describe page structure
    valentino cockpit <spec.json> --validate          Validate page spec
    valentino cockpit <spec.json> --parse "text"      Parse intent (dry run)
    valentino cockpit --schema page                   Print PageSpecV1 JSON Schema
    valentino cockpit --schema action                 Print CockpitAction JSON Schema
    valentino cockpit --schema section <type>         Print section JSON Schema
`);
        return;
    }

    const specPath = resolve(files[0]);
    const spec = loadJSON<PageSpecV1>(specPath);
    if (!spec) {
        console.error(`Cannot read spec: ${specPath}`);
        process.exit(1);
    }

    // Describe mode
    if (args.includes('--describe')) {
        const result = executeCockpitAction(spec, {
            action: 'query',
            query: { type: 'describe-page' },
        });
        console.log(JSON.stringify(result.data, null, 2));
        return;
    }

    // Validate mode
    if (args.includes('--validate')) {
        const result = executeCockpitAction(spec, {
            action: 'query',
            query: { type: 'validate' },
        });
        if (result.warnings.length === 0) {
            console.log('  ✅ Page spec is valid');
        } else {
            for (const w of result.warnings) {
                console.log(`  ⚠  [${w.source}] ${w.message}`);
            }
        }
        return;
    }

    // Serve mode: start web cockpit server
    if (args.includes('--serve')) {
        const portIdx = args.indexOf('--port');
        const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : undefined;
        startCockpitServer({ specPath, port });
        return;
    }

    // Parse mode: dry-run intent parsing
    if (args.includes('--parse')) {
        const parseIdx = args.indexOf('--parse');
        const text = args[parseIdx + 1];
        if (!text) {
            console.error('Usage: valentino cockpit <spec.json> --parse "your request"');
            process.exit(1);
        }
        const result = parseIntentLocal(text, spec);
        if (result.intent) {
            console.log(`  Intent: ${result.intent.description}`);
            console.log(`  Confidence: ${result.intent.confidence}`);
            console.log(`  Action: ${JSON.stringify(result.intent.action, null, 2)}`);
        } else {
            console.log('  Could not parse intent from input.');
        }
        return;
    }

    // Interactive REPL mode: only spec file, no action file, no flags
    if (files.length === 1 && !args.some(a => a.startsWith('--'))) {
        const { writeFileSync: writeFs } = await import('fs');
        const savedPath = specPath;
        await startRepl({
            spec,
            onSpecChange: (updatedSpec) => {
                writeFs(savedPath, JSON.stringify(updatedSpec, null, 2) + '\n');
                console.log(`  Saved to ${savedPath}`);
            },
        });
        return;
    }

    // Action mode: need action file
    if (files.length < 2) {
        console.error('Usage: valentino cockpit <spec.json> <action.json>');
        process.exit(1);
    }

    const actionPath = resolve(files[1]);
    const action = loadJSON<CockpitAction>(actionPath);
    if (!action) {
        console.error(`Cannot read action: ${actionPath}`);
        process.exit(1);
    }

    // Pre-flight validation
    const preErrors = validateCockpitAction(action, spec);
    if (preErrors.length > 0) {
        console.error('  ❌ Action validation failed:');
        for (const e of preErrors) {
            console.error(`     ${e}`);
        }
        process.exit(1);
    }

    // Show what will happen
    console.log(`  → ${describeCockpitAction(action)}`);

    // Execute
    const result = executeCockpitAction(spec, action);

    // Show warnings
    for (const w of result.warnings) {
        const icon = w.source === 'validation' ? '❌' : '⚠ ';
        console.log(`  ${icon} [${w.source}] ${w.message}`);
    }

    if (result.success) {
        // Write output
        const outPath = args.includes('--out')
            ? resolve(args[args.indexOf('--out') + 1])
            : specPath;

        if (args.includes('--out') || args.includes('--in-place')) {
            writeFileSync(outPath, JSON.stringify(result.spec, null, 2) + '\n');
            console.log(`  ✅ Written to ${outPath}`);
        } else {
            // Dry run — print to stdout
            console.log(JSON.stringify(result.spec, null, 2));
        }
    } else {
        console.error('  ❌ Action failed');
        process.exit(1);
    }

    // Query data
    if (result.data) {
        console.log(JSON.stringify(result.data, null, 2));
    }
}

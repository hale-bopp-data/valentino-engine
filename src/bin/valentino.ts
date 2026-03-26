#!/usr/bin/env node
/**
 * Valentino CLI — command router
 * `npx @hale-bopp/valentino <command> [args]`
 */

import { runAudit } from './commands/audit.js';
import { runValidate } from './commands/validate.js';
import { runGuardrails } from './commands/guardrails.js';
import { runProbe } from './commands/probe.js';
import { runCatalogResolve } from './commands/catalog.js';
import { runManifestResolve } from './commands/manifest.js';
import { runContrast } from './commands/contrast.js';
import { runInit } from './commands/init.js';
import { runLlms } from './commands/llms.js';

const [,, command, ...args] = process.argv;

switch (command) {
    case 'init':
        runInit(args);
        break;

    case 'audit':
        runAudit(args);
        break;

    case 'validate':
        runValidate(args);
        break;

    case 'guardrails':
        runGuardrails();
        break;

    case 'probe':
        runProbe(args[0] || 'all', args.slice(1));
        break;

    case 'catalog':
        if (args[0] === 'resolve') runCatalogResolve(args.slice(1));
        else {
            console.error('Usage: valentino catalog resolve <spec.json> --catalog <catalog.json>');
            process.exit(1);
        }
        break;

    case 'manifest':
        if (args[0] === 'resolve') runManifestResolve(args.slice(1));
        else {
            console.error('Usage: valentino manifest resolve <manifest.json> --route /path');
            process.exit(1);
        }
        break;

    case 'contrast':
        runContrast(args);
        break;

    case 'llms':
        runLlms(args);
        break;

    default:
        console.log(`
🎨 Valentino Engine v0.1.0 — Antifragile Open Source UI Design Engine

Usage:
  valentino init [name] [--template id] [--lang code] [--git url]  Create a new project
  valentino audit <file.css>                                    Audit CSS for guardrail violations
  valentino validate <spec.json>                                Validate a Runtime PageSpec JSON (V1)
  valentino guardrails                                          List all 10 Sovereign Guardrails
  valentino probe <rhythm|hero|integrity|all> <spec.json>       Run validation probes
  valentino contrast <foreground> <background> [AA|AAA]         Check WCAG contrast ratio
  valentino catalog resolve <spec.json> --catalog <catalog.json> Resolve spec with catalog
  valentino manifest resolve <manifest.json> --route /path      Resolve route to page ID
  valentino llms <manifest.json> [--content c.json] [--site N]  Generate llms.txt + llms-full.txt

Epic: https://dev.azure.com/EasyWayData/EasyWay-DataPortal/_workitems/edit/480
`);
}

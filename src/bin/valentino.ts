#!/usr/bin/env node
/**
 * Valentino CLI — command router
 * `npx @hale-bopp/valentino <command> [args]`
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

import { runAudit } from './commands/audit.js';
import { runValidate } from './commands/validate.js';
import { runGuardrails } from './commands/guardrails.js';
import { runProbe } from './commands/probe.js';
import { runCatalogResolve } from './commands/catalog.js';
import { runManifestResolve } from './commands/manifest.js';
import { runContrast } from './commands/contrast.js';
import { runInit } from './commands/init.js';
import { runLlms } from './commands/llms.js';
import { runCockpit } from './commands/cockpit.js';
import { runThemeAudit } from './commands/theme-audit.js';
import { runSpool } from './commands/spool.js';
import { runFigmaImport } from './commands/figma.js';
import { runImageGenerate } from './commands/image.js';
import { runAuditHtml } from './commands/audit-html.js';
import { runValidateTokens } from './commands/validate-tokens.js';
import { runRefactor } from './commands/refactor.js';
import { runCertify } from './commands/certify.js';
import { runVisualAuditCmd } from './commands/visual-audit.js';
import { runReport } from './commands/report.js';
import { runWatch } from './commands/watch.js';
import { runGridContract } from './commands/grid-contract.js';
import { runLayoutContract } from './commands/layout-contract.js';
import { runTemplateAudit } from './commands/template-audit.js';
import { runReviewNotes } from './commands/review-notes.js';
import { runAuditDomCmd } from './commands/audit-dom.js';
import { runSuggestFix } from './commands/suggest-fix.js';
import { runFullAudit } from './commands/full-audit.js';

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

    case 'cockpit':
        runCockpit(args);
        break;

    case 'theme-audit':
        runThemeAudit(args);
        break;

    case 'spool':
        runSpool(args);
        break;

    case 'figma':
        if (args[0] === 'import') runFigmaImport(args.slice(1));
        else {
            console.error('Usage: valentino figma import --file <figma.json> [options]');
            process.exit(1);
        }
        break;

    case 'image':
        if (args[0] === 'generate') runImageGenerate(args.slice(1));
        else {
            console.error('Usage: valentino image generate --prompt "..." [--endpoint url] [options]');
            process.exit(1);
        }
        break;

    case 'audit-html':
        runAuditHtml(args);
        break;

    case 'validate-tokens':
        runValidateTokens(args);
        break;

    case 'refactor':
        runRefactor(args).catch(e => { console.error(e); process.exit(1); });
        break;

    case 'certify':
        runCertify(args);
        break;

    case 'visual-audit':
        runVisualAuditCmd(args).catch(e => { console.error(e); process.exit(1); });
        break;

    case 'report':
        runReport(args);
        break;

    case 'watch':
        runWatch(args);
        break;

    case 'grid-contract':
        runGridContract(args).catch(e => { console.error(e); process.exit(1); });
        break;

    case 'layout-contract':
        runLayoutContract(args).catch(e => { console.error(e); process.exit(1); });
        break;

    case 'template-audit':
        runTemplateAudit(args);
        break;

    case 'review-notes':
        runReviewNotes(args);
        break;

    case 'audit-dom':
        runAuditDomCmd(args).catch(e => { console.error(e); process.exit(1); });
        break;

    case 'suggest-fix':
        runSuggestFix(args);
        break;

    case 'full-audit':
        runFullAudit(args).catch(e => { console.error(e); process.exit(1); });
        break;

    case 'mcp':
        import('../mcp/index.js').catch(e => { console.error('MCP server failed:', e); process.exit(1); });
        break;

    default:
        console.log(`
🎨 Valentino Engine v${version} — Antifragile Open Source UI Design Engine

Usage:
  valentino init [name] [--template id] [--lang code] [--git url]  Create a new project
  valentino audit <file.css> [--allow-token-definitions]            Audit CSS for guardrail violations
  valentino audit <file.css> --fix [--no-backup]                    Auto-fix + backup original
  valentino validate <spec.json>                                    Validate a Runtime PageSpec JSON (V1)
  valentino guardrails                                              List all 10 Sovereign Guardrails
  valentino probe <rhythm|hero|integrity|all> <spec.json>           Run validation probes
  valentino contrast <foreground> <background> [AA|AAA]             Check WCAG contrast ratio
  valentino catalog resolve <spec.json> --catalog <catalog.json>    Resolve spec with catalog
  valentino manifest resolve <manifest.json> --route /path          Resolve route to page ID
  valentino llms <manifest.json> [--content c.json] [--site N]  Generate llms.txt + llms-full.txt
  valentino cockpit <spec.json>                                Interactive conversational REPL
  valentino cockpit <spec.json> --serve [--port N]             Web cockpit (browser UI)
  valentino cockpit <spec.json> <action.json>                  Execute cockpit action on page spec
  valentino cockpit <spec.json> --parse "text"                 Parse intent (dry run)
  valentino cockpit --schema <page|action|section [type]>      Print JSON Schema
  valentino theme-audit <pack.json> [--registry r.json] [--level AA|AAA]  Audit theme-pack contrast on surfaces
  valentino spool <directory> [--out <file>]                          Analyze site CSS → Valentino tokens
  valentino figma import --file <figma.json> [--template id]           Import Figma file → PageSpec
  valentino image generate --prompt "desc" [--endpoint url] [options]  Generate image (placeholder or external)
  valentino audit-html <file.html> [--allow-token-definitions]                Audit HTML for CSS violations (inline + <style>)
  valentino audit-html <file.html> --fix [--no-backup]                       Auto-fix + backup original
  valentino validate-tokens <file.css>                              Detect self-referencing/circular CSS tokens
  valentino validate-tokens <file.css> --fix [--no-backup]           Auto-fix self-refs + backup original
  valentino refactor <file> [--dry-run] [--apply] [--no-backup]      Preview + apply refactor with self-ref guard
  valentino certify --security <file.html|file.css>                  Security audit: inline styles, token overrides, event handlers
  valentino report <file.css|file.html> [--json] [--allow-token-definitions]  Unified report: audit + tokens + security
  valentino visual-audit <file.html|URL> [--responsive] [--json]             Visual audit via Playwright (overflow, collision, contrast)
  valentino watch <file|directory>                                   Watch for changes and auto-audit
  valentino grid-contract init <file.html> [--selector s] [--out f]  Generate grid layout contract from DOM
  valentino grid-contract verify <file.html> --contract <file.json>  Verify DOM matches grid contract
  valentino layout-contract init <file.html|URL> [--out f]           Generate region layout contract (header/sidebar/main/footer)
  valentino layout-contract verify <file.html|URL> --contract <f>    Verify regions: no overlap, no cover, in-viewport, z-order
  valentino template-audit <file> [--template jinja2|twig|ejs]       Detect template/CSS conflicts (auto-detect engine)
  valentino review-notes new <name> [--mode full] [--out file.json]  Create review session
  valentino review-notes add <session.json> "comment" [--severity]   Add note to session
  valentino review-notes export <session.json> [--out file.md]       Export session to markdown
  valentino review-notes stats <session.json>                        Session statistics
  valentino review-notes from-audit <audit.json> [--out file.json]   Seed review session from a visual-audit JSON (#3089)
  valentino audit-dom <url> [--json] [--responsive]                  Runtime DOM audit via Playwright (inline styles, overflow, 404, a11y)
  valentino full-audit <url> [--responsive] [--json]             Unified audit: audit-dom + visual-audit
  valentino full-audit --dir <dir> [--json]                      Unified audit: audit-html + certify + probe
  valentino full-audit <file.html|file.css|file.json> [--json]   Unified static audit on single file
  valentino suggest-fix <file> [--format patch|table|json] [--json]  Suggest fixes without modifying (inline→class, px→rem, color→token)
  valentino mcp                                                      Start MCP server (stdio, 24 tools)

GitHub: https://github.com/hale-bopp-data/valentino-engine
`);
}

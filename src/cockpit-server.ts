/**
 * Cockpit Server — HTTP API + Web UI for the Valentino Conversational Cockpit.
 * Feature #778 (Il Sarto Parla), PBI #781 (Phase 2).
 *
 * Wraps cockpit-api over HTTP. Serves a built-in web UI.
 * Zero external dependencies — uses Node built-in http module.
 *
 * Usage:
 *   npx tsx src/cockpit-server.ts <spec.json> [--port 3781]
 *   valentino cockpit <spec.json> --serve [--port 3781]
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { PageSpecV1 } from './core/types.js';
import type { CockpitAction } from './core/cockpit-api.js';
import {
    executeCockpitAction,
    validateCockpitAction,
    describeCockpitAction,
} from './core/cockpit-api.js';
import { parseIntentLocal } from './core/intent-parser.js';
import { getPageSpecSchema, getCockpitActionSchema, getAllSectionSchemas } from './core/schema-export.js';

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

type ServerState = {
    spec: PageSpecV1;
    specPath: string;
    history: PageSpecV1[];
    actionCount: number;
};

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}

function json(res: ServerResponse, data: unknown, status = 200): void {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

function cors(res: ServerResponse): void {
    res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

function handleApi(req: IncomingMessage, res: ServerResponse, state: ServerState): void {
    const url = new URL(req.url || '/', `http://localhost`);
    const path = url.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') {
        cors(res);
        return;
    }

    // GET /api/spec — current spec
    if (path === '/api/spec' && req.method === 'GET') {
        json(res, {
            spec: state.spec,
            actionCount: state.actionCount,
            undoAvailable: state.history.length,
        });
        return;
    }

    // GET /api/schema — JSON schemas for LLM context
    if (path === '/api/schema' && req.method === 'GET') {
        json(res, {
            pageSpec: getPageSpecSchema(),
            cockpitAction: getCockpitActionSchema(),
            sections: getAllSectionSchemas(),
        });
        return;
    }

    // POST /api/parse — parse natural language
    if (path === '/api/parse' && req.method === 'POST') {
        readBody(req).then(body => {
            const { text } = JSON.parse(body);
            if (!text) {
                json(res, { error: 'Missing "text" field' }, 400);
                return;
            }
            const result = parseIntentLocal(text, state.spec);
            json(res, result);
        }).catch(() => json(res, { error: 'Invalid JSON body' }, 400));
        return;
    }

    // POST /api/action — execute cockpit action
    if (path === '/api/action' && req.method === 'POST') {
        readBody(req).then(body => {
            const action = JSON.parse(body) as CockpitAction;

            const preErrors = validateCockpitAction(action, state.spec);
            if (preErrors.length > 0) {
                json(res, { success: false, errors: preErrors }, 400);
                return;
            }

            // Save undo point for mutations
            if (action.action !== 'query') {
                state.history.push(structuredClone(state.spec));
            }

            const result = executeCockpitAction(state.spec, action);

            if (result.success && action.action !== 'query') {
                state.spec = result.spec;
                state.actionCount++;
            }

            json(res, {
                ...result,
                description: describeCockpitAction(action),
                actionCount: state.actionCount,
                undoAvailable: state.history.length,
            });
        }).catch(() => json(res, { error: 'Invalid JSON body' }, 400));
        return;
    }

    // POST /api/speak — natural language → parse + execute
    if (path === '/api/speak' && req.method === 'POST') {
        readBody(req).then(body => {
            const { text } = JSON.parse(body);
            if (!text) {
                json(res, { error: 'Missing "text" field' }, 400);
                return;
            }

            const parseResult = parseIntentLocal(text, state.spec);
            if (!parseResult.intent) {
                json(res, {
                    success: false,
                    parsed: false,
                    message: 'Could not parse intent',
                    raw: text,
                });
                return;
            }

            const { action, confidence, description } = parseResult.intent;

            const preErrors = validateCockpitAction(action, state.spec);
            if (preErrors.length > 0) {
                json(res, { success: false, parsed: true, description, errors: preErrors });
                return;
            }

            if (action.action !== 'query') {
                state.history.push(structuredClone(state.spec));
            }

            const result = executeCockpitAction(state.spec, action);

            if (result.success && action.action !== 'query') {
                state.spec = result.spec;
                state.actionCount++;
            }

            json(res, {
                ...result,
                parsed: true,
                description,
                confidence,
                actionCount: state.actionCount,
                undoAvailable: state.history.length,
            });
        }).catch(() => json(res, { error: 'Invalid JSON body' }, 400));
        return;
    }

    // POST /api/undo
    if (path === '/api/undo' && req.method === 'POST') {
        if (state.history.length === 0) {
            json(res, { success: false, message: 'Nothing to undo' });
            return;
        }
        state.spec = state.history.pop()!;
        json(res, { success: true, spec: state.spec, undoAvailable: state.history.length });
        return;
    }

    // POST /api/save — persist to disk
    if (path === '/api/save' && req.method === 'POST') {
        try {
            writeFileSync(state.specPath, JSON.stringify(state.spec, null, 2) + '\n');
            json(res, { success: true, path: state.specPath });
        } catch (err) {
            json(res, { success: false, error: String(err) }, 500);
        }
        return;
    }

    json(res, { error: 'Not found' }, 404);
}

// ---------------------------------------------------------------------------
// Static file serving (built-in web UI)
// ---------------------------------------------------------------------------

function getWebUiPath(): string {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    return join(thisDir, 'cockpit-web', 'index.html');
}

function serveStatic(res: ServerResponse): void {
    const uiPath = getWebUiPath();
    if (!existsSync(uiPath)) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Web UI not found: ' + uiPath);
        return;
    }
    const html = readFileSync(uiPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

// ---------------------------------------------------------------------------
// Server entry point
// ---------------------------------------------------------------------------

export type CockpitServerOptions = {
    specPath: string;
    port?: number;
};

export function startCockpitServer(options: CockpitServerOptions): void {
    const port = options.port || 3781;
    const specPath = resolve(options.specPath);

    if (!existsSync(specPath)) {
        console.error(`File not found: ${specPath}`);
        process.exit(1);
    }

    const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as PageSpecV1;
    const state: ServerState = {
        spec,
        specPath,
        history: [],
        actionCount: 0,
    };

    const server = createServer((req, res) => {
        const url = req.url || '/';
        if (url.startsWith('/api/')) {
            handleApi(req, res, state);
        } else {
            serveStatic(res);
        }
    });

    server.listen(port, () => {
        console.log(`\n  \uD83C\uDFA8 Valentino Cockpit — Il Sarto Parla`);
        console.log(`  Page: ${spec.id} (${spec.sections.length} sections)`);
        console.log(`  Server: http://localhost:${port}`);
        console.log(`  API:    http://localhost:${port}/api/spec`);
        console.log(`\n  Open the URL in your browser to start.\n`);
    });
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && (process.argv[1].endsWith('cockpit-server.ts') || process.argv[1].endsWith('cockpit-server.js'))) {
    const args = process.argv.slice(2);
    const specPath = args.find(a => !a.startsWith('-'));
    const portFlag = args.indexOf('--port');
    const port = portFlag !== -1 ? parseInt(args[portFlag + 1], 10) : undefined;

    if (!specPath) {
        console.error('Usage: cockpit-server <spec.json> [--port 3781]');
        process.exit(1);
    }

    startCockpitServer({ specPath, port });
}

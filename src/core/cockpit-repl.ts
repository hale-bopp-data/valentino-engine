/**
 * Cockpit REPL — Interactive conversational loop for operators.
 * Feature #778 (Il Sarto Parla), PBI #780 (Phase 1).
 *
 * Reads operator input, parses intent, executes action, shows results.
 * Uses Node readline for terminal I/O.
 */

import { createInterface } from 'readline';
import type { PageSpecV1 } from './types.js';
import { parseIntentLocal } from './intent-parser.js';
import type { IntentLlmCallback } from './intent-parser.js';
import {
    executeCockpitAction,
    validateCockpitAction,
    describeCockpitAction,
} from './cockpit-api.js';
import type { CockpitActionResult, CockpitWarning } from './cockpit-api.js';
import { parseIntent } from './intent-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReplOptions = {
    /** Initial page spec to work with */
    spec: PageSpecV1;
    /** Optional LLM callback for smarter intent parsing */
    llm?: IntentLlmCallback;
    /** Optional callback when spec changes (e.g., auto-save) */
    onSpecChange?: (spec: PageSpecV1) => void;
    /** Custom prompt string (default: "valentino> ") */
    prompt?: string;
    /** Output stream (default: process.stdout) */
    output?: NodeJS.WritableStream;
    /** Input stream (default: process.stdin) */
    input?: NodeJS.ReadableStream;
};

export type ReplSession = {
    /** Current page spec */
    spec: PageSpecV1;
    /** Action history for undo */
    history: PageSpecV1[];
    /** Number of actions executed */
    actionCount: number;
};

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatWarnings(warnings: CockpitWarning[]): string {
    if (warnings.length === 0) return '';
    return warnings.map(w => {
        const icon = w.source === 'validation' ? '  \u274C' : '  \u26A0 ';
        return `${icon} [${w.source}] ${w.message}`;
    }).join('\n');
}

function formatQueryData(data: unknown): string {
    if (data === null || data === undefined) return '';
    if (Array.isArray(data)) {
        return data.map((item, i) => {
            if (typeof item === 'object' && item !== null) {
                const parts = Object.entries(item).map(([k, v]) => `${k}: ${v}`);
                return `  ${i}. ${parts.join(', ')}`;
            }
            return `  ${i}. ${item}`;
        }).join('\n');
    }
    if (typeof data === 'object') {
        return Object.entries(data as Record<string, unknown>)
            .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
            .join('\n');
    }
    return String(data);
}

function formatResult(result: CockpitActionResult): string {
    const parts: string[] = [];

    if (result.success) {
        parts.push('  \u2705 Done');
    } else {
        parts.push('  \u274C Failed');
    }

    const warningText = formatWarnings(result.warnings);
    if (warningText) parts.push(warningText);

    if (result.data !== undefined) {
        parts.push(formatQueryData(result.data));
    }

    return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Built-in commands
// ---------------------------------------------------------------------------

const BUILTIN_COMMANDS: Record<string, string> = {
    'help': 'Show available commands',
    'undo': 'Undo last action',
    'history': 'Show action history count',
    'json': 'Print current spec as JSON',
    'save': 'Print spec JSON (pipe to file)',
    'exit': 'Exit the cockpit',
    'quit': 'Exit the cockpit',
};

function showHelp(): string {
    return [
        '',
        '  Valentino Cockpit — Il Sarto Parla',
        '',
        '  Parla in linguaggio naturale (IT/EN):',
        '    "mostrami le sezioni"        \u2192 lista sezioni',
        '    "descrivi la pagina"          \u2192 panoramica pagina',
        '    "valida"                      \u2192 validazione completa',
        '    "aggiungi una sezione stats"  \u2192 aggiunge stats',
        '    "rimuovi la cta"             \u2192 rimuove prima CTA',
        '    "sposta sezione 3 a 1"       \u2192 riordina',
        '    "cambia il titolo dell\'hero in X" \u2192 modifica campo',
        '',
        '  Comandi built-in:',
        ...Object.entries(BUILTIN_COMMANDS).map(([cmd, desc]) => `    ${cmd.padEnd(12)} ${desc}`),
        '',
    ].join('\n');
}

// ---------------------------------------------------------------------------
// REPL engine
// ---------------------------------------------------------------------------

/**
 * Process a single REPL input line.
 * Returns the output text to display.
 * Mutates session in-place (spec, history, actionCount).
 */
export async function processReplInput(
    input: string,
    session: ReplSession,
    llm?: IntentLlmCallback,
): Promise<{ output: string; exit: boolean }> {
    const trimmed = input.trim();

    if (!trimmed) {
        return { output: '', exit: false };
    }

    // Built-in commands
    switch (trimmed.toLowerCase()) {
        case 'help':
        case '?':
            return { output: showHelp(), exit: false };

        case 'exit':
        case 'quit':
        case 'esci':
            return { output: '  Arrivederci.', exit: true };

        case 'undo':
        case 'annulla': {
            if (session.history.length === 0) {
                return { output: '  Nothing to undo.', exit: false };
            }
            session.spec = session.history.pop()!;
            return { output: '  \u2705 Undo successful.', exit: false };
        }

        case 'history':
        case 'cronologia':
            return { output: `  ${session.actionCount} actions executed, ${session.history.length} undoable.`, exit: false };

        case 'json':
        case 'save':
            return { output: JSON.stringify(session.spec, null, 2), exit: false };
    }

    // Parse intent
    const parseResult = await parseIntent(trimmed, session.spec, llm);

    if (!parseResult.intent) {
        return {
            output: '  \u2753 Non ho capito. Prova "help" per vedere i comandi disponibili.',
            exit: false,
        };
    }

    const { action, confidence, description } = parseResult.intent;

    // Show what we understood
    let output = `  \u2192 ${description}`;
    if (confidence === 'low') {
        output += ' (low confidence)';
    }
    if (parseResult.fallbackReason) {
        output += `\n  \u26A0  Fallback: ${parseResult.fallbackReason}`;
    }

    // Pre-flight validation
    const preErrors = validateCockpitAction(action, session.spec);
    if (preErrors.length > 0) {
        output += '\n  \u274C Validation errors:';
        for (const e of preErrors) {
            output += `\n     ${e}`;
        }
        return { output, exit: false };
    }

    // For mutations: save undo point
    if (action.action !== 'query') {
        session.history.push(structuredClone(session.spec));
    }

    // Execute
    const result = executeCockpitAction(session.spec, action);
    output += '\n' + formatResult(result);

    // Update spec
    if (result.success && action.action !== 'query') {
        session.spec = result.spec;
        session.actionCount++;
    }

    return { output, exit: false };
}

/**
 * Start the interactive REPL.
 * This is the main entry point for `valentino cockpit --interactive`.
 */
export async function startRepl(options: ReplOptions): Promise<void> {
    const promptStr = options.prompt || 'valentino> ';
    const output = options.output || process.stdout;

    const session: ReplSession = {
        spec: structuredClone(options.spec),
        history: [],
        actionCount: 0,
    };

    const rl = createInterface({
        input: options.input || process.stdin,
        output: output as NodeJS.WritableStream,
        prompt: promptStr,
    });

    output.write('\n  \uD83C\uDFA8 Valentino Cockpit — Il Sarto Parla\n');
    output.write(`  Page: ${session.spec.id} (${session.spec.sections.length} sections)\n`);
    output.write('  Type "help" for commands, or speak naturally.\n\n');

    rl.prompt();

    rl.on('line', async (line) => {
        const { output: text, exit } = await processReplInput(line, session, options.llm);
        if (text) output.write(text + '\n');

        if (exit) {
            if (options.onSpecChange && session.actionCount > 0) {
                options.onSpecChange(session.spec);
            }
            rl.close();
            return;
        }

        output.write('\n');
        rl.prompt();
    });

    rl.on('close', () => {
        if (options.onSpecChange && session.actionCount > 0) {
            options.onSpecChange(session.spec);
        }
    });
}

/**
 * Create a REPL session without starting I/O.
 * Useful for testing or embedding in other tools.
 */
export function createReplSession(spec: PageSpecV1): ReplSession {
    return {
        spec: structuredClone(spec),
        history: [],
        actionCount: 0,
    };
}

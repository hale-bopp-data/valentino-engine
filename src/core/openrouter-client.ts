/**
 * OpenRouter LLM Client — Minimal HTTP client for intent parsing.
 * Feature #778 (Il Sarto Parla).
 *
 * Zero external dependencies — uses Node built-in fetch (Node 18+).
 * Implements IntentLlmCallback interface for plug-and-play with intent-parser.
 */

import type { IntentLlmCallback, IntentLlmContext } from './intent-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpenRouterConfig = {
    apiKey: string;
    model?: string;
    /** Base URL override (default: https://openrouter.ai/api/v1) */
    baseUrl?: string;
    /** Max tokens for response (default: 1024) */
    maxTokens?: number;
    /** Temperature (default: 0.1 — low for structured output) */
    temperature?: number;
};

type OpenRouterMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

type OpenRouterResponse = {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
        code?: number;
    };
};

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5-20251001';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.1;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the Valentino Cockpit intent parser. Your ONLY job is to convert the operator's natural language request into a structured CockpitAction JSON.

RULES:
- Return ONLY valid JSON, no markdown fences, no explanation, no text before or after
- Use the CockpitAction schema provided in the context
- Section indices are 0-based
- If the request is a question/query, use: { "action": "query", "query": { "type": "..." } }
- If the request is a modification, use the appropriate mutation action
- If ambiguous, prefer a query over a mutation
- If you truly cannot parse the request, return: { "action": "query", "query": { "type": "describe-page" } }

AVAILABLE QUERY TYPES: list-sections, get-section, describe-page, list-section-types, get-editor-schema, validate

AVAILABLE ACTIONS: add-section, edit-section, remove-section, move-section, edit-page, query`;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Call OpenRouter chat completion API.
 */
async function callOpenRouter(
    config: OpenRouterConfig,
    messages: OpenRouterMessage[],
): Promise<string> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const url = `${baseUrl}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            'HTTP-Referer': 'https://valentino-engine.dev',
            'X-Title': 'Valentino Cockpit',
        },
        body: JSON.stringify({
            model: config.model || DEFAULT_MODEL,
            max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
            temperature: config.temperature ?? DEFAULT_TEMPERATURE,
            messages,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${text}`);
    }

    const data = await response.json() as OpenRouterResponse;

    if (data.error) {
        throw new Error(`OpenRouter error: ${data.error.message || 'Unknown error'}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('OpenRouter returned empty response');
    }

    return content;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an IntentLlmCallback wired to OpenRouter.
 *
 * @example
 * ```ts
 * const llm = createOpenRouterCallback({ apiKey: 'sk-or-...' });
 * const result = await parseIntent("aggiungi una hero", spec, llm);
 * ```
 */
export function createOpenRouterCallback(config: OpenRouterConfig): IntentLlmCallback {
    return async (prompt: string, context: IntentLlmContext): Promise<unknown> => {
        const sectionSummary = context.sectionSummary
            .map(s => `  ${s.index}: ${s.type}${s.titleKey ? ` (${s.titleKey})` : ''}`)
            .join('\n');

        const userMessage = [
            prompt,
            '',
            '## Current page sections',
            sectionSummary,
        ].join('\n');

        const messages: OpenRouterMessage[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
        ];

        const raw = await callOpenRouter(config, messages);

        // Clean and parse
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            return cleaned;
        }
    };
}

/**
 * Test connectivity to OpenRouter.
 * Returns true if the API key is valid.
 */
export async function testOpenRouterConnection(config: OpenRouterConfig): Promise<{ ok: boolean; error?: string; model?: string }> {
    try {
        const result = await callOpenRouter(config, [
            { role: 'user', content: 'Reply with exactly: {"status":"ok"}' },
        ]);
        return { ok: true, model: config.model || DEFAULT_MODEL };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

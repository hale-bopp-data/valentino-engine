import type { IntentLlmCallback, IntentLlmContext } from '../intent-parser.js';
import type { BaseProviderConfig, ProviderMessage } from './types.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5-20251001';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.1;

export type OpenRouterConfig = BaseProviderConfig & {
    apiKey: string;
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

async function callOpenRouter(
    config: OpenRouterConfig,
    messages: ProviderMessage[],
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

        const messages: ProviderMessage[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
        ];

        const raw = await callOpenRouter(config, messages);

        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            return cleaned;
        }
    };
}

export async function testOpenRouterConnection(config: OpenRouterConfig): Promise<{ ok: boolean; error?: string; model?: string }> {
    try {
        await callOpenRouter(config, [
            { role: 'user', content: 'Reply with exactly: {"status":"ok"}' },
        ]);
        return { ok: true, model: config.model || DEFAULT_MODEL };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

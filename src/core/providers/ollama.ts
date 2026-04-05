import type { IntentLlmCallback, IntentLlmContext } from '../intent-parser.js';
import type { BaseProviderConfig, ProviderMessage } from './types.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

export type OllamaConfig = BaseProviderConfig & {
    /** Target local ollama instance (default: http://localhost:11434) */
    baseUrl?: string;
};

const DEFAULT_MODEL = 'llama3';
const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.1;

type OllamaResponse = {
    message?: {
        content?: string;
    };
    error?: string;
};

async function callOllama(
    config: OllamaConfig,
    messages: ProviderMessage[],
): Promise<string> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const url = `${baseUrl}/api/chat`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: config.model || DEFAULT_MODEL,
            options: {
                num_predict: config.maxTokens || DEFAULT_MAX_TOKENS,
                temperature: config.temperature ?? DEFAULT_TEMPERATURE,
            },
            messages,
            stream: false,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama API error ${response.status}: ${text}`);
    }

    const data = await response.json() as OllamaResponse;
    if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
    }

    const content = data.message?.content;
    if (!content) {
        throw new Error('Ollama returned empty response');
    }

    return content;
}

export function createOllamaCallback(config: OllamaConfig): IntentLlmCallback {
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

        const raw = await callOllama(config, messages);

        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            return cleaned;
        }
    };
}

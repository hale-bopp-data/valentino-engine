import type { IntentLlmCallback, IntentLlmContext } from '../intent-parser.js';
import type { BaseProviderConfig, ProviderMessage } from './types.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

export type AzureOpenAIConfig = BaseProviderConfig & {
    apiKey: string;
    /** For Azure OpenAI, endpoint looks like https://<resource-name>.openai.azure.com/openai/deployments/<deployment-id> */
    baseUrl: string;
    /** Default api-version for Azure OpenAI */
    apiVersion?: string;
};

const DEFAULT_API_VERSION = '2024-02-15-preview';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.1;

type AzureResponse = {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
};

async function callAzureOpenAI(
    config: AzureOpenAIConfig,
    messages: ProviderMessage[],
): Promise<string> {
    const apiVersion = config.apiVersion || DEFAULT_API_VERSION;
    // Azure OpenAI URLs require the api-version query param
    const url = new URL(`${config.baseUrl}/chat/completions`);
    url.searchParams.set('api-version', apiVersion);

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey,
        },
        body: JSON.stringify({
            max_tokens: config.maxTokens || DEFAULT_MAX_TOKENS,
            temperature: config.temperature ?? DEFAULT_TEMPERATURE,
            messages,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Azure OpenAI API error ${response.status}: ${text}`);
    }

    const data = await response.json() as AzureResponse;
    if (data.error) {
        throw new Error(`Azure OpenAI error: ${data.error.message || 'Unknown error'}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Azure OpenAI returned empty response');
    }

    return content;
}

export function createAzureOpenAICallback(config: AzureOpenAIConfig): IntentLlmCallback {
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

        const raw = await callAzureOpenAI(config, messages);

        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            return cleaned;
        }
    };
}

import type { IntentParseResult, IntentLlmCallback, IntentLlmContext } from './types.js';
import type { PageSpecV1 } from '../types.js';
import type { CockpitAction } from '../cockpit-api.js';
import { getCockpitActionSchema, getAllSectionSchemas } from '../schema-export.js';

export function buildLlmPrompt(input: string, spec: PageSpecV1): string {
    const sectionSummary = spec.sections.map((s, i) => {
        const titleKey = ('titleKey' in s) ? (s as any).titleKey : undefined;
        return `  ${i}: ${s.type}${titleKey ? ` (${titleKey})` : ''}`;
    }).join('\n');

    return [
        'You are the Valentino Cockpit intent parser.',
        'Parse the operator\'s request into a structured CockpitAction JSON.',
        '',
        '## Current page structure',
        `id: ${spec.id}`,
        `profile: ${spec.profile || 'none'}`,
        `sections:`,
        sectionSummary,
        '',
        '## Operator request',
        `"${input}"`,
        '',
        '## Rules',
        '- Return ONLY valid JSON matching CockpitAction schema',
        '- For queries use: { "action": "query", "query": { "type": "..." } }',
        '- For mutations use the appropriate action type',
        '- Section indices are 0-based and MUST be valid numbers within the sections array',
        '- If the request is ambiguous, prefer a query over a mutation',
        '- If the request is conversational, informational, or a general question (e.g. "mi parli di...", "cos\'è...", "tell me about..."), return: { "action": "query", "query": { "type": "describe-page" } }',
        '- If you cannot parse the request, return: { "action": "query", "query": { "type": "describe-page" } }',
        '',
        'Return ONLY valid JSON, no markdown fences, no explanation.',
    ].join('\n');
}

export function buildSectionSummary(spec: PageSpecV1): Array<{ index: number; type: string; titleKey?: string }> {
    return spec.sections.map((s, i) => ({
        index: i,
        type: s.type,
        ...('titleKey' in s ? { titleKey: (s as any).titleKey } : {}),
    }));
}

/**
 * Executes LLM parsing and validates the generated intent.
 * Note: If this fails or the JSON is invalid, the router handles local fallback.
 * It returns an incomplete IntentParseResult containing `fallbackReason` and an empty `intent`.
 */
export async function parseWithLlm(
    input: string,
    spec: PageSpecV1,
    llm: IntentLlmCallback,
): Promise<IntentParseResult> {
    const context: IntentLlmContext = {
        pageSpec: spec,
        actionSchema: getCockpitActionSchema(),
        sectionSchemas: getAllSectionSchemas(),
        sectionSummary: buildSectionSummary(spec),
    };

    const prompt = buildLlmPrompt(input, spec);

    try {
        const raw = await llm(prompt, context);
        let parsed: unknown = raw;

        if (typeof raw === 'string') {
            const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            try {
                parsed = JSON.parse(cleaned);
            } catch {
                return { intent: null, mode: 'llm', raw: input, fallbackReason: 'LLM returned invalid JSON' };
            }
        }

        if (typeof parsed === 'object' && parsed !== null && 'action' in parsed) {
            const action = parsed as CockpitAction;

            if (action.action === 'edit-section' || action.action === 'remove-section') {
                const a = action as { sectionIndex?: unknown };
                if (typeof a.sectionIndex !== 'number' || !Number.isInteger(a.sectionIndex)
                    || a.sectionIndex < 0 || a.sectionIndex >= spec.sections.length) {
                    return { intent: null, mode: 'llm', raw: input, fallbackReason: `LLM returned invalid sectionIndex: ${a.sectionIndex}` };
                }
            }
            if (action.action === 'move-section') {
                const a = action as { fromIndex?: unknown; toIndex?: unknown };
                if (typeof a.fromIndex !== 'number' || typeof a.toIndex !== 'number') {
                    return { intent: null, mode: 'llm', raw: input, fallbackReason: 'LLM returned invalid move indices' };
                }
            }

            return {
                intent: {
                    action,
                    confidence: 'high',
                    description: `LLM parsed: ${action.action}`,
                },
                mode: 'llm',
                raw: input,
            };
        }

        return { intent: null, mode: 'llm', raw: input, fallbackReason: 'LLM returned non-action object' };
    } catch (err) {
        return {
            intent: null,
            mode: 'llm',
            raw: input,
            fallbackReason: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

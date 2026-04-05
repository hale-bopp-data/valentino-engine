import type { CockpitAction } from '../cockpit-api.js';
import type { PageSpecV1 } from '../types.js';

export type ParsedIntent = {
    action: CockpitAction;
    confidence: 'high' | 'medium' | 'low';
    description: string;
};

export type IntentParseResult = {
    intent: ParsedIntent | null;
    mode: 'local' | 'llm';
    raw: string;
    fallbackReason?: string;
};

export type IntentLlmCallback = (
    prompt: string,
    context: IntentLlmContext,
) => Promise<unknown>;

export type IntentLlmContext = {
    pageSpec: PageSpecV1;
    actionSchema: object;
    sectionSchemas: Record<string, object>;
    sectionSummary: Array<{ index: number; type: string; titleKey?: string }>;
};

/**
 * Interface for the Strategy Pattern.
 * Every specific intent parsing logic must implement this.
 */
export interface IntentMatcherStrategy {
    match(input: string, spec: PageSpecV1): ParsedIntent | null;
}

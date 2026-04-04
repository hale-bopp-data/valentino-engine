/**
 * Intent Parser — Natural language → CockpitAction.
 * Feature #778 (Il Sarto Parla), PBI #780 (Phase 1).
 * Refactored using Strategy Pattern (PBI-002).
 */

import type { IntentParseResult, IntentLlmCallback, IntentLlmContext, ParsedIntent, IntentMatcherStrategy } from './intent-parsers/types.js';
import type { PageSpecV1 } from './types.js';
import { parseWithLlm, buildSectionSummary } from './intent-parsers/llm-parser.js';

import { ListSectionTypesStrategy, GetSectionStrategy, ListSectionsStrategy, DescribePageStrategy, ValidateStrategy } from './intent-parsers/strategies/query.strategies.js';
import { AddSectionStrategy, RemoveSectionStrategy, MoveSectionStrategy, EditSectionStrategy, EditPageStrategy } from './intent-parsers/strategies/mutation.strategies.js';

import { resolveSectionType, parseIndex } from './intent-parsers/utils.js';
import { buildMinimalSection } from './intent-parsers/section-builder.js';

export type { IntentParseResult, IntentLlmCallback, IntentLlmContext, ParsedIntent };

// ---------------------------------------------------------------------------
// Strategy Registry
// ---------------------------------------------------------------------------

const strategies: IntentMatcherStrategy[] = [
    // Queries
    new ListSectionTypesStrategy(),
    new GetSectionStrategy(),
    new ListSectionsStrategy(),
    new DescribePageStrategy(),
    new ValidateStrategy(),
    // Mutations
    new AddSectionStrategy(),
    new RemoveSectionStrategy(),
    new MoveSectionStrategy(),
    new EditSectionStrategy(),
    new EditPageStrategy(),
];

// ---------------------------------------------------------------------------
// Local parser
// ---------------------------------------------------------------------------

function parseLocal(input: string, spec: PageSpecV1): IntentParseResult {
    for (const strategy of strategies) {
        const result = strategy.match(input, spec);
        if (result) return { intent: result, mode: 'local', raw: input };
    }
    return { intent: null, mode: 'local', raw: input };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a natural language operator request into a CockpitAction.
 *
 * Supports IT and EN. If `llm` callback is provided, tries LLM first
 * with automatic fallback to local rule-based parser.
 */
export async function parseIntent(
    input: string,
    spec: PageSpecV1,
    llm?: IntentLlmCallback,
): Promise<IntentParseResult> {
    if (llm) {
        const llmResult = await parseWithLlm(input, spec, llm);
        // If LLM produced a valid intent, return it immediately
        if (llmResult.intent) {
            return llmResult;
        }
        // Fallback: LLM failed or generated unparseable response
        const local = parseLocal(input, spec);
        return {
            ...local,
            mode: 'llm',
            fallbackReason: llmResult.fallbackReason
        };
    }
    return parseLocal(input, spec);
}

/**
 * Synchronous local-only parsing. No LLM, always works.
 */
export function parseIntentLocal(input: string, spec: PageSpecV1): IntentParseResult {
    return parseLocal(input, spec);
}

/**
 * Exported for testing compatibility
 */
export { resolveSectionType, parseIndex, buildMinimalSection, buildSectionSummary };

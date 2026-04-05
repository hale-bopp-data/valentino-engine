import type { ParsedIntent, IntentMatcherStrategy } from '../types.js';
import type { PageSpecV1 } from '../../types.js';
import { hasAny, hasWord, parseIndex } from '../utils.js';

export class ListSectionTypesStrategy implements IntentMatcherStrategy {
    match(input: string, _spec: PageSpecV1): ParsedIntent | null {
        if (hasAny(input, 'tipi', 'types', 'type') && hasAny(input, 'sezion', 'section', 'disponibil', 'available')) {
            return {
                action: { action: 'query', query: { type: 'list-section-types' } },
                confidence: 'high',
                description: 'List available section types',
            };
        }
        return null;
    }
}

export class GetSectionStrategy implements IntentMatcherStrategy {
    match(input: string, spec: PageSpecV1): ParsedIntent | null {
        const match = input.match(/(?:sezion\w*|section)\s*#?\s*(\d+|prima|primo|second[oa]|terz[oa]|quart[oa]|quint[oa]|ultim[oa]|first|second|third|fourth|fifth|last)\b/i);
        if (match && hasWord(input, 'mostr', 'show', 'dettagl', 'detail', 'vedi', 'see')) {
            const idx = parseIndex(match[1], spec.sections.length);
            if (idx !== null && idx >= 0 && idx < spec.sections.length) {
                return {
                    action: { action: 'query', query: { type: 'get-section', index: idx } },
                    confidence: 'high',
                    description: `Show section #${idx}`,
                };
            }
        }
        return null;
    }
}

export class ListSectionsStrategy implements IntentMatcherStrategy {
    match(input: string, _spec: PageSpecV1): ParsedIntent | null {
        if ((hasWord(input, 'mostr', 'elenc', 'list', 'show') || hasAny(input, 'quali', 'quante')) &&
            hasAny(input, 'sezion', 'section')) {
            return {
                action: { action: 'query', query: { type: 'list-sections' } },
                confidence: 'high',
                description: 'List all sections',
            };
        }
        return null;
    }
}

export class DescribePageStrategy implements IntentMatcherStrategy {
    match(input: string, _spec: PageSpecV1): ParsedIntent | null {
        if ((hasWord(input, 'descriv', 'describe', 'panoramic', 'overview', 'struttur', 'structure') &&
             hasAny(input, 'pagin', 'page')) ||
            (hasAny(input, 'com\'è', 'come è', 'com è') && hasAny(input, 'fatt', 'struttur'))) {
            return {
                action: { action: 'query', query: { type: 'describe-page' } },
                confidence: 'high',
                description: 'Describe page structure',
            };
        }
        return null;
    }
}

export class ValidateStrategy implements IntentMatcherStrategy {
    match(input: string, _spec: PageSpecV1): ParsedIntent | null {
        if (hasWord(input, 'valida', 'validate', 'check', 'controll', 'verific')) {
            return {
                action: { action: 'query', query: { type: 'validate' } },
                confidence: 'high',
                description: 'Validate page spec',
            };
        }
        return null;
    }
}

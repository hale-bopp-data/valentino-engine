/**
 * Intent Parser — Natural language → CockpitAction.
 * Feature #778 (Il Sarto Parla), PBI #780 (Phase 1).
 *
 * Two modes:
 * - Local (rule-based): regex patterns for IT/EN, always works, zero API.
 * - LLM (callback): delegates to external LLM, validates output, falls back to local.
 *
 * Pure functions, no I/O, no LLM client.
 */

import type { CockpitAction, CockpitQuery } from './cockpit-api.js';
import type { SectionSpec, PageSpecV1 } from './types.js';
import { COCKPIT_SECTION_TYPES } from './cockpit-api.js';
import { getCockpitActionSchema, getAllSectionSchemas } from './schema-export.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Section type aliases (IT + EN)
// ---------------------------------------------------------------------------

const SECTION_ALIASES: Record<string, string> = {
    // IT
    'eroe': 'hero', 'intestazione': 'hero', 'banner': 'hero',
    'carte': 'cards', 'schede': 'cards', 'card': 'cards',
    'confronto': 'comparison', 'comparazione': 'comparison',
    'azione': 'cta', 'chiamata': 'cta',
    'modulo': 'form', 'formulario': 'form',
    'manifesto': 'manifesto',
    'spaziatore': 'spacer', 'spazio': 'spacer',
    'statistiche': 'stats', 'numeri': 'stats', 'metriche': 'stats',
    'come funziona': 'how-it-works', 'passi': 'how-it-works', 'fasi': 'how-it-works',
    'consulente': 'advisor', 'consigliere': 'advisor',
    'diagramma': 'mermaid-diagram', 'grafico': 'mermaid-diagram',
    'lista dati': 'data-list', 'tabella': 'data-list',
    'azione form': 'action-form',
    'catalogo': 'valentino-catalog',
    // EN passthrough
    'hero': 'hero', 'cards': 'cards', 'comparison': 'comparison',
    'cta': 'cta', 'form': 'form', 'spacer': 'spacer',
    'stats': 'stats', 'how-it-works': 'how-it-works', 'advisor': 'advisor',
    'mermaid-diagram': 'mermaid-diagram', 'data-list': 'data-list',
    'action-form': 'action-form', 'valentino-catalog': 'valentino-catalog',
    'showcase-intro': 'showcase-intro', 'component-showcase': 'component-showcase',
    'agent-dashboard': 'agent-dashboard', 'agent-graph': 'agent-graph',
    'agent-list': 'agent-list', 'mermaid': 'mermaid-diagram',
};

function resolveSectionType(raw: string): string | null {
    const normalized = raw.toLowerCase().trim();
    if (COCKPIT_SECTION_TYPES.includes(normalized)) return normalized;
    return SECTION_ALIASES[normalized] || null;
}

// ---------------------------------------------------------------------------
// Number parsing (IT + EN)
// ---------------------------------------------------------------------------

const WORD_NUMBERS: Record<string, number> = {
    'prima': 0, 'primo': 0, 'first': 0,
    'seconda': 1, 'secondo': 1, 'second': 1,
    'terza': 2, 'terzo': 2, 'third': 2,
    'quarta': 3, 'quarto': 3, 'fourth': 3,
    'quinta': 4, 'quinto': 4, 'fifth': 4,
    'ultima': -1, 'ultimo': -1, 'last': -1,
    'penultima': -2, 'penultimo': -2,
};

function parseIndex(raw: string, totalSections: number): number | null {
    const trimmed = raw.trim().toLowerCase();

    // Word numbers
    if (trimmed in WORD_NUMBERS) {
        const val = WORD_NUMBERS[trimmed];
        return val < 0 ? totalSections + val : val;
    }

    // Numeric (1-based in user language → 0-based)
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
        // If user says "sezione 1" they mean index 0
        return num > 0 ? num - 1 : num;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Local intent patterns
// ---------------------------------------------------------------------------

type PatternMatcher = (input: string, spec: PageSpecV1) => ParsedIntent | null;

// --- QUERY patterns ---

/** Helper: check if input contains any of the given words (prefix-match for IT conjugation) */
function hasWord(input: string, ...prefixes: string[]): boolean {
    const lower = input.toLowerCase();
    return prefixes.some(p => new RegExp(`\\b${p}\\w*\\b`, 'i').test(lower));
}

function hasAny(input: string, ...words: string[]): boolean {
    const lower = input.toLowerCase();
    return words.some(w => lower.includes(w));
}

const queryPatterns: PatternMatcher[] = [
    // list section types (must be before list-sections)
    (input) => {
        if (hasAny(input, 'tipi', 'types', 'type') && hasAny(input, 'sezion', 'section', 'disponibil', 'available')) {
            return {
                action: { action: 'query', query: { type: 'list-section-types' } },
                confidence: 'high',
                description: 'List available section types',
            };
        }
        return null;
    },

    // get section by index — must be before list-sections
    (input, spec) => {
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
    },

    // list sections
    (input) => {
        if ((hasWord(input, 'mostr', 'elenc', 'list', 'show') || hasAny(input, 'quali', 'quante')) &&
            hasAny(input, 'sezion', 'section')) {
            return {
                action: { action: 'query', query: { type: 'list-sections' } },
                confidence: 'high',
                description: 'List all sections',
            };
        }
        return null;
    },

    // describe page
    (input) => {
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
    },

    // validate
    (input) => {
        if (hasWord(input, 'valida', 'validate', 'check', 'controll', 'verific')) {
            return {
                action: { action: 'query', query: { type: 'validate' } },
                confidence: 'high',
                description: 'Validate page spec',
            };
        }
        return null;
    },
];

// --- MUTATION patterns ---

const mutationPatterns: PatternMatcher[] = [
    // add section — extract last known section type word from input
    (input, spec) => {
        if (!hasWord(input, 'aggiung', 'add', 'inserisc', 'insert', 'mett', 'put')) return null;

        // Extract all words and find a section type
        const words = input.toLowerCase().split(/\s+/);
        let sectionType: string | null = null;
        for (const word of words) {
            const resolved = resolveSectionType(word);
            if (resolved) { sectionType = resolved; break; }
        }
        // Try two-word combos too (e.g., "how-it-works", "data-list")
        if (!sectionType) {
            for (let i = 0; i < words.length - 1; i++) {
                const combo = `${words[i]}-${words[i + 1]}`;
                const resolved = resolveSectionType(combo);
                if (resolved) { sectionType = resolved; break; }
            }
        }
        if (!sectionType) return null;

        // Check for position
        let atIndex: number | undefined;
        const posMatch = input.match(/(?:posizione|position|alla|al|at|in)\s+(\d+|inizio|fine|start|end)/i);
        if (posMatch) {
            const posRaw = posMatch[1].toLowerCase();
            if (posRaw === 'fine' || posRaw === 'end') atIndex = undefined;
            else if (posRaw === 'inizio' || posRaw === 'start') atIndex = 0;
            else {
                const parsed = parseIndex(posRaw, spec.sections.length);
                if (parsed !== null) atIndex = parsed;
            }
        }

        const section = buildMinimalSection(sectionType);
        return {
            action: { action: 'add-section', section, atIndex },
            confidence: 'medium',
            description: `Add ${sectionType} section${atIndex != null ? ` at position ${atIndex}` : ''}`,
        };
    },

    // remove section by index or type
    (input, spec) => {
        if (!hasWord(input, 'rimuov', 'remove', 'elimin', 'delete', 'togl')) return null;

        // By index: "rimuovi sezione 2"
        const idxMatch = input.match(/(?:sezion\w*|section)\s*#?\s*(\d+|prima|primo|second[oa]|terz[oa]|quart[oa]|quint[oa]|ultim[oa]|first|second|third|fourth|fifth|last)/i);
        if (idxMatch) {
            const idx = parseIndex(idxMatch[1], spec.sections.length);
            if (idx !== null && idx >= 0 && idx < spec.sections.length) {
                return {
                    action: { action: 'remove-section', sectionIndex: idx },
                    confidence: 'high',
                    description: `Remove section #${idx} (${spec.sections[idx].type})`,
                };
            }
        }

        // By type: find last word that resolves to a section type
        const words = input.toLowerCase().split(/\s+/);
        for (let i = words.length - 1; i >= 0; i--) {
            const resolved = resolveSectionType(words[i]);
            if (resolved) {
                const idx = spec.sections.findIndex(s => s.type === resolved);
                if (idx !== -1) {
                    return {
                        action: { action: 'remove-section', sectionIndex: idx },
                        confidence: 'medium',
                        description: `Remove first ${resolved} section (#${idx})`,
                    };
                }
            }
        }
        return null;
    },

    // move section
    (input, spec) => {
        // "sposta sezione 3 in posizione 1", "move section 2 to position 0"
        const match = input.match(/\b(?:sposta\w*|move|muovi\w*)\b.*\b(?:sezion[ie]|section)\b\s*#?(\d+|prima|primo|second[oa]|terz[oa]|ultim[oa]|first|second|third|last).*?(?:posizione?\s*|position\s*|a\s+|to\s+)#?(\d+|prima|primo|second[oa]|terz[oa]|ultim[oa]|inizio|fine|first|last|start|end)/i);
        if (match) {
            const from = parseIndex(match[1], spec.sections.length);
            let to: number | null;
            const toRaw = match[2].toLowerCase();
            if (toRaw === 'inizio' || toRaw === 'start') to = 0;
            else if (toRaw === 'fine' || toRaw === 'end') to = spec.sections.length - 1;
            else to = parseIndex(match[2], spec.sections.length);

            if (from !== null && to !== null && from >= 0 && to >= 0) {
                return {
                    action: { action: 'move-section', fromIndex: from, toIndex: to },
                    confidence: 'medium',
                    description: `Move section from #${from} to #${to}`,
                };
            }
        }
        return null;
    },

    // edit section field
    (input, spec) => {
        // "cambia il titolo dell'hero in X", "change hero title to X"
        const match = input.match(/\b(?:cambia\w*|change|modifica\w*|edit|aggiorna\w*|update|sett?a|set)\b.*?\b(?:(?:il|la|lo|the|l['']?)\s+)?(\w+)\b.*?\b(?:dell['']?|del|della|of\s+the|of)\s*([\w\s-]+?)(?:\s+(?:in|to|con|a|=)\s+(.+))?$/i);
        if (match) {
            const fieldRaw = match[1].toLowerCase();
            const targetRaw = match[2].trim();
            const value = match[3]?.trim();

            const sectionType = resolveSectionType(targetRaw);
            if (!sectionType || !value) return null;

            const idx = spec.sections.findIndex(s => s.type === sectionType);
            if (idx === -1) return null;

            // Map common field names
            const fieldMap: Record<string, string> = {
                'titolo': 'titleKey', 'title': 'titleKey',
                'sottotitolo': 'subtitleKey', 'subtitle': 'subtitleKey',
                'tagline': 'taglineKey',
                'descrizione': 'descKey', 'description': 'descKey',
                'superficie': 'presentation.surface', 'surface': 'presentation.surface',
                'tono': 'presentation.tone', 'tone': 'presentation.tone',
            };
            const field = fieldMap[fieldRaw] || fieldRaw;

            return {
                action: { action: 'edit-section', sectionIndex: idx, patch: { [field]: value } },
                confidence: 'medium',
                description: `Edit ${sectionType} section: set ${field} = "${value}"`,
            };
        }
        return null;
    },

    // edit page-level field
    (input) => {
        // "cambia il profilo della pagina in product-surface"
        const match = input.match(/\b(?:cambia\w*|change|sett?a|set)\b.*?\b(?:profilo|profile)\b.*?\b(?:pagina|page)\b.*?(?:in|to|=)\s+(.+)$/i);
        if (match) {
            return {
                action: { action: 'edit-page', patch: { profile: match[1].trim() as any } },
                confidence: 'medium',
                description: `Set page profile to "${match[1].trim()}"`,
            };
        }

        // "cambia il titolo della pagina in X"
        const titleMatch = input.match(/\b(?:cambia\w*|change|sett?a|set)\b.*?\b(?:titolo|title)\b.*?\b(?:pagina|page)\b.*?(?:in|to|=)\s+(.+)$/i);
        if (titleMatch) {
            return {
                action: { action: 'edit-page', patch: { titleKey: titleMatch[1].trim() } },
                confidence: 'medium',
                description: `Set page title to "${titleMatch[1].trim()}"`,
            };
        }
        return null;
    },
];

// ---------------------------------------------------------------------------
// Minimal section builder
// ---------------------------------------------------------------------------

function buildMinimalSection(sectionType: string): SectionSpec {
    const prefix = `new.${sectionType}`;
    switch (sectionType) {
        case 'hero':
            return { type: 'hero', titleKey: `${prefix}.title`, presentation: { surface: 'shell-dark', rhythmProfile: 'hero' } };
        case 'cards':
            return { type: 'cards', variant: 'catalog', titleKey: `${prefix}.title`, items: [{ titleKey: `${prefix}.item1.title` }], presentation: { rhythmProfile: 'feature' } };
        case 'cta':
            return { type: 'cta', titleKey: `${prefix}.title`, presentation: { surface: 'accent', rhythmProfile: 'proof' } };
        case 'stats':
            return { type: 'stats', items: [{ valueKey: `${prefix}.item1.value`, labelKey: `${prefix}.item1.label` }], presentation: { rhythmProfile: 'metrics' } };
        case 'how-it-works':
            return { type: 'how-it-works', steps: [{ numKey: '1', titleKey: `${prefix}.step1.title`, descKey: `${prefix}.step1.desc` }], presentation: { rhythmProfile: 'feature' } };
        case 'form':
            return { type: 'form', titleKey: `${prefix}.title`, submitKey: `${prefix}.submit`, fields: [{ name: 'email', type: 'email', labelKey: `${prefix}.email` }] };
        case 'comparison':
            return { type: 'comparison', titleKey: `${prefix}.title`, left: { titleKey: `${prefix}.left`, itemsKeys: [] }, right: { titleKey: `${prefix}.right`, itemsKeys: [] } };
        case 'manifesto':
            return { type: 'manifesto', presentation: { surface: 'reading-light', rhythmProfile: 'reading' } };
        case 'spacer':
            return { type: 'spacer', size: 'md' };
        case 'advisor':
            return { type: 'advisor', titleKey: `${prefix}.title`, submitKey: `${prefix}.submit`, fallbackTitleKey: `${prefix}.fallback.title`, fallbackBodyKey: `${prefix}.fallback.body`, prompts: [] };
        case 'mermaid-diagram':
            return { type: 'mermaid-diagram', mermaidCode: 'graph LR\n  A-->B' };
        case 'data-list':
            return { type: 'data-list', dataUrl: '/api/data', columns: [{ key: 'id', labelKey: `${prefix}.col.id` }] };
        case 'action-form':
            return { type: 'action-form', titleKey: `${prefix}.title`, submitUrl: '/api/submit', submitKey: `${prefix}.submit`, successKey: `${prefix}.success`, fields: [{ name: 'name', type: 'text', labelKey: `${prefix}.name` }] };
        default:
            return { type: sectionType as any, presentation: {} } as any;
    }
}

// ---------------------------------------------------------------------------
// Local parser
// ---------------------------------------------------------------------------

function parseLocal(input: string, spec: PageSpecV1): IntentParseResult {
    // Try query patterns first (read-only, safer)
    for (const matcher of queryPatterns) {
        const result = matcher(input, spec);
        if (result) return { intent: result, mode: 'local', raw: input };
    }

    // Then mutation patterns
    for (const matcher of mutationPatterns) {
        const result = matcher(input, spec);
        if (result) return { intent: result, mode: 'local', raw: input };
    }

    return { intent: null, mode: 'local', raw: input };
}

// ---------------------------------------------------------------------------
// LLM parser
// ---------------------------------------------------------------------------

function buildLlmPrompt(input: string, spec: PageSpecV1): string {
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
        '- Section indices are 0-based',
        '- If the request is ambiguous, prefer a query over a mutation',
        '- If you cannot parse the request, return: { "action": "query", "query": { "type": "describe-page" } }',
        '',
        'Return ONLY valid JSON, no markdown fences, no explanation.',
    ].join('\n');
}

function buildSectionSummary(spec: PageSpecV1): Array<{ index: number; type: string; titleKey?: string }> {
    return spec.sections.map((s, i) => ({
        index: i,
        type: s.type,
        ...('titleKey' in s ? { titleKey: (s as any).titleKey } : {}),
    }));
}

async function parseWithLlm(
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
                // Fall back to local
                const local = parseLocal(input, spec);
                return { ...local, mode: 'llm', fallbackReason: 'LLM returned invalid JSON' };
            }
        }

        if (typeof parsed === 'object' && parsed !== null && 'action' in parsed) {
            const action = parsed as CockpitAction;
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

        const local = parseLocal(input, spec);
        return { ...local, mode: 'llm', fallbackReason: 'LLM returned non-action object' };
    } catch (err) {
        const local = parseLocal(input, spec);
        return {
            ...local,
            mode: 'llm',
            fallbackReason: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a natural language operator request into a CockpitAction.
 *
 * Supports IT and EN. If `llm` callback is provided, tries LLM first
 * with automatic fallback to local rule-based parser.
 *
 * @example
 * ```ts
 * // Local mode
 * const result = parseIntent("mostrami le sezioni", pageSpec);
 *
 * // LLM mode with fallback
 * const result = await parseIntent("aggiungi una hero", pageSpec, myLlm);
 * ```
 */
export async function parseIntent(
    input: string,
    spec: PageSpecV1,
    llm?: IntentLlmCallback,
): Promise<IntentParseResult> {
    if (llm) {
        return parseWithLlm(input, spec, llm);
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
 * Exported for testing.
 */
export { resolveSectionType, parseIndex, buildMinimalSection, buildSectionSummary };

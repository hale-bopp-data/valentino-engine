/**
 * AI Page Generator — Pure prompt-to-PageSpec engine.
 * PBI #608 — Generates valid PageSpecV1 from natural language prompts.
 *
 * Two modes:
 * - Local (rule-based): parses prompt, composes sections from templates. Always works, zero API.
 * - LLM (callback): delegates to an external LLM via user-provided function, validates output.
 *
 * No fetch, no DOM, no LLM client — pure functions only.
 * The consumer wires in the LLM integration (portal uses llm-client.mjs).
 */

import type {
    PageSpecV1,
    SectionSpec,
    PageProfileSpec,
    HeroSection,
    CardsSection,
    CardsCatalogItem,
    CtaSection,
    StatsSection,
    StatItemSpec,
    HowItWorksSection,
    HowItWorksStepSpec,
    ValentinoCatalogV1,
} from './types.js';
import { validatePageSpec } from './page-spec.js';
import { resolvePageSpecWithCatalog } from './catalog.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageIntent = {
    /** Detected page type */
    pageType: 'landing' | 'product' | 'service' | 'about' | 'generic';
    /** Detected profile mapping */
    profile: PageProfileSpec;
    /** Sections the user wants (in order) */
    sectionIntents: SectionIntent[];
    /** Extracted title (if any) */
    title?: string;
    /** Raw items/features mentioned */
    items: string[];
    /** Raw steps mentioned */
    steps: string[];
};

export type SectionIntent = {
    type: SectionSpec['type'];
    /** Items specific to this section (e.g., card titles) */
    items?: string[];
    /** Steps specific to this section */
    steps?: string[];
};

export type GeneratePageOptions = {
    /** Page ID (required) */
    id: string;
    /** Optional catalog for blueprint resolution */
    catalog?: ValentinoCatalogV1;
    /** Optional LLM callback — receives prompt, returns raw PageSpecV1 JSON */
    llm?: (prompt: string, context: LlmContext) => Promise<unknown>;
    /** Optional blueprint ID to use as base */
    blueprintId?: string;
};

export type LlmContext = {
    intent: PageIntent;
    sectionTypes: string[];
    exampleSpec: PageSpecV1;
};

export type GeneratePageResult = {
    spec: PageSpecV1;
    mode: 'local' | 'llm';
    intent: PageIntent;
    warnings: string[];
};

// ---------------------------------------------------------------------------
// Prompt parser — extracts intent from natural language
// ---------------------------------------------------------------------------

const PAGE_TYPE_PATTERNS: Array<{ pattern: RegExp; type: PageIntent['pageType']; profile: PageProfileSpec }> = [
    { pattern: /\b(landing\s*page|homepage|home)\b/i, type: 'landing', profile: 'home-signature' },
    { pattern: /\b(prodott[oi]|product)\b/i, type: 'product', profile: 'product-surface' },
    { pattern: /\b(serviz[io]|service|consulenz[ae]|consulting)\b/i, type: 'service', profile: 'product-surface' },
    { pattern: /\b(chi\s*siamo|about\s*us|about|team)\b/i, type: 'about', profile: 'reading-manifesto' },
];

const SECTION_PATTERNS: Array<{ pattern: RegExp; type: SectionSpec['type'] }> = [
    { pattern: /\b(hero|header|intestazione|banner)\b/i, type: 'hero' },
    { pattern: /\b(card[s]?|pillar|feature[s]?|caratteristich[ae]|funzionalit[aà])\b/i, type: 'cards' },
    { pattern: /\b(stat[s]?|statistic[hae]*|numer[io]|metric[hae]*)\b/i, type: 'stats' },
    { pattern: /\b(come\s*funziona|how\s*it\s*works|step[s]?|pass[io]|fasi)\b/i, type: 'how-it-works' },
    { pattern: /\b(cta|call\s*to\s*action|contatt[aio]|azione)\b/i, type: 'cta' },
    { pattern: /\b(form|modul[oi]|contact|contatt[io])\b/i, type: 'form' },
    { pattern: /\b(confronto|comparison|vs|versus)\b/i, type: 'comparison' },
    { pattern: /\b(manifesto|mission[e]?|vision[e]?)\b/i, type: 'manifesto' },
];

/** Split a comma-separated list. Uses ", " and " e " (with spaces) to avoid splitting mid-word. */
function splitList(raw: string): string[] {
    return raw.split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(Boolean);
}

/** Extract numbered/listed items from prompt: "3 card: design, sviluppo, supporto" */
function extractListedItems(prompt: string): string[] {
    // Pattern: "N card/feature: item1, item2, item3"
    const listMatch = prompt.match(/\d+\s*(?:card|feature|pillar|serviz[io]|caratteristich[ae])\s*[:：]\s*(.+?)(?:\.|$)/i);
    if (listMatch) {
        return splitList(listMatch[1]);
    }
    // Pattern: "card: item1, item2, item3"
    const simpleMatch = prompt.match(/(?:card|feature|pillar)\s*[:：]\s*(.+?)(?:\.|$)/i);
    if (simpleMatch) {
        return splitList(simpleMatch[1]);
    }
    return [];
}

/** Extract steps: "come funziona: analisi, progetto, lancio" */
function extractSteps(prompt: string): string[] {
    const match = prompt.match(/(?:come\s*funziona|how\s*it\s*works|step|pass[io]|fasi)\s*[:：]\s*(.+?)(?:\.|$)/i);
    if (match) {
        return splitList(match[1]);
    }
    return [];
}

/** Extract a title from the prompt context */
function extractTitle(prompt: string): string | undefined {
    // "landing page per un ristorante" → "Ristorante"
    const perMatch = prompt.match(/(?:per\s+(?:un[oa']?\s+)?|for\s+(?:a\s+)?)([\w\s]+?)(?:\s+con\s+|\s+with\s+|\.|,|$)/i);
    if (perMatch) {
        const raw = perMatch[1].trim();
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return undefined;
}

/**
 * Parse a natural language prompt into a structured PageIntent.
 */
export function parsePrompt(prompt: string): PageIntent {
    // Detect page type
    let pageType: PageIntent['pageType'] = 'generic';
    let profile: PageProfileSpec = 'home-signature';
    for (const { pattern, type, profile: prof } of PAGE_TYPE_PATTERNS) {
        if (pattern.test(prompt)) {
            pageType = type;
            profile = prof;
            break;
        }
    }

    // Detect sections
    const sectionIntents: SectionIntent[] = [];
    const items = extractListedItems(prompt);
    const steps = extractSteps(prompt);

    for (const { pattern, type } of SECTION_PATTERNS) {
        if (pattern.test(prompt)) {
            const intent: SectionIntent = { type };
            if (type === 'cards' && items.length > 0) {
                intent.items = items;
            }
            if (type === 'how-it-works' && steps.length > 0) {
                intent.steps = steps;
            }
            sectionIntents.push(intent);
        }
    }

    // Default sections if none detected
    if (sectionIntents.length === 0) {
        sectionIntents.push(
            { type: 'hero' },
            { type: 'cards', items: items.length > 0 ? items : undefined },
            { type: 'cta' },
        );
    }

    // Ensure hero is first if not present
    if (!sectionIntents.some(s => s.type === 'hero')) {
        sectionIntents.unshift({ type: 'hero' });
    }

    return {
        pageType,
        profile,
        sectionIntents,
        title: extractTitle(prompt),
        items,
        steps,
    };
}

// ---------------------------------------------------------------------------
// Section builders — compose SectionSpec from intent
// ---------------------------------------------------------------------------

function buildHero(intent: PageIntent): HeroSection {
    const titleKey = intent.title
        ? `page.${intent.title.toLowerCase().replace(/\s+/g, '-')}.hero.title`
        : 'page.generated.hero.title';
    return {
        type: 'hero',
        titleKey,
        taglineKey: titleKey.replace('.title', '.tagline'),
        cta: { labelKey: titleKey.replace('.title', '.cta'), action: { type: 'link', href: '#contact' } },
        presentation: { surface: 'shell-dark', tone: 'immersive', rhythmProfile: 'hero' },
    };
}

function buildCards(intent: SectionIntent, pageIntent: PageIntent): CardsSection {
    const prefix = pageIntent.title
        ? `page.${pageIntent.title.toLowerCase().replace(/\s+/g, '-')}.cards`
        : 'page.generated.cards';

    const itemNames = intent.items && intent.items.length > 0
        ? intent.items
        : ['Feature 1', 'Feature 2', 'Feature 3'];

    const items: CardsCatalogItem[] = itemNames.map((name, i) => ({
        titleKey: `${prefix}.item${i + 1}.title`,
        descKey: `${prefix}.item${i + 1}.desc`,
        iconText: `${i + 1}`,
    }));

    return {
        type: 'cards',
        variant: 'catalog',
        titleKey: `${prefix}.title`,
        items,
        presentation: { surface: 'default', rhythmProfile: 'feature' },
        animation: { entrance: 'fade-up', delay: 'stagger' },
    };
}

function buildStats(pageIntent: PageIntent): StatsSection {
    const prefix = pageIntent.title
        ? `page.${pageIntent.title.toLowerCase().replace(/\s+/g, '-')}.stats`
        : 'page.generated.stats';

    const items: StatItemSpec[] = [
        { valueKey: `${prefix}.item1.value`, labelKey: `${prefix}.item1.label` },
        { valueKey: `${prefix}.item2.value`, labelKey: `${prefix}.item2.label` },
        { valueKey: `${prefix}.item3.value`, labelKey: `${prefix}.item3.label` },
    ];

    return {
        type: 'stats',
        titleKey: `${prefix}.title`,
        items,
        presentation: { surface: 'muted', rhythmProfile: 'metrics' },
        animation: { entrance: 'fade-up' },
    };
}

function buildHowItWorks(intent: SectionIntent, pageIntent: PageIntent): HowItWorksSection {
    const prefix = pageIntent.title
        ? `page.${pageIntent.title.toLowerCase().replace(/\s+/g, '-')}.how-it-works`
        : 'page.generated.how-it-works';

    const stepNames = intent.steps && intent.steps.length > 0
        ? intent.steps
        : ['Analisi', 'Progettazione', 'Realizzazione'];

    const steps: HowItWorksStepSpec[] = stepNames.map((_, i) => ({
        numKey: `${prefix}.step${i + 1}.num`,
        titleKey: `${prefix}.step${i + 1}.title`,
        descKey: `${prefix}.step${i + 1}.desc`,
    }));

    return {
        type: 'how-it-works',
        titleKey: `${prefix}.title`,
        steps,
        presentation: { surface: 'default', rhythmProfile: 'feature' },
        animation: { entrance: 'fade-up', delay: 'stagger' },
    };
}

function buildCta(pageIntent: PageIntent): CtaSection {
    const prefix = pageIntent.title
        ? `page.${pageIntent.title.toLowerCase().replace(/\s+/g, '-')}.cta`
        : 'page.generated.cta';

    return {
        type: 'cta',
        titleKey: `${prefix}.title`,
        bodyKey: `${prefix}.body`,
        primary: { labelKey: `${prefix}.primary`, action: { type: 'link', href: '#contact' } },
        presentation: { surface: 'accent', rhythmProfile: 'proof' },
    };
}

function buildSectionFromIntent(intent: SectionIntent, pageIntent: PageIntent): SectionSpec | null {
    switch (intent.type) {
        case 'hero': return buildHero(pageIntent);
        case 'cards': return buildCards(intent, pageIntent);
        case 'stats': return buildStats(pageIntent);
        case 'how-it-works': return buildHowItWorks(intent, pageIntent);
        case 'cta': return buildCta(pageIntent);
        default: return null;
    }
}

// ---------------------------------------------------------------------------
// Local generator — rule-based, zero API
// ---------------------------------------------------------------------------

function generateLocal(prompt: string, options: GeneratePageOptions): GeneratePageResult {
    const intent = parsePrompt(prompt);
    const warnings: string[] = [];

    const sections: SectionSpec[] = [];
    for (const si of intent.sectionIntents) {
        const section = buildSectionFromIntent(si, intent);
        if (section) {
            sections.push(section);
        } else {
            warnings.push(`Section type "${si.type}" not yet supported by local generator — skipped`);
        }
    }

    if (sections.length === 0) {
        warnings.push('No sections could be generated — using default hero + CTA');
        sections.push(buildHero(intent), buildCta(intent));
    }

    let spec: PageSpecV1 = {
        version: '1',
        id: options.id,
        profile: intent.profile,
        blueprintId: options.blueprintId,
        sections,
    };

    // Resolve with catalog if provided
    if (options.catalog) {
        spec = resolvePageSpecWithCatalog(spec, options.catalog);
    }

    if (!validatePageSpec(spec)) {
        warnings.push('Generated spec failed validation — check section structure');
    }

    return { spec, mode: 'local', intent, warnings };
}

// ---------------------------------------------------------------------------
// LLM generator — delegates to user-provided callback
// ---------------------------------------------------------------------------

function buildLlmPrompt(userPrompt: string, intent: PageIntent): string {
    return [
        'Generate a valid Valentino PageSpecV1 JSON based on this request:',
        '',
        `"${userPrompt}"`,
        '',
        'Requirements:',
        '- version must be "1"',
        '- id will be set by the caller',
        `- profile: "${intent.profile}"`,
        `- Include these section types in order: ${intent.sectionIntents.map(s => s.type).join(', ')}`,
        '- Each section needs a "type" field and relevant content keys (titleKey, descKey, etc.)',
        '- Use i18n key format: "page.<context>.<section>.<field>"',
        '- Include presentation tokens (surface, rhythmProfile) on each section',
        '',
        'Return ONLY valid JSON, no markdown fences, no explanation.',
    ].join('\n');
}

async function generateWithLlm(
    prompt: string,
    options: GeneratePageOptions & { llm: NonNullable<GeneratePageOptions['llm']> },
): Promise<GeneratePageResult> {
    const intent = parsePrompt(prompt);
    const warnings: string[] = [];

    // Build context for the LLM
    const localResult = generateLocal(prompt, { id: options.id });
    const context: LlmContext = {
        intent,
        sectionTypes: intent.sectionIntents.map(s => s.type),
        exampleSpec: localResult.spec,
    };

    const llmPrompt = buildLlmPrompt(prompt, intent);
    let raw: unknown;

    try {
        raw = await options.llm(llmPrompt, context);
    } catch (err) {
        warnings.push(`LLM call failed: ${err instanceof Error ? err.message : String(err)} — falling back to local`);
        return { ...generateLocal(prompt, options), warnings };
    }

    // Parse LLM response
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
        // Strip markdown fences if present
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            warnings.push('LLM returned invalid JSON — falling back to local');
            return { ...generateLocal(prompt, options), warnings };
        }
    }

    // Validate
    if (typeof parsed === 'object' && parsed !== null) {
        const specCandidate = { ...(parsed as Record<string, unknown>), id: options.id, version: '1' } as PageSpecV1;
        if (validatePageSpec(specCandidate)) {
            let spec = specCandidate;
            if (options.catalog) {
                spec = resolvePageSpecWithCatalog(spec, options.catalog);
            }
            return { spec, mode: 'llm', intent, warnings };
        }
        warnings.push('LLM output failed PageSpecV1 validation — falling back to local');
    } else {
        warnings.push('LLM returned non-object — falling back to local');
    }

    return { ...generateLocal(prompt, options), warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a PageSpecV1 from a natural language prompt.
 *
 * If `options.llm` is provided, tries LLM first with automatic fallback to local.
 * Without `options.llm`, uses rule-based local generation (always works).
 *
 * @example
 * ```ts
 * // Local mode (no API needed)
 * const result = await generatePageSpec(
 *   "Landing page per un ristorante con hero, 3 card e CTA",
 *   { id: 'restaurant-landing' }
 * );
 *
 * // LLM mode (with fallback)
 * const result = await generatePageSpec(
 *   "Landing page per un ristorante con hero, 3 card e CTA",
 *   { id: 'restaurant-landing', llm: myLlmFunction }
 * );
 * ```
 */
export async function generatePageSpec(
    prompt: string,
    options: GeneratePageOptions,
): Promise<GeneratePageResult> {
    if (options.llm) {
        return generateWithLlm(prompt, { ...options, llm: options.llm });
    }
    return generateLocal(prompt, options);
}

/**
 * Synchronous local-only generation. Useful when you don't need LLM.
 */
export function generatePageSpecLocal(
    prompt: string,
    options: Omit<GeneratePageOptions, 'llm'>,
): GeneratePageResult {
    return generateLocal(prompt, options);
}

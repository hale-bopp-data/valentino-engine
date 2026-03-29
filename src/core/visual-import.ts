/**
 * Visual Import — Screenshot/image → PageSpecV1 via LLM vision.
 * Feature #784 (Il Sarto Copia), PBI #785 (Screenshot Import MVP).
 *
 * Sends an image to a vision-capable LLM and receives a structured
 * PageSpecV1 mapped to Valentino's closed registry of 19 section types.
 *
 * Pure functions + async LLM call. No DOM, no fs.
 */

import type { PageSpecV1, SectionSpec } from './types.js';
import { validatePageSpec } from './page-spec.js';
import { COCKPIT_SECTION_TYPES } from './cockpit-api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VisualImportResult = {
    success: boolean;
    spec: PageSpecV1 | null;
    warnings: string[];
    /** Sections the LLM identified in the image */
    detectedSections?: string[];
    /** Raw LLM response (for debugging) */
    rawResponse?: string;
};

export type VisualImportOptions = {
    /** Page ID for the generated spec */
    id: string;
    /** Profile hint (optional — LLM will infer if not provided) */
    profile?: string;
    /** Language hint for i18n keys */
    language?: string;
};

export type VisionLlmCallback = (
    systemPrompt: string,
    userPrompt: string,
    imageBase64: string,
    mimeType: string,
) => Promise<string>;

// ---------------------------------------------------------------------------
// Vision prompt
// ---------------------------------------------------------------------------

const SECTION_TYPES_DOC = COCKPIT_SECTION_TYPES.map(t => {
    const desc: Record<string, string> = {
        'hero': 'Large header with title, tagline, CTA. Fields: titleKey, taglineKey, eyebrowKey, cta',
        'cards': 'Grid of feature/service cards. Fields: titleKey, variant:"catalog", items[{titleKey, descKey, iconText}]',
        'cta': 'Call-to-action banner. Fields: titleKey, bodyKey, primary{labelKey, action}',
        'stats': 'Numeric metrics row. Fields: items[{valueKey, labelKey}]',
        'how-it-works': 'Step-by-step process. Fields: titleKey, steps[{numKey, titleKey, descKey}]',
        'form': 'Contact/signup form. Fields: titleKey, submitKey, fields[{name, type, labelKey}]',
        'comparison': 'Side-by-side comparison. Fields: titleKey, left{titleKey, itemsKeys[]}, right{...}',
        'manifesto': 'Long-form content block. Fields: contentPrefix',
        'spacer': 'Visual spacing. Fields: size:"sm"|"md"|"lg"',
        'advisor': 'Chat/advisor input. Fields: titleKey, submitKey, prompts[]',
        'mermaid-diagram': 'Code diagram. Fields: mermaidCode',
        'data-list': 'Data table. Fields: dataUrl, columns[{key, labelKey}]',
        'action-form': 'Action form with API submit. Fields: titleKey, submitUrl, fields[]',
        'showcase-intro': 'Showcase intro text. Fields: titleKey, descriptionKey',
        'component-showcase': 'Component gallery. Fields: components[]',
        'agent-dashboard': 'Agent status dashboard. Fields: titleKey',
        'agent-graph': 'Agent relationship graph. Fields: titleKey',
        'agent-list': 'Agent listing. Fields: titleKey',
        'valentino-catalog': 'Template catalog browser. Fields: titleKey',
    };
    return `- ${t}: ${desc[t] || 'Section type'}`;
}).join('\n');

const SYSTEM_PROMPT = `You are Valentino's Visual Import engine. You analyze screenshots of web pages and generate structured PageSpecV1 JSON.

RULES:
1. Return ONLY valid JSON — no markdown fences, no explanation, no text before or after
2. The JSON must be a valid PageSpecV1 object with version:"1", id, and sections array
3. You can ONLY use these section types (closed registry):
${SECTION_TYPES_DOC}

4. Each section MUST have a "type" field matching one of the above
5. Use descriptive i18n keys like "page.<context>.<section>.<field>" for all text
6. Set presentation tokens on each section:
   - surface: "default"|"muted"|"accent"|"dark"|"shell-dark"|"reading-light"|"ops-light"
   - rhythmProfile: "hero"|"transition"|"feature"|"reading"|"proof"|"metrics"|"ops"
7. Analyze the visual hierarchy: identify hero/header first, then content sections top-to-bottom
8. Map visual patterns to the closest section type (e.g., pricing grid → cards, testimonials → cards, FAQ → how-it-works)
9. If you see a form, map it to "form" with appropriate fields
10. Extract actual text content into the key values where visible

PROFILE DETECTION:
- If the page looks like a homepage/landing → profile: "home-signature"
- If it's a product/service page → profile: "product-surface"
- If it's content-heavy/blog → profile: "reading-manifesto"
- If it's a form/conversion page → profile: "conversion-form"`;

// ---------------------------------------------------------------------------
// Import logic
// ---------------------------------------------------------------------------

function buildUserPrompt(options: VisualImportOptions): string {
    const parts = [
        'Analyze this screenshot and generate a PageSpecV1 JSON.',
        '',
        `Page ID: "${options.id}"`,
    ];

    if (options.profile) {
        parts.push(`Profile hint: "${options.profile}"`);
    }

    if (options.language) {
        parts.push(`Language for i18n keys: ${options.language}`);
    }

    parts.push('');
    parts.push('Identify each visual section from top to bottom and map to the closest section type.');
    parts.push('Return ONLY the JSON.');

    return parts.join('\n');
}

function cleanLlmResponse(raw: string): string {
    return raw
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
}

function validateAndFixSpec(parsed: unknown, options: VisualImportOptions): { spec: PageSpecV1; warnings: string[] } {
    const warnings: string[] = [];

    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('LLM returned non-object');
    }

    const raw = parsed as Record<string, unknown>;

    // Ensure required fields
    const spec: PageSpecV1 = {
        version: '1',
        id: options.id,
        profile: (raw.profile as any) || undefined,
        sections: [],
    };

    if (!Array.isArray(raw.sections)) {
        throw new Error('LLM response missing sections array');
    }

    // Validate and filter sections
    for (const section of raw.sections) {
        if (typeof section !== 'object' || section === null) continue;
        const s = section as Record<string, unknown>;

        if (!s.type || typeof s.type !== 'string') {
            warnings.push('Skipped section without type');
            continue;
        }

        if (!COCKPIT_SECTION_TYPES.includes(s.type as string)) {
            warnings.push(`Skipped unknown section type: ${s.type}`);
            continue;
        }

        spec.sections.push(section as SectionSpec);
    }

    if (spec.sections.length === 0) {
        warnings.push('No valid sections after filtering — adding default hero');
        spec.sections.push({
            type: 'hero',
            titleKey: `page.${options.id}.hero.title`,
            presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
        });
    }

    // Final validation
    if (!validatePageSpec(spec)) {
        warnings.push('Generated spec failed validation — check section structure');
    }

    return { spec, warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import a screenshot/image and generate a PageSpecV1.
 *
 * @param imageBase64 - Base64-encoded image data (without data: prefix)
 * @param mimeType - Image MIME type (e.g., "image/png", "image/jpeg")
 * @param llm - Vision LLM callback
 * @param options - Import options (id, profile hint, language)
 */
export async function importFromImage(
    imageBase64: string,
    mimeType: string,
    llm: VisionLlmCallback,
    options: VisualImportOptions,
): Promise<VisualImportResult> {
    const warnings: string[] = [];

    try {
        const userPrompt = buildUserPrompt(options);
        const raw = await llm(SYSTEM_PROMPT, userPrompt, imageBase64, mimeType);
        const cleaned = cleanLlmResponse(raw);

        let parsed: unknown;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return {
                success: false,
                spec: null,
                warnings: ['LLM returned invalid JSON'],
                rawResponse: cleaned.substring(0, 500),
            };
        }

        const { spec, warnings: fixWarnings } = validateAndFixSpec(parsed, options);
        warnings.push(...fixWarnings);

        const detectedSections = spec.sections.map(s => s.type);

        return {
            success: true,
            spec,
            warnings,
            detectedSections,
        };
    } catch (err) {
        return {
            success: false,
            spec: null,
            warnings: [`Import failed: ${err instanceof Error ? err.message : String(err)}`],
        };
    }
}

/**
 * Create a VisionLlmCallback that calls OpenRouter with vision support.
 */
export function createVisionCallback(apiKey: string, model?: string): VisionLlmCallback {
    const visionModel = model || 'anthropic/claude-sonnet-4-6';
    const baseUrl = 'https://openrouter.ai/api/v1';

    return async (systemPrompt: string, userPrompt: string, imageBase64: string, mimeType: string): Promise<string> => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://valentino-engine.dev',
                'X-Title': 'Valentino Visual Import',
            },
            body: JSON.stringify({
                model: visionModel,
                max_tokens: 4096,
                temperature: 0.1,
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`,
                                },
                            },
                        ],
                    },
                ],
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Vision API error ${response.status}: ${text}`);
        }

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Vision API returned empty response');
        return content;
    };
}

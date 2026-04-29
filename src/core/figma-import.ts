/**
 * Figma Import — Figma REST API → Valentino PageSpec V1.
 * PBI #1671 (Figma bridge, provider pattern).
 *
 * Pure functions: no I/O. Caller provides Figma JSON response.
 * Maps Figma nodes → PageSpec sections, styles → tokens.
 * Zero runtime dependencies on Figma SDK — uses REST API JSON only.
 */

import type { PageSpecV1, SectionSpec, HeroSection, CardsSection, CtaSection, FormSection, CardsCatalogItem, CtaSpec, SectionPresentationSpec } from './types.js';

// ─── Figma REST API response types (partial, what we need) ─────────────────

export type FigmaNode = {
    id: string;
    name: string;
    type: string;
    visible?: boolean;
    children?: FigmaNode[];
    // TEXT
    characters?: string;
    style?: FigmaStyleRef;
    // GEOMETRY
    absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
    fills?: FigmaPaint[];
    strokes?: FigmaPaint[];
    cornerRadius?: number;
    // AUTO-LAYOUT
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    itemSpacing?: number;
    // COMPONENT
    componentId?: string;
    componentPropertyReferences?: Record<string, string>;
};

export type FigmaStyleRef = {
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: string;
    fills?: FigmaPaint[];
};

export type FigmaPaint = {
    type: 'SOLID' | 'GRADIENT_LINEAR' | 'IMAGE';
    color?: { r: number; g: number; b: number; a: number };
    opacity?: number;
    visible?: boolean;
};

export type FigmaDocument = {
    name: string;
    document: {
        children: FigmaNode[];   // Pages (canvas)
    };
};

export type FigmaImportOptions = {
    /** Template id for PageSpec (default: 'corporate') */
    template?: string;
    /** Image base URL for exported Figma assets */
    assetBaseUrl?: string;
    /** Page name filter (only import matching pages) */
    pageFilter?: string;
};

export type FigmaImportResult = {
    pageSpec: PageSpecV1;
    warnings: string[];
    stats: {
        framesTotal: number;
        sectionsCreated: number;
        tokensExtracted: number;
    };
};

// ─── Color utilities ───────────────────────────────────────────────────────

function figmaColorToHex(color: { r: number; g: number; b: number }): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function pxToRhythmToken(px: number): string {
    const map: Record<number, string> = {
        0: '0',
        4: 'var(--space-xs)',
        8: 'var(--space-sm)',
        12: 'var(--space-md)',
        16: 'var(--space)',
        20: 'var(--space-lg)',
        24: 'var(--space-xl)',
        32: 'var(--space-2xl)',
        40: 'var(--space-3xl)',
        48: 'var(--space-4xl)',
        64: 'var(--space-5xl)',
        80: 'var(--space-6xl)',
    };
    return map[px] || `${px}px`;
}

// ─── Node → section mapping ────────────────────────────────────────────────

function inferSectionType(node: FigmaNode): string {
    const name = node.name.toLowerCase();
    if (name.includes('hero') || node.type === 'FRAME' && isLikelyHero(node)) return 'hero';
    if (name.includes('card') || name.includes('grid')) return 'cards';
    if (name.includes('cta') || name.includes('button') || name.includes('call')) return 'cta';
    if (name.includes('form') || name.includes('input')) return 'form';
    if (name.includes('text') || name.includes('body') || name.includes('paragraph')) return 'text';
    // Default: use FRAME dimensions to guess
    if (node.absoluteBoundingBox) {
        const { width, height } = node.absoluteBoundingBox;
        if (height >= 400 && width >= 800) return 'hero';
    }
    return 'cards'; // safe default
}

function isLikelyHero(node: FigmaNode): boolean {
    if (!node.absoluteBoundingBox) return false;
    const { height } = node.absoluteBoundingBox;
    // Hero sections are typically tall and wide
    return height >= 400 && (node.children?.length ?? 0) > 0;
}

function extractCtaFromNode(node: FigmaNode): CtaSpec | undefined {
    // Look for children that look like buttons
    if (!node.children) return undefined;
    for (const child of node.children) {
        if (child.type === 'FRAME' || child.type === 'RECTANGLE') {
            const name = child.name.toLowerCase();
            if (name.includes('btn') || name.includes('button') || name.includes('cta')) {
                return {
                    labelKey: `cta.${sanitizeKey(child.name)}`,
                    action: { type: 'noop' },
                };
            }
        }
    }
    return undefined;
}

function extractTextContent(node: FigmaNode): string | undefined {
    if (node.characters) return node.characters;
    if (node.children) {
        const texts = gatherTextContent(node.children);
        return texts.length > 0 ? texts.join(' ') : undefined;
    }
    return undefined;
}

function gatherTextContent(nodes: FigmaNode[]): string[] {
    const results: string[] = [];
    for (const node of nodes) {
        if (node.characters) results.push(node.characters);
        if (node.children) results.push(...gatherTextContent(node.children));
    }
    return results;
}

function sanitizeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'untitled';
}

function extractTokens(node: FigmaNode): Record<string, string> {
    const tokens: Record<string, string> = {};
    if (node.fills) {
        for (const fill of node.fills) {
            if (fill.type === 'SOLID' && fill.color) {
                const hex = figmaColorToHex(fill.color);
                tokens[`--color-surface-${node.name.toLowerCase().replace(/\s+/g, '-')}`] = hex;
            }
        }
    }
    if (node.style?.fontSize) {
        tokens[`--font-size-${sanitizeKey(node.name)}`] = `${node.style.fontSize}px`;
    }
    return tokens;
}

function extractPresentation(node: FigmaNode): SectionPresentationSpec {
    const pres: SectionPresentationSpec = {};
    if (node.absoluteBoundingBox) {
        // Nothing to set here that's presentation-worthy from base geometry alone
    }
    if (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom) {
        // Auto-layout hints
    }
    return pres;
}

// ─── Node-to-section converter ─────────────────────────────────────────────

function nodeToSection(node: FigmaNode, assetBaseUrl?: string): SectionSpec {
    const sectionType = inferSectionType(node);
    const key = sanitizeKey(node.name);
    const presentation = extractPresentation(node);

    switch (sectionType) {
        case 'hero': {
            const hero: HeroSection = {
                type: 'hero',
                titleKey: `page.${key}.title`,
                ...presentation,
            };
            const textContent = extractTextContent(node);
            if (textContent) hero.taglineKey = `page.${key}.tagline`;
            const cta = extractCtaFromNode(node);
            if (cta) hero.cta = cta;
            return hero;
        }
        case 'cards': {
            const cards: CardsSection = {
                type: 'cards',
                variant: 'catalog',
                titleKey: `page.${key}.title`,
                items: [],
                ...presentation,
            };
            // Map child frames to card items
            if (node.children) {
                for (const child of node.children) {
                    if (child.type === 'FRAME' || child.type === 'RECTANGLE') {
                        const childText = extractTextContent(child);
                        if (childText) {
                            cards.items.push({
                                titleKey: `page.${key}.item.${sanitizeKey(child.name)}`,
                            });
                        }
                    }
                }
            }
            // Ensure at least one item
            if (cards.items.length === 0) {
                cards.items.push({ titleKey: `page.${key}.default` });
            }
            return cards;
        }
        case 'cta': {
            const ctaSec: CtaSection = {
                type: 'cta',
                titleKey: `page.${key}.title`,
                ...presentation,
            };
            const textContent = extractTextContent(node);
            if (textContent) ctaSec.bodyKey = `page.${key}.body`;
            const cta = extractCtaFromNode(node);
            if (cta) ctaSec.primary = cta;
            return ctaSec;
        }
        case 'form': {
            const form: FormSection = {
                type: 'form',
                titleKey: `page.${key}.title`,
                fields: [],
                submitKey: `page.${key}.submit`,
                ...presentation,
            };
            return form;
        }
        case 'text':
        default: {
            // Use CtaSection for text-like content (has titleKey + bodyKey)
            const text: CtaSection = {
                type: 'cta',
                titleKey: `page.${key}.title`,
                ...presentation,
            };
            const textContent = extractTextContent(node);
            if (textContent) text.bodyKey = `page.${key}.body`;
            return text;
        }
    }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Convert a Figma document (REST API JSON) to a Valentino PageSpec V1.
 * Pure function — caller provides the parsed Figma JSON.
 */
export function figmaToPageSpec(
    figmaDoc: FigmaDocument,
    options: FigmaImportOptions = {},
): FigmaImportResult {
    const warnings: string[] = [];
    const tokens: Record<string, string> = {};
    const sections: SectionSpec[] = [];

    const pages = figmaDoc.document.children || [];
    let framesTotal = 0;

    for (const page of pages) {
        if (page.type !== 'CANVAS') continue;
        if (options.pageFilter && !page.name.toLowerCase().includes(options.pageFilter.toLowerCase())) continue;

        const children = page.children || [];
        for (const node of children) {
            if (node.visible === false) continue;
            if (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE') continue;

            framesTotal++;

            try {
                const section = nodeToSection(node, options.assetBaseUrl);
                sections.push(section);

                // Extract design tokens
                Object.assign(tokens, extractTokens(node));
            } catch (e) {
                warnings.push(`Failed to convert frame "${node.name}" (${node.id}): ${String(e)}`);
            }
        }
    }

    const pageSpec: PageSpecV1 = {
        version: '1',
        id: sanitizeKey(figmaDoc.name),
        titleKey: `page.${sanitizeKey(figmaDoc.name)}.title`,
        sections,
    };

    return {
        pageSpec,
        warnings,
        stats: {
            framesTotal,
            sectionsCreated: sections.length,
            tokensExtracted: Object.keys(tokens).length,
        },
    };
}

/**
 * Fetch a Figma file via REST API and convert to PageSpec.
 * Requires figmaApiKey and fileKey.
 */
export async function fetchFigmaFile(fileKey: string, token: string): Promise<FigmaDocument> {
    const url = `https://api.figma.com/v1/files/${fileKey}`;
    const response = await fetch(url, {
        headers: { 'X-Figma-Token': token },
    });
    if (!response.ok) {
        throw new Error(`Figma API error ${response.status}: ${response.statusText}`);
    }
    return response.json() as Promise<FigmaDocument>;
}

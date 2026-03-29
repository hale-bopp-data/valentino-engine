/**
 * JSON Schema Export — Generate JSON Schema from Valentino type system.
 * Feature #778 (Il Sarto Parla), PBI #779 (Phase 0).
 *
 * Provides machine-readable schemas for external consumers (LLMs, validators,
 * CLI tools). These schemas mirror the TypeScript types in types.ts but are
 * runtime-accessible as plain JSON objects.
 *
 * Pure functions, no I/O.
 */

// ---------------------------------------------------------------------------
// Shared schema fragments
// ---------------------------------------------------------------------------

const actionSchema = {
    type: 'object',
    oneOf: [
        {
            properties: {
                type: { const: 'link' },
                href: { type: 'string' },
            },
            required: ['type', 'href'],
        },
        {
            properties: { type: { const: 'noop' } },
            required: ['type'],
        },
    ],
} as const;

const ctaSchema = {
    type: 'object',
    properties: {
        labelKey: { type: 'string' },
        action: actionSchema,
    },
    required: ['labelKey', 'action'],
} as const;

const presentationSchema = {
    type: 'object',
    properties: {
        surface: { type: 'string', enum: ['default', 'muted', 'accent', 'dark', 'shell-dark', 'reading-light', 'ops-light'] },
        surfaceScreen: { type: 'string', enum: ['none', 'soft', 'immersive', 'inherit'] },
        seamProfile: { type: 'string', enum: ['none', 'hero-intro-merge', 'hero-to-light'] },
        seamDensity: { type: 'string', enum: ['default', 'immersive'] },
        surfaceEntry: { type: 'string', enum: ['slab', 'bleed', 'floating'] },
        surfaceOverlap: { type: 'string', enum: ['none', 'sm', 'md', 'lg'] },
        contentLift: { type: 'string', enum: ['none', 'sm', 'md', 'lg'] },
        visualStage: { type: 'string' },
        height: { type: 'string', enum: ['content', 'screen-sm', 'screen-md', 'screen-full'] },
        tone: { type: 'string', enum: ['default', 'elevated', 'immersive'] },
        rhythmProfile: { type: 'string', enum: ['hero', 'transition', 'feature', 'reading', 'proof', 'metrics', 'ops'] },
        rhythmGroup: { type: 'string' },
        presetId: { type: 'string' },
        transitionProfileId: { type: 'string' },
    },
} as const;

const animationSchema = {
    type: 'object',
    properties: {
        entrance: { type: 'string', enum: ['fade-up', 'fade-in', 'slide-left', 'slide-right', 'scale-in', 'none'] },
        delay: { type: 'string', enum: ['none', 'stagger'] },
        trigger: { type: 'string', enum: ['viewport', 'immediate'] },
        duration: { type: 'number' },
    },
} as const;

const presentationBase = {
    presentation: presentationSchema,
    animation: animationSchema,
} as const;

// ---------------------------------------------------------------------------
// Section schemas (one per type)
// ---------------------------------------------------------------------------

const heroSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'hero' },
        titleKey: { type: 'string' },
        eyebrowKey: { type: 'string' },
        taglineKey: { type: 'string' },
        supportKey: { type: 'string' },
        mottoKey: { type: 'string' },
        layout: { type: 'string', enum: ['default', 'split'] },
        layoutMode: { type: 'string', enum: ['stack', 'split', 'stage-right'] },
        primaryFocus: { type: 'string', enum: ['copy', 'action-box', 'balanced'] },
        heroPanel: { type: 'string', enum: ['none', 'inline', 'right-box'] },
        foldVisibility: { type: 'string', enum: ['immediate', 'scroll'] },
        visualAssetPath: { type: 'string' },
        cta: ctaSchema,
        ctaSecondary: ctaSchema,
        ...presentationBase,
    },
    required: ['type', 'titleKey'],
} as const;

const cardsSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'cards' },
        variant: { const: 'catalog' },
        titleKey: { type: 'string' },
        descKey: { type: 'string' },
        density: { type: 'string', enum: ['default', 'compact'] },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    titleKey: { type: 'string' },
                    descKey: { type: 'string' },
                    iconText: { type: 'string' },
                    badgeKey: { type: 'string' },
                },
                required: ['titleKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'variant', 'items'],
} as const;

const ctaSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'cta' },
        titleKey: { type: 'string' },
        bodyKey: { type: 'string' },
        primary: ctaSchema,
        secondary: ctaSchema,
        ...presentationBase,
    },
    required: ['type', 'titleKey'],
} as const;

const statsSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'stats' },
        titleKey: { type: 'string' },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    valueKey: { type: 'string' },
                    labelKey: { type: 'string' },
                },
                required: ['valueKey', 'labelKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'items'],
} as const;

const howItWorksSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'how-it-works' },
        titleKey: { type: 'string' },
        subtitleKey: { type: 'string' },
        steps: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    numKey: { type: 'string' },
                    titleKey: { type: 'string' },
                    descKey: { type: 'string' },
                },
                required: ['numKey', 'titleKey', 'descKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'steps'],
} as const;

const formSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'form' },
        titleKey: { type: 'string' },
        leadKey: { type: 'string' },
        variant: { type: 'string', enum: ['demo'] },
        submitKey: { type: 'string' },
        consentKey: { type: 'string' },
        fields: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['text', 'email', 'select', 'textarea', 'checkbox'] },
                    labelKey: { type: 'string' },
                    required: { type: 'boolean' },
                    width: { type: 'string', enum: ['half', 'full'] },
                },
                required: ['name', 'type', 'labelKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'titleKey', 'submitKey', 'fields'],
} as const;

const comparisonSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'comparison' },
        titleKey: { type: 'string' },
        subtitleKey: { type: 'string' },
        left: {
            type: 'object',
            properties: {
                titleKey: { type: 'string' },
                itemsKeys: { type: 'array', items: { type: 'string' } },
            },
            required: ['titleKey', 'itemsKeys'],
        },
        right: {
            type: 'object',
            properties: {
                titleKey: { type: 'string' },
                itemsKeys: { type: 'array', items: { type: 'string' } },
            },
            required: ['titleKey', 'itemsKeys'],
        },
        ...presentationBase,
    },
    required: ['type', 'titleKey', 'left', 'right'],
} as const;

const manifestoSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'manifesto' },
        contentPrefix: { type: 'string' },
        ctaLabelKey: { type: 'string' },
        ctaHref: { type: 'string' },
        ...presentationBase,
    },
    required: ['type'],
} as const;

const spacerSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'spacer' },
        size: { type: 'string', enum: ['sm', 'md', 'lg'] },
        ...presentationBase,
    },
    required: ['type'],
} as const;

const advisorSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'advisor' },
        titleKey: { type: 'string' },
        leadKey: { type: 'string' },
        submitKey: { type: 'string' },
        submitUrl: { type: 'string' },
        fallbackTitleKey: { type: 'string' },
        fallbackBodyKey: { type: 'string' },
        prompts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    labelKey: { type: 'string' },
                    answerTitleKey: { type: 'string' },
                    answerBodyKey: { type: 'string' },
                },
                required: ['id', 'labelKey', 'answerTitleKey', 'answerBodyKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'titleKey', 'submitKey', 'fallbackTitleKey', 'fallbackBodyKey', 'prompts'],
} as const;

const dataListSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'data-list' },
        titleKey: { type: 'string' },
        dataUrl: { type: 'string' },
        columns: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    key: { type: 'string' },
                    labelKey: { type: 'string' },
                    format: { type: 'string', enum: ['datetime', 'date', 'currency'] },
                },
                required: ['key', 'labelKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'dataUrl', 'columns'],
} as const;

const actionFormSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'action-form' },
        titleKey: { type: 'string' },
        submitUrl: { type: 'string' },
        submitKey: { type: 'string' },
        successKey: { type: 'string' },
        fields: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['text', 'email', 'number', 'date', 'datetime-local', 'textarea'] },
                    labelKey: { type: 'string' },
                    required: { type: 'boolean' },
                },
                required: ['name', 'type', 'labelKey'],
            },
        },
        ...presentationBase,
    },
    required: ['type', 'titleKey', 'submitUrl', 'submitKey', 'successKey', 'fields'],
} as const;

const mermaidDiagramSectionSchema = {
    type: 'object',
    properties: {
        type: { const: 'mermaid-diagram' },
        titleKey: { type: 'string' },
        descKey: { type: 'string' },
        mermaidCode: { type: 'string' },
        height: { type: 'string', enum: ['auto', 'sm', 'md', 'lg'] },
        ...presentationBase,
    },
    required: ['type', 'mermaidCode'],
} as const;

// ---------------------------------------------------------------------------
// Section schema registry
// ---------------------------------------------------------------------------

const SECTION_SCHEMAS: Record<string, object> = {
    hero: heroSectionSchema,
    cards: cardsSectionSchema,
    cta: ctaSectionSchema,
    stats: statsSectionSchema,
    'how-it-works': howItWorksSectionSchema,
    form: formSectionSchema,
    comparison: comparisonSectionSchema,
    manifesto: manifestoSectionSchema,
    spacer: spacerSectionSchema,
    advisor: advisorSectionSchema,
    'data-list': dataListSectionSchema,
    'action-form': actionFormSectionSchema,
    'mermaid-diagram': mermaidDiagramSectionSchema,
};

// ---------------------------------------------------------------------------
// PageSpecV1 schema
// ---------------------------------------------------------------------------

const pageSpecV1Schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'valentino-engine/PageSpecV1',
    title: 'PageSpecV1',
    description: 'Valentino page specification — single source of truth for page structure and content.',
    type: 'object',
    properties: {
        version: { const: '1' },
        id: { type: 'string' },
        profile: {
            type: 'string',
            enum: ['home-signature', 'product-surface', 'advisor-surface', 'conversion-form', 'reading-manifesto', 'use-case-hub'],
        },
        templateId: { type: 'string' },
        blueprintId: { type: 'string' },
        sourcePageId: { type: 'string' },
        activeNav: { type: 'string' },
        titleKey: { type: 'string' },
        themeId: { type: 'string' },
        chrome: {
            type: 'object',
            properties: {
                floatingDock: { type: 'boolean' },
            },
        },
        sections: {
            type: 'array',
            items: {
                oneOf: Object.values(SECTION_SCHEMAS),
            },
        },
    },
    required: ['version', 'id', 'sections'],
} as const;

// ---------------------------------------------------------------------------
// Cockpit action schema
// ---------------------------------------------------------------------------

const cockpitActionSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'valentino-engine/CockpitAction',
    title: 'CockpitAction',
    description: 'Structured action for the Valentino Conversational Cockpit. An LLM produces this, the engine executes it.',
    oneOf: [
        {
            type: 'object',
            properties: {
                action: { const: 'add-section' },
                section: { oneOf: Object.values(SECTION_SCHEMAS) },
                atIndex: { type: 'number' },
            },
            required: ['action', 'section'],
        },
        {
            type: 'object',
            properties: {
                action: { const: 'edit-section' },
                sectionIndex: { type: 'number' },
                patch: { type: 'object' },
            },
            required: ['action', 'sectionIndex', 'patch'],
        },
        {
            type: 'object',
            properties: {
                action: { const: 'remove-section' },
                sectionIndex: { type: 'number' },
            },
            required: ['action', 'sectionIndex'],
        },
        {
            type: 'object',
            properties: {
                action: { const: 'move-section' },
                fromIndex: { type: 'number' },
                toIndex: { type: 'number' },
            },
            required: ['action', 'fromIndex', 'toIndex'],
        },
        {
            type: 'object',
            properties: {
                action: { const: 'edit-page' },
                patch: { type: 'object' },
            },
            required: ['action', 'patch'],
        },
        {
            type: 'object',
            properties: {
                action: { const: 'query' },
                query: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['list-sections', 'get-section', 'describe-page', 'list-section-types', 'get-editor-schema', 'validate'],
                        },
                    },
                    required: ['type'],
                },
            },
            required: ['action', 'query'],
        },
    ],
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the JSON Schema for PageSpecV1.
 */
export function getPageSpecSchema(): object {
    return structuredClone(pageSpecV1Schema);
}

/**
 * Get the JSON Schema for CockpitAction.
 */
export function getCockpitActionSchema(): object {
    return structuredClone(cockpitActionSchema);
}

/**
 * Get the JSON Schema for a specific section type.
 * Returns null if the section type is not found.
 */
export function getSectionSchema(sectionType: string): object | null {
    const schema = SECTION_SCHEMAS[sectionType];
    return schema ? structuredClone(schema) : null;
}

/**
 * Get all section schemas as a map.
 */
export function getAllSectionSchemas(): Record<string, object> {
    return structuredClone(SECTION_SCHEMAS);
}

/**
 * Get the list of section types that have JSON Schema definitions.
 */
export function getSchemaDefinedSectionTypes(): string[] {
    return Object.keys(SECTION_SCHEMAS);
}

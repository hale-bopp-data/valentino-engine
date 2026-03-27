/**
 * Editor utilities — Pure functions for visual page spec editing.
 * PBI #602 — Editor visuale non-tecnico.
 *
 * Provides:
 * - generateEditorSchema(sectionType) — JSON-like schema for form generation
 * - applySectionPatch(spec, sectionIndex, patch) — immutable update + validation
 * - getEditableSectionTypes() — list of section types supported by editor
 */

import type {
    PageSpecV1,
    SectionSpec,
    SectionPresentationSpec,
    AnimationSpec,
} from './types.js';
import { validatePageSpec } from './page-spec.js';

// ---------------------------------------------------------------------------
// Editor field schema types
// ---------------------------------------------------------------------------

export type EditorFieldType =
    | 'string'
    | 'text'       // multiline
    | 'number'
    | 'boolean'
    | 'enum'
    | 'array'
    | 'object'
    | 'json';      // raw JSON (for advanced users)

export type EditorFieldSpec = {
    key: string;
    label: string;
    type: EditorFieldType;
    required?: boolean;
    enumValues?: string[];
    defaultValue?: unknown;
    group?: string;           // UI grouping (e.g. "content", "presentation", "advanced")
    description?: string;
    /** For array fields: schema of each item */
    itemFields?: EditorFieldSpec[];
    /** For object fields: nested fields */
    children?: EditorFieldSpec[];
};

export type EditorSectionSchema = {
    sectionType: string;
    label: string;
    fields: EditorFieldSpec[];
};

// ---------------------------------------------------------------------------
// Shared field definitions (reusable across section types)
// ---------------------------------------------------------------------------

const presentationFields: EditorFieldSpec[] = [
    { key: 'presentation.surface', label: 'Surface', type: 'enum', enumValues: ['default', 'muted', 'accent', 'dark', 'shell-dark', 'reading-light', 'ops-light'], group: 'presentation' },
    { key: 'presentation.surfaceScreen', label: 'Surface Screen', type: 'enum', enumValues: ['none', 'soft', 'immersive', 'inherit'], group: 'presentation' },
    { key: 'presentation.height', label: 'Height', type: 'enum', enumValues: ['content', 'screen-sm', 'screen-md', 'screen-full'], group: 'presentation' },
    { key: 'presentation.tone', label: 'Tone', type: 'enum', enumValues: ['default', 'elevated', 'immersive'], group: 'presentation' },
    { key: 'presentation.rhythmProfile', label: 'Rhythm Profile', type: 'enum', enumValues: ['hero', 'transition', 'feature', 'reading', 'proof', 'metrics', 'ops'], group: 'presentation' },
    { key: 'presentation.rhythmGroup', label: 'Rhythm Group', type: 'string', group: 'presentation' },
    { key: 'presentation.seamProfile', label: 'Seam Profile', type: 'enum', enumValues: ['none', 'hero-intro-merge', 'hero-to-light'], group: 'presentation' },
    { key: 'presentation.surfaceEntry', label: 'Surface Entry', type: 'enum', enumValues: ['slab', 'bleed', 'floating'], group: 'presentation' },
    { key: 'presentation.contentLift', label: 'Content Lift', type: 'enum', enumValues: ['none', 'sm', 'md', 'lg'], group: 'presentation' },
    { key: 'presentation.visualStage', label: 'Visual Stage', type: 'string', group: 'presentation' },
    { key: 'presentation.presetId', label: 'Preset ID', type: 'string', group: 'presentation' },
];

const animationFields: EditorFieldSpec[] = [
    { key: 'animation.entrance', label: 'Entrance Animation', type: 'enum', enumValues: ['fade-up', 'fade-in', 'slide-left', 'slide-right', 'scale-in', 'none'], group: 'animation' },
    { key: 'animation.delay', label: 'Delay', type: 'enum', enumValues: ['none', 'stagger'], group: 'animation' },
    { key: 'animation.trigger', label: 'Trigger', type: 'enum', enumValues: ['viewport', 'immediate'], group: 'animation' },
    { key: 'animation.duration', label: 'Duration (ms)', type: 'number', defaultValue: 400, group: 'animation' },
];

const ctaFields = (prefix: string, label: string): EditorFieldSpec[] => [
    { key: `${prefix}.labelKey`, label: `${label} Label Key`, type: 'string', group: 'content' },
    { key: `${prefix}.action.type`, label: `${label} Action Type`, type: 'enum', enumValues: ['link', 'noop'], group: 'content' },
    { key: `${prefix}.action.href`, label: `${label} Href`, type: 'string', group: 'content' },
];

// ---------------------------------------------------------------------------
// Per-section-type schema definitions
// ---------------------------------------------------------------------------

const SECTION_SCHEMAS: Record<string, () => EditorSectionSchema> = {
    hero: () => ({
        sectionType: 'hero',
        label: 'Hero',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', required: true, group: 'content' },
            { key: 'eyebrowKey', label: 'Eyebrow Key', type: 'string', group: 'content' },
            { key: 'taglineKey', label: 'Tagline Key', type: 'string', group: 'content' },
            { key: 'supportKey', label: 'Support Key', type: 'string', group: 'content' },
            { key: 'mottoKey', label: 'Motto Key', type: 'string', group: 'content' },
            { key: 'poeticAsideKey', label: 'Poetic Aside Key', type: 'string', group: 'content' },
            { key: 'layout', label: 'Layout', type: 'enum', enumValues: ['default', 'split'], group: 'layout' },
            { key: 'layoutMode', label: 'Layout Mode', type: 'enum', enumValues: ['stack', 'split', 'stage-right'], group: 'layout' },
            { key: 'primaryFocus', label: 'Primary Focus', type: 'enum', enumValues: ['copy', 'action-box', 'balanced'], group: 'layout' },
            { key: 'heroPanel', label: 'Hero Panel', type: 'enum', enumValues: ['none', 'inline', 'right-box'], group: 'layout' },
            { key: 'foldVisibility', label: 'Fold Visibility', type: 'enum', enumValues: ['immediate', 'scroll'], group: 'layout' },
            ...ctaFields('cta', 'CTA'),
            ...ctaFields('ctaSecondary', 'CTA Secondary'),
            { key: 'visualAssetPath', label: 'Visual Asset Path', type: 'string', group: 'content' },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    cards: () => ({
        sectionType: 'cards',
        label: 'Cards',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', group: 'content' },
            { key: 'descKey', label: 'Description Key', type: 'string', group: 'content' },
            { key: 'variant', label: 'Variant', type: 'enum', enumValues: ['catalog'], required: true, group: 'layout' },
            { key: 'density', label: 'Density', type: 'enum', enumValues: ['default', 'compact'], group: 'layout' },
            {
                key: 'items', label: 'Cards', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'titleKey', label: 'Title Key', type: 'string', required: true },
                    { key: 'descKey', label: 'Description Key', type: 'string' },
                    { key: 'iconText', label: 'Icon Text', type: 'string' },
                    { key: 'badgeKey', label: 'Badge Key', type: 'string' },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    comparison: () => ({
        sectionType: 'comparison',
        label: 'Comparison',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', required: true, group: 'content' },
            { key: 'subtitleKey', label: 'Subtitle Key', type: 'string', group: 'content' },
            { key: 'left.titleKey', label: 'Left Title Key', type: 'string', required: true, group: 'content' },
            { key: 'left.itemsKeys', label: 'Left Items Keys', type: 'json', required: true, group: 'content', description: 'JSON array of i18n keys' },
            { key: 'right.titleKey', label: 'Right Title Key', type: 'string', required: true, group: 'content' },
            { key: 'right.itemsKeys', label: 'Right Items Keys', type: 'json', required: true, group: 'content', description: 'JSON array of i18n keys' },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    cta: () => ({
        sectionType: 'cta',
        label: 'Call to Action',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', required: true, group: 'content' },
            { key: 'bodyKey', label: 'Body Key', type: 'string', group: 'content' },
            ...ctaFields('primary', 'Primary CTA'),
            ...ctaFields('secondary', 'Secondary CTA'),
            ...presentationFields,
            ...animationFields,
        ],
    }),

    form: () => ({
        sectionType: 'form',
        label: 'Form',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', required: true, group: 'content' },
            { key: 'leadKey', label: 'Lead Key', type: 'string', group: 'content' },
            { key: 'variant', label: 'Variant', type: 'enum', enumValues: ['demo'], group: 'layout' },
            { key: 'submitKey', label: 'Submit Label Key', type: 'string', required: true, group: 'content' },
            { key: 'consentKey', label: 'Consent Key', type: 'string', group: 'content' },
            { key: 'legalKey', label: 'Legal Key', type: 'string', group: 'content' },
            {
                key: 'fields', label: 'Form Fields', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'name', label: 'Field Name', type: 'string', required: true },
                    { key: 'type', label: 'Field Type', type: 'enum', enumValues: ['text', 'email', 'select', 'textarea', 'checkbox'], required: true },
                    { key: 'labelKey', label: 'Label Key', type: 'string', required: true },
                    { key: 'placeholderKey', label: 'Placeholder Key', type: 'string' },
                    { key: 'required', label: 'Required', type: 'boolean' },
                    { key: 'width', label: 'Width', type: 'enum', enumValues: ['half', 'full'] },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    manifesto: () => ({
        sectionType: 'manifesto',
        label: 'Manifesto',
        fields: [
            { key: 'contentPrefix', label: 'Content Prefix', type: 'string', group: 'content', description: 'i18n key prefix for manifesto paragraphs' },
            { key: 'ctaLabelKey', label: 'CTA Label Key', type: 'string', group: 'content' },
            { key: 'ctaHref', label: 'CTA Href', type: 'string', group: 'content' },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    spacer: () => ({
        sectionType: 'spacer',
        label: 'Spacer',
        fields: [
            { key: 'size', label: 'Size', type: 'enum', enumValues: ['sm', 'md', 'lg'], group: 'layout' },
            ...presentationFields,
        ],
    }),

    stats: () => ({
        sectionType: 'stats',
        label: 'Stats',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', group: 'content' },
            {
                key: 'items', label: 'Stat Items', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'valueKey', label: 'Value Key', type: 'string', required: true },
                    { key: 'labelKey', label: 'Label Key', type: 'string', required: true },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    'how-it-works': () => ({
        sectionType: 'how-it-works',
        label: 'How It Works',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', group: 'content' },
            { key: 'subtitleKey', label: 'Subtitle Key', type: 'string', group: 'content' },
            {
                key: 'steps', label: 'Steps', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'numKey', label: 'Number Key', type: 'string', required: true },
                    { key: 'titleKey', label: 'Title Key', type: 'string', required: true },
                    { key: 'descKey', label: 'Description Key', type: 'string', required: true },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    advisor: () => ({
        sectionType: 'advisor',
        label: 'Advisor',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', required: true, group: 'content' },
            { key: 'leadKey', label: 'Lead Key', type: 'string', group: 'content' },
            { key: 'promptPlaceholderKey', label: 'Prompt Placeholder Key', type: 'string', group: 'content' },
            { key: 'submitKey', label: 'Submit Key', type: 'string', required: true, group: 'content' },
            { key: 'submitUrl', label: 'Submit URL', type: 'string', group: 'content' },
            { key: 'loadingKey', label: 'Loading Key', type: 'string', group: 'content' },
            { key: 'fallbackTitleKey', label: 'Fallback Title Key', type: 'string', required: true, group: 'content' },
            { key: 'fallbackBodyKey', label: 'Fallback Body Key', type: 'string', required: true, group: 'content' },
            {
                key: 'prompts', label: 'Quick Prompts', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'id', label: 'ID', type: 'string', required: true },
                    { key: 'labelKey', label: 'Label Key', type: 'string', required: true },
                    { key: 'answerTitleKey', label: 'Answer Title Key', type: 'string', required: true },
                    { key: 'answerBodyKey', label: 'Answer Body Key', type: 'string', required: true },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    'mermaid-diagram': () => ({
        sectionType: 'mermaid-diagram',
        label: 'Mermaid Diagram',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', group: 'content' },
            { key: 'descKey', label: 'Description Key', type: 'string', group: 'content' },
            { key: 'mermaidCode', label: 'Mermaid Code', type: 'text', required: true, group: 'content' },
            { key: 'height', label: 'Height', type: 'enum', enumValues: ['auto', 'sm', 'md', 'lg'], group: 'layout' },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    'data-list': () => ({
        sectionType: 'data-list',
        label: 'Data List',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', group: 'content' },
            { key: 'dataUrl', label: 'Data URL', type: 'string', required: true, group: 'content' },
            {
                key: 'columns', label: 'Columns', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'key', label: 'Key', type: 'string', required: true },
                    { key: 'labelKey', label: 'Label Key', type: 'string', required: true },
                    { key: 'format', label: 'Format', type: 'enum', enumValues: ['datetime', 'date', 'currency'] },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),

    'action-form': () => ({
        sectionType: 'action-form',
        label: 'Action Form',
        fields: [
            { key: 'titleKey', label: 'Title Key', type: 'string', required: true, group: 'content' },
            { key: 'submitUrl', label: 'Submit URL', type: 'string', required: true, group: 'content' },
            { key: 'submitKey', label: 'Submit Label Key', type: 'string', required: true, group: 'content' },
            { key: 'successKey', label: 'Success Message Key', type: 'string', required: true, group: 'content' },
            {
                key: 'fields', label: 'Fields', type: 'array', required: true, group: 'content',
                itemFields: [
                    { key: 'name', label: 'Field Name', type: 'string', required: true },
                    { key: 'type', label: 'Field Type', type: 'enum', enumValues: ['text', 'email', 'number', 'date', 'datetime-local', 'textarea'], required: true },
                    { key: 'labelKey', label: 'Label Key', type: 'string', required: true },
                    { key: 'placeholderKey', label: 'Placeholder Key', type: 'string' },
                    { key: 'required', label: 'Required', type: 'boolean' },
                ],
            },
            ...presentationFields,
            ...animationFields,
        ],
    }),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the list of section types that the editor supports.
 */
export function getEditableSectionTypes(): string[] {
    return Object.keys(SECTION_SCHEMAS);
}

/**
 * Generates the editor schema for a given section type.
 * Returns null if the section type is not supported.
 */
export function generateEditorSchema(sectionType: string): EditorSectionSchema | null {
    const factory = SECTION_SCHEMAS[sectionType];
    return factory ? factory() : null;
}

/**
 * Returns editor schemas for all supported section types.
 */
export function generateAllEditorSchemas(): EditorSectionSchema[] {
    return Object.values(SECTION_SCHEMAS).map((factory) => factory());
}

// ---------------------------------------------------------------------------
// Section patch — immutable update
// ---------------------------------------------------------------------------

export type SectionPatchWarning = {
    field: string;
    message: string;
};

export type SectionPatchResult = {
    spec: PageSpecV1;
    warnings: SectionPatchWarning[];
};

/**
 * Deep-get a value from an object using a dot-separated path.
 */
function deepGet(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Deep-set a value in an object using a dot-separated path (immutable — returns new object).
 */
function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const parts = path.split('.');
    if (parts.length === 1) {
        return { ...obj, [parts[0]]: value };
    }
    const [head, ...rest] = parts;
    const child = (obj[head] != null && typeof obj[head] === 'object')
        ? { ...(obj[head] as Record<string, unknown>) }
        : {};
    return { ...obj, [head]: deepSet(child, rest.join('.'), value) };
}

/**
 * Apply a patch (key-value map) to a section within a PageSpec.
 * Returns a new PageSpec (immutable) + validation warnings.
 *
 * Keys use dot notation for nested fields (e.g. "presentation.surface").
 * If value is null/undefined, the field is removed.
 */
export function applySectionPatch(
    spec: PageSpecV1,
    sectionIndex: number,
    patch: Record<string, unknown>,
): SectionPatchResult {
    const warnings: SectionPatchWarning[] = [];

    if (sectionIndex < 0 || sectionIndex >= spec.sections.length) {
        return {
            spec,
            warnings: [{ field: '_index', message: `Section index ${sectionIndex} out of bounds (0..${spec.sections.length - 1})` }],
        };
    }

    // Clone sections array
    const newSections = [...spec.sections];
    let section = { ...newSections[sectionIndex] } as Record<string, unknown>;

    // Apply each patch field
    for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) {
            // Remove field — rebuild without it
            const parts = key.split('.');
            if (parts.length === 1) {
                const { [key]: _removed, ...rest } = section;
                section = rest;
            } else {
                // For nested, set to undefined and let JSON.parse(JSON.stringify) clean it
                section = deepSet(section, key, undefined);
            }
        } else {
            section = deepSet(section, key, value);
        }
    }

    // Validate: section must still have a type
    if (!section.type || typeof section.type !== 'string') {
        warnings.push({ field: 'type', message: 'Section type is missing or invalid after patch' });
    }

    // Validate: check required fields per schema
    const schema = section.type ? generateEditorSchema(section.type as string) : null;
    if (schema) {
        for (const field of schema.fields) {
            if (field.required && deepGet(section, field.key) == null) {
                warnings.push({ field: field.key, message: `Required field "${field.label}" is missing` });
            }
        }
    }

    newSections[sectionIndex] = section as SectionSpec;

    const newSpec: PageSpecV1 = {
        ...spec,
        sections: newSections,
    };

    // Final validation
    if (!validatePageSpec(newSpec)) {
        warnings.push({ field: '_spec', message: 'Patched spec failed PageSpecV1 validation' });
    }

    return { spec: newSpec, warnings };
}

/**
 * Add a new section to a PageSpec at a given index.
 * Returns the updated spec.
 */
export function addSection(
    spec: PageSpecV1,
    section: SectionSpec,
    atIndex?: number,
): PageSpecV1 {
    const newSections = [...spec.sections];
    const idx = atIndex ?? newSections.length;
    newSections.splice(idx, 0, section);
    return { ...spec, sections: newSections };
}

/**
 * Remove a section from a PageSpec by index.
 * Returns the updated spec.
 */
export function removeSection(
    spec: PageSpecV1,
    sectionIndex: number,
): PageSpecV1 {
    if (sectionIndex < 0 || sectionIndex >= spec.sections.length) return spec;
    const newSections = [...spec.sections];
    newSections.splice(sectionIndex, 1);
    return { ...spec, sections: newSections };
}

/**
 * Move a section within a PageSpec (reorder).
 * Returns the updated spec.
 */
export function moveSection(
    spec: PageSpecV1,
    fromIndex: number,
    toIndex: number,
): PageSpecV1 {
    if (fromIndex < 0 || fromIndex >= spec.sections.length) return spec;
    if (toIndex < 0 || toIndex >= spec.sections.length) return spec;
    if (fromIndex === toIndex) return spec;

    const newSections = [...spec.sections];
    const [moved] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, moved);
    return { ...spec, sections: newSections };
}

/**
 * Update page-level fields (id, titleKey, profile, themeId, chrome, seo).
 * Returns the updated spec.
 */
export function applyPagePatch(
    spec: PageSpecV1,
    patch: Partial<Omit<PageSpecV1, 'version' | 'sections'>>,
): PageSpecV1 {
    return { ...spec, ...patch, version: '1', sections: spec.sections };
}

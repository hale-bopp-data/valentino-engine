/**
 * Cockpit API — Intent-to-action layer for the Valentino Conversational Cockpit.
 * Feature #778 (Il Sarto Parla), PBI #779 (Phase 0).
 *
 * Wraps editor.ts CRUD operations with a structured intent-based interface
 * that an LLM can produce and an operator can review.
 *
 * Pure functions, no I/O, no LLM client — the consumer wires in the LLM.
 */

import type {
    PageSpecV1,
    SectionSpec,
    PagesManifestV1,
    ManifestPageV1,
    ValentinoCatalogV1,
} from './types.js';
import { validatePageSpec } from './page-spec.js';
import {
    addSection,
    removeSection,
    moveSection,
    applySectionPatch,
    applyPagePatch,
    generateEditorSchema,
    getEditableSectionTypes,
} from './editor.js';
import type { SectionPatchWarning } from './editor.js';
import { probeRhythm } from './rhythm.js';
import { probeSectionIntegrity } from './section-integrity.js';

// ---------------------------------------------------------------------------
// Action types — the structured language between LLM and engine
// ---------------------------------------------------------------------------

export type CockpitActionAddSection = {
    action: 'add-section';
    section: SectionSpec;
    atIndex?: number;
};

export type CockpitActionEditSection = {
    action: 'edit-section';
    sectionIndex: number;
    patch: Record<string, unknown>;
};

export type CockpitActionRemoveSection = {
    action: 'remove-section';
    sectionIndex: number;
};

export type CockpitActionMoveSection = {
    action: 'move-section';
    fromIndex: number;
    toIndex: number;
};

export type CockpitActionEditPage = {
    action: 'edit-page';
    patch: Partial<Omit<PageSpecV1, 'version' | 'sections'>>;
};

export type CockpitActionQuery = {
    action: 'query';
    query: CockpitQuery;
};

export type CockpitAction =
    | CockpitActionAddSection
    | CockpitActionEditSection
    | CockpitActionRemoveSection
    | CockpitActionMoveSection
    | CockpitActionEditPage
    | CockpitActionQuery;

// ---------------------------------------------------------------------------
// Query types — read-only introspection
// ---------------------------------------------------------------------------

export type CockpitQuery =
    | { type: 'list-sections' }
    | { type: 'get-section'; index: number }
    | { type: 'describe-page' }
    | { type: 'list-section-types' }
    | { type: 'get-editor-schema'; sectionType: string }
    | { type: 'validate' };

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type CockpitWarning = {
    source: 'editor' | 'rhythm' | 'integrity' | 'validation';
    message: string;
};

export type CockpitActionResult = {
    success: boolean;
    spec: PageSpecV1;
    warnings: CockpitWarning[];
    /** For query actions, the query result data */
    data?: unknown;
};

// ---------------------------------------------------------------------------
// Validation — pre-flight + post-flight checks
// ---------------------------------------------------------------------------

function collectWarnings(spec: PageSpecV1, editorWarnings: SectionPatchWarning[]): CockpitWarning[] {
    const warnings: CockpitWarning[] = [];

    for (const w of editorWarnings) {
        warnings.push({ source: 'editor', message: `${w.field}: ${w.message}` });
    }

    if (!validatePageSpec(spec)) {
        warnings.push({ source: 'validation', message: 'PageSpecV1 validation failed' });
    }

    const rhythmResult = probeRhythm(spec);
    for (const w of rhythmResult.warnings) {
        warnings.push({ source: 'rhythm', message: w.message });
    }

    const integrityResult = probeSectionIntegrity(spec.sections);
    for (const w of integrityResult.warnings) {
        warnings.push({ source: 'integrity', message: w.message });
    }

    return warnings;
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

function executeQuery(spec: PageSpecV1, query: CockpitQuery): CockpitActionResult {
    switch (query.type) {
        case 'list-sections':
            return {
                success: true,
                spec,
                warnings: [],
                data: spec.sections.map((s, i) => ({
                    index: i,
                    type: s.type,
                    ...(('titleKey' in s && s.titleKey) ? { titleKey: s.titleKey } : {}),
                })),
            };

        case 'get-section': {
            const section = spec.sections[query.index];
            if (!section) {
                return {
                    success: false,
                    spec,
                    warnings: [{ source: 'editor', message: `Section index ${query.index} out of bounds` }],
                };
            }
            return { success: true, spec, warnings: [], data: section };
        }

        case 'describe-page':
            return {
                success: true,
                spec,
                warnings: [],
                data: {
                    id: spec.id,
                    profile: spec.profile,
                    titleKey: spec.titleKey,
                    themeId: spec.themeId,
                    sectionCount: spec.sections.length,
                    sectionTypes: spec.sections.map(s => s.type),
                },
            };

        case 'list-section-types':
            return {
                success: true,
                spec,
                warnings: [],
                data: getEditableSectionTypes(),
            };

        case 'get-editor-schema': {
            const schema = generateEditorSchema(query.sectionType);
            if (!schema) {
                return {
                    success: false,
                    spec,
                    warnings: [{ source: 'editor', message: `Unknown section type: ${query.sectionType}` }],
                };
            }
            return { success: true, spec, warnings: [], data: schema };
        }

        case 'validate': {
            const warnings = collectWarnings(spec, []);
            return {
                success: warnings.length === 0,
                spec,
                warnings,
                data: { valid: warnings.length === 0, warningCount: warnings.length },
            };
        }
    }
}

// ---------------------------------------------------------------------------
// Action execution — the core cockpit engine
// ---------------------------------------------------------------------------

/**
 * Execute a cockpit action on a PageSpec.
 * Returns the (possibly updated) spec + validation warnings.
 *
 * All mutations are immutable — the original spec is never modified.
 * All mutations are validated post-execution (rhythm, integrity, spec validation).
 */
export function executeCockpitAction(
    spec: PageSpecV1,
    action: CockpitAction,
): CockpitActionResult {
    switch (action.action) {
        case 'add-section': {
            const newSpec = addSection(spec, action.section, action.atIndex);
            const warnings = collectWarnings(newSpec, []);
            return { success: true, spec: newSpec, warnings };
        }

        case 'edit-section': {
            const { spec: newSpec, warnings: editorWarnings } = applySectionPatch(
                spec,
                action.sectionIndex,
                action.patch,
            );
            const warnings = collectWarnings(newSpec, editorWarnings);
            return { success: editorWarnings.length === 0, spec: newSpec, warnings };
        }

        case 'remove-section': {
            if (action.sectionIndex < 0 || action.sectionIndex >= spec.sections.length) {
                return {
                    success: false,
                    spec,
                    warnings: [{ source: 'editor', message: `Section index ${action.sectionIndex} out of bounds` }],
                };
            }
            const newSpec = removeSection(spec, action.sectionIndex);
            const warnings = collectWarnings(newSpec, []);
            return { success: true, spec: newSpec, warnings };
        }

        case 'move-section': {
            const newSpec = moveSection(spec, action.fromIndex, action.toIndex);
            if (newSpec === spec) {
                return {
                    success: false,
                    spec,
                    warnings: [{ source: 'editor', message: `Invalid move: ${action.fromIndex} → ${action.toIndex}` }],
                };
            }
            const warnings = collectWarnings(newSpec, []);
            return { success: true, spec: newSpec, warnings };
        }

        case 'edit-page': {
            const newSpec = applyPagePatch(spec, action.patch);
            const warnings = collectWarnings(newSpec, []);
            return { success: true, spec: newSpec, warnings };
        }

        case 'query':
            return executeQuery(spec, action.query);
    }
}

// ---------------------------------------------------------------------------
// Batch execution — multiple actions in sequence
// ---------------------------------------------------------------------------

export type CockpitBatchResult = {
    spec: PageSpecV1;
    results: CockpitActionResult[];
    totalWarnings: number;
};

/**
 * Execute multiple cockpit actions in sequence.
 * Each action operates on the result of the previous one.
 * Stops on first failure unless `continueOnError` is true.
 */
export function executeCockpitBatch(
    spec: PageSpecV1,
    actions: CockpitAction[],
    continueOnError = false,
): CockpitBatchResult {
    let currentSpec = spec;
    const results: CockpitActionResult[] = [];
    let totalWarnings = 0;

    for (const action of actions) {
        const result = executeCockpitAction(currentSpec, action);
        results.push(result);
        totalWarnings += result.warnings.length;
        currentSpec = result.spec;

        if (!result.success && !continueOnError) break;
    }

    return { spec: currentSpec, results, totalWarnings };
}

// ---------------------------------------------------------------------------
// Action description — human-readable summary for operator review
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable description of a cockpit action.
 * Useful for showing the operator what the LLM intends to do before executing.
 */
export function describeCockpitAction(action: CockpitAction): string {
    switch (action.action) {
        case 'add-section':
            return `Add ${action.section.type} section${action.atIndex != null ? ` at position ${action.atIndex}` : ' at the end'}`;
        case 'edit-section':
            return `Edit section #${action.sectionIndex}: update ${Object.keys(action.patch).join(', ')}`;
        case 'remove-section':
            return `Remove section #${action.sectionIndex}`;
        case 'move-section':
            return `Move section from position ${action.fromIndex} to ${action.toIndex}`;
        case 'edit-page':
            return `Edit page properties: ${Object.keys(action.patch).join(', ')}`;
        case 'query':
            return `Query: ${action.query.type}`;
    }
}

// ---------------------------------------------------------------------------
// Action parsing — parse natural language intent into structured action
// ---------------------------------------------------------------------------

/**
 * Registry of all valid section types for the cockpit.
 * Used for validation and LLM context.
 */
export const COCKPIT_SECTION_TYPES: readonly string[] = [
    'hero', 'cards', 'comparison', 'cta', 'form', 'manifesto', 'spacer',
    'showcase-intro', 'component-showcase',
    'agent-dashboard', 'agent-graph', 'agent-list',
    'data-list', 'action-form',
    'stats', 'how-it-works',
    'advisor', 'mermaid-diagram', 'valentino-catalog',
] as const;

/**
 * Validate that a cockpit action is structurally correct before execution.
 * Returns a list of validation errors (empty = valid).
 */
export function validateCockpitAction(action: CockpitAction, spec: PageSpecV1): string[] {
    const errors: string[] = [];

    switch (action.action) {
        case 'add-section':
            if (!action.section || !action.section.type) {
                errors.push('add-section requires a section with a type');
            } else if (!COCKPIT_SECTION_TYPES.includes(action.section.type)) {
                errors.push(`Unknown section type: ${action.section.type}`);
            }
            if (action.atIndex != null && (action.atIndex < 0 || action.atIndex > spec.sections.length)) {
                errors.push(`atIndex ${action.atIndex} out of bounds (0..${spec.sections.length})`);
            }
            break;

        case 'edit-section':
            if (action.sectionIndex < 0 || action.sectionIndex >= spec.sections.length) {
                errors.push(`sectionIndex ${action.sectionIndex} out of bounds (0..${spec.sections.length - 1})`);
            }
            if (!action.patch || Object.keys(action.patch).length === 0) {
                errors.push('edit-section requires a non-empty patch');
            }
            break;

        case 'remove-section':
            if (action.sectionIndex < 0 || action.sectionIndex >= spec.sections.length) {
                errors.push(`sectionIndex ${action.sectionIndex} out of bounds (0..${spec.sections.length - 1})`);
            }
            break;

        case 'move-section':
            if (action.fromIndex < 0 || action.fromIndex >= spec.sections.length) {
                errors.push(`fromIndex ${action.fromIndex} out of bounds`);
            }
            if (action.toIndex < 0 || action.toIndex >= spec.sections.length) {
                errors.push(`toIndex ${action.toIndex} out of bounds`);
            }
            break;

        case 'edit-page':
            if (!action.patch || Object.keys(action.patch).length === 0) {
                errors.push('edit-page requires a non-empty patch');
            }
            break;

        case 'query':
            if (!action.query || !action.query.type) {
                errors.push('query requires a query with a type');
            }
            break;
    }

    return errors;
}

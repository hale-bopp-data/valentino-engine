/**
 * Tests for Cockpit API + Schema Export.
 * Feature #778, PBI #779 (Phase 0).
 */

import { describe, it, expect } from 'vitest';
import type { PageSpecV1, SectionSpec } from '../src/core/types.js';
import {
    executeCockpitAction,
    executeCockpitBatch,
    validateCockpitAction,
    describeCockpitAction,
    COCKPIT_SECTION_TYPES,
} from '../src/core/cockpit-api.js';
import type { CockpitAction } from '../src/core/cockpit-api.js';
import {
    getPageSpecSchema,
    getCockpitActionSchema,
    getSectionSchema,
    getAllSectionSchemas,
    getSchemaDefinedSectionTypes,
} from '../src/core/schema-export.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseSpec: PageSpecV1 = {
    version: '1',
    id: 'test-page',
    profile: 'home-signature',
    sections: [
        {
            type: 'hero',
            titleKey: 'test.hero.title',
            taglineKey: 'test.hero.tagline',
            cta: { labelKey: 'test.hero.cta', action: { type: 'link', href: '#' } },
            presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
        },
        {
            type: 'cards',
            variant: 'catalog',
            titleKey: 'test.cards.title',
            items: [
                { titleKey: 'test.cards.item1.title', descKey: 'test.cards.item1.desc' },
                { titleKey: 'test.cards.item2.title', descKey: 'test.cards.item2.desc' },
            ],
            presentation: { surface: 'default', rhythmProfile: 'feature' },
        },
        {
            type: 'cta',
            titleKey: 'test.cta.title',
            presentation: { surface: 'accent', rhythmProfile: 'proof' },
        },
    ],
};

const newStatsSection: SectionSpec = {
    type: 'stats',
    titleKey: 'test.stats.title',
    items: [
        { valueKey: 'test.stats.item1.value', labelKey: 'test.stats.item1.label' },
        { valueKey: 'test.stats.item2.value', labelKey: 'test.stats.item2.label' },
    ],
    presentation: { surface: 'muted', rhythmProfile: 'metrics' },
};

// ---------------------------------------------------------------------------
// Cockpit API — Actions
// ---------------------------------------------------------------------------

describe('Cockpit API — Actions', () => {
    it('add-section appends a section', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'add-section',
            section: newStatsSection,
        });
        expect(result.success).toBe(true);
        expect(result.spec.sections).toHaveLength(4);
        expect(result.spec.sections[3].type).toBe('stats');
    });

    it('add-section inserts at index', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'add-section',
            section: newStatsSection,
            atIndex: 1,
        });
        expect(result.success).toBe(true);
        expect(result.spec.sections).toHaveLength(4);
        expect(result.spec.sections[1].type).toBe('stats');
        expect(result.spec.sections[2].type).toBe('cards');
    });

    it('edit-section patches a field', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'edit-section',
            sectionIndex: 0,
            patch: { titleKey: 'test.hero.title.updated' },
        });
        expect(result.success).toBe(true);
        const hero = result.spec.sections[0] as any;
        expect(hero.titleKey).toBe('test.hero.title.updated');
    });

    it('edit-section patches nested field', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'edit-section',
            sectionIndex: 0,
            patch: { 'presentation.surface': 'accent' },
        });
        expect(result.success).toBe(true);
        const hero = result.spec.sections[0] as any;
        expect(hero.presentation.surface).toBe('accent');
    });

    it('remove-section removes by index', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'remove-section',
            sectionIndex: 1,
        });
        expect(result.success).toBe(true);
        expect(result.spec.sections).toHaveLength(2);
        expect(result.spec.sections[0].type).toBe('hero');
        expect(result.spec.sections[1].type).toBe('cta');
    });

    it('remove-section fails on out-of-bounds', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'remove-section',
            sectionIndex: 99,
        });
        expect(result.success).toBe(false);
    });

    it('move-section reorders sections', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'move-section',
            fromIndex: 2,
            toIndex: 1,
        });
        expect(result.success).toBe(true);
        expect(result.spec.sections[1].type).toBe('cta');
        expect(result.spec.sections[2].type).toBe('cards');
    });

    it('edit-page updates page-level fields', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'edit-page',
            patch: { titleKey: 'test.page.title', profile: 'product-surface' },
        });
        expect(result.success).toBe(true);
        expect(result.spec.titleKey).toBe('test.page.title');
        expect(result.spec.profile).toBe('product-surface');
        expect(result.spec.version).toBe('1');
    });

    it('mutations are immutable — original spec unchanged', () => {
        const original = JSON.parse(JSON.stringify(baseSpec));
        executeCockpitAction(baseSpec, {
            action: 'add-section',
            section: newStatsSection,
        });
        expect(baseSpec).toEqual(original);
    });
});

// ---------------------------------------------------------------------------
// Cockpit API — Queries
// ---------------------------------------------------------------------------

describe('Cockpit API — Queries', () => {
    it('list-sections returns section summary', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'list-sections' },
        });
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
        const sections = result.data as any[];
        expect(sections[0]).toEqual({ index: 0, type: 'hero', titleKey: 'test.hero.title' });
    });

    it('get-section returns full section', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'get-section', index: 1 },
        });
        expect(result.success).toBe(true);
        expect((result.data as any).type).toBe('cards');
    });

    it('get-section fails on invalid index', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'get-section', index: 99 },
        });
        expect(result.success).toBe(false);
    });

    it('describe-page returns page metadata', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'describe-page' },
        });
        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.id).toBe('test-page');
        expect(data.sectionCount).toBe(3);
        expect(data.sectionTypes).toEqual(['hero', 'cards', 'cta']);
    });

    it('list-section-types returns available types', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'list-section-types' },
        });
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
        expect((result.data as string[]).length).toBeGreaterThan(0);
    });

    it('validate returns validation status', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'validate' },
        });
        expect(result.success).toBe(true);
        expect((result.data as any).valid).toBe(true);
    });

    it('get-editor-schema returns schema for known type', () => {
        const result = executeCockpitAction(baseSpec, {
            action: 'query',
            query: { type: 'get-editor-schema', sectionType: 'hero' },
        });
        expect(result.success).toBe(true);
        expect((result.data as any).sectionType).toBe('hero');
    });
});

// ---------------------------------------------------------------------------
// Cockpit API — Batch
// ---------------------------------------------------------------------------

describe('Cockpit API — Batch', () => {
    it('executes multiple actions in sequence', () => {
        const actions: CockpitAction[] = [
            { action: 'add-section', section: newStatsSection },
            { action: 'edit-page', patch: { titleKey: 'batch.title' } },
        ];
        const result = executeCockpitBatch(baseSpec, actions);
        expect(result.results).toHaveLength(2);
        expect(result.spec.sections).toHaveLength(4);
        expect(result.spec.titleKey).toBe('batch.title');
    });

    it('stops on failure without continueOnError', () => {
        const actions: CockpitAction[] = [
            { action: 'remove-section', sectionIndex: 99 },
            { action: 'edit-page', patch: { titleKey: 'should-not-reach' } },
        ];
        const result = executeCockpitBatch(baseSpec, actions);
        expect(result.results).toHaveLength(1);
        expect(result.spec.titleKey).toBeUndefined();
    });

    it('continues on failure with continueOnError', () => {
        const actions: CockpitAction[] = [
            { action: 'remove-section', sectionIndex: 99 },
            { action: 'edit-page', patch: { titleKey: 'continued' } },
        ];
        const result = executeCockpitBatch(baseSpec, actions, true);
        expect(result.results).toHaveLength(2);
        expect(result.spec.titleKey).toBe('continued');
    });
});

// ---------------------------------------------------------------------------
// Cockpit API — Validation & Description
// ---------------------------------------------------------------------------

describe('Cockpit API — Validation & Description', () => {
    it('validateCockpitAction catches invalid section type', () => {
        const errors = validateCockpitAction(
            { action: 'add-section', section: { type: 'nonexistent' } as any },
            baseSpec,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('Unknown section type');
    });

    it('validateCockpitAction catches out-of-bounds index', () => {
        const errors = validateCockpitAction(
            { action: 'edit-section', sectionIndex: 99, patch: { titleKey: 'x' } },
            baseSpec,
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('out of bounds');
    });

    it('validateCockpitAction accepts valid action', () => {
        const errors = validateCockpitAction(
            { action: 'add-section', section: newStatsSection },
            baseSpec,
        );
        expect(errors).toEqual([]);
    });

    it('describeCockpitAction generates human-readable text', () => {
        expect(describeCockpitAction({ action: 'add-section', section: newStatsSection }))
            .toContain('Add stats section');
        expect(describeCockpitAction({ action: 'remove-section', sectionIndex: 1 }))
            .toContain('Remove section #1');
        expect(describeCockpitAction({ action: 'move-section', fromIndex: 0, toIndex: 2 }))
            .toContain('Move section');
    });

    it('COCKPIT_SECTION_TYPES covers all 19 types', () => {
        expect(COCKPIT_SECTION_TYPES.length).toBe(19);
    });
});

// ---------------------------------------------------------------------------
// Schema Export
// ---------------------------------------------------------------------------

describe('Schema Export', () => {
    it('getPageSpecSchema returns valid JSON Schema', () => {
        const schema = getPageSpecSchema() as any;
        expect(schema.$schema).toContain('json-schema.org');
        expect(schema.title).toBe('PageSpecV1');
        expect(schema.required).toContain('version');
        expect(schema.required).toContain('id');
        expect(schema.required).toContain('sections');
    });

    it('getCockpitActionSchema returns valid JSON Schema', () => {
        const schema = getCockpitActionSchema() as any;
        expect(schema.title).toBe('CockpitAction');
        expect(schema.oneOf.length).toBe(6);
    });

    it('getSectionSchema returns schema for known types', () => {
        const hero = getSectionSchema('hero') as any;
        expect(hero).not.toBeNull();
        expect(hero.properties.type.const).toBe('hero');
        expect(hero.required).toContain('titleKey');
    });

    it('getSectionSchema returns null for unknown types', () => {
        expect(getSectionSchema('nonexistent')).toBeNull();
    });

    it('getAllSectionSchemas returns all schemas', () => {
        const all = getAllSectionSchemas();
        expect(Object.keys(all).length).toBeGreaterThan(10);
        expect(all).toHaveProperty('hero');
        expect(all).toHaveProperty('cards');
        expect(all).toHaveProperty('cta');
    });

    it('getSchemaDefinedSectionTypes lists all types', () => {
        const types = getSchemaDefinedSectionTypes();
        expect(types).toContain('hero');
        expect(types).toContain('cards');
        expect(types).toContain('advisor');
        expect(types).toContain('data-list');
    });

    it('schemas are returned as deep copies (no mutation risk)', () => {
        const s1 = getPageSpecSchema() as any;
        const s2 = getPageSpecSchema() as any;
        s1.title = 'MUTATED';
        expect(s2.title).toBe('PageSpecV1');
    });
});

// ---------------------------------------------------------------------------
// Roundtrip: create → validate → modify → validate
// ---------------------------------------------------------------------------

describe('Roundtrip', () => {
    it('create → add → edit → remove → validate', () => {
        // Start with base
        let spec = baseSpec;

        // Add stats section
        const r1 = executeCockpitAction(spec, {
            action: 'add-section',
            section: newStatsSection,
            atIndex: 2,
        });
        expect(r1.success).toBe(true);
        spec = r1.spec;
        expect(spec.sections).toHaveLength(4);

        // Edit hero title
        const r2 = executeCockpitAction(spec, {
            action: 'edit-section',
            sectionIndex: 0,
            patch: { titleKey: 'roundtrip.hero.title' },
        });
        expect(r2.success).toBe(true);
        spec = r2.spec;

        // Remove cards
        const r3 = executeCockpitAction(spec, {
            action: 'remove-section',
            sectionIndex: 1,
        });
        expect(r3.success).toBe(true);
        spec = r3.spec;
        expect(spec.sections).toHaveLength(3);

        // Validate final state
        const r4 = executeCockpitAction(spec, {
            action: 'query',
            query: { type: 'validate' },
        });
        expect((r4.data as any).valid).toBe(true);

        // Verify structure
        expect(spec.sections.map(s => s.type)).toEqual(['hero', 'stats', 'cta']);
        expect((spec.sections[0] as any).titleKey).toBe('roundtrip.hero.title');
    });
});

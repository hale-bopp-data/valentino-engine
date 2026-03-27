import { describe, it, expect } from 'vitest';
import {
    getEditableSectionTypes,
    generateEditorSchema,
    generateAllEditorSchemas,
    applySectionPatch,
    addSection,
    removeSection,
    moveSection,
    applyPagePatch,
} from '../src/index.js';
import type { PageSpecV1, SectionSpec } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(sections: SectionSpec[] = []): PageSpecV1 {
    return {
        version: '1',
        id: 'test-page',
        sections,
    };
}

function heroSection(): SectionSpec {
    return { type: 'hero', titleKey: 'hero.title' } as SectionSpec;
}

function ctaSection(): SectionSpec {
    return { type: 'cta', titleKey: 'cta.title' } as SectionSpec;
}

function spacerSection(): SectionSpec {
    return { type: 'spacer' } as SectionSpec;
}

// ---------------------------------------------------------------------------
// generateEditorSchema
// ---------------------------------------------------------------------------

describe('generateEditorSchema', () => {
    it('returns schema for known section types', () => {
        const schema = generateEditorSchema('hero');
        expect(schema).not.toBeNull();
        expect(schema!.sectionType).toBe('hero');
        expect(schema!.label).toBe('Hero');
        expect(schema!.fields.length).toBeGreaterThan(0);
    });

    it('returns null for unknown section type', () => {
        expect(generateEditorSchema('nonexistent')).toBeNull();
    });

    it('hero schema has required titleKey field', () => {
        const schema = generateEditorSchema('hero')!;
        const titleField = schema.fields.find((f) => f.key === 'titleKey');
        expect(titleField).toBeDefined();
        expect(titleField!.required).toBe(true);
        expect(titleField!.type).toBe('string');
    });

    it('cards schema has array items field', () => {
        const schema = generateEditorSchema('cards')!;
        const itemsField = schema.fields.find((f) => f.key === 'items');
        expect(itemsField).toBeDefined();
        expect(itemsField!.type).toBe('array');
        expect(itemsField!.itemFields).toBeDefined();
        expect(itemsField!.itemFields!.length).toBeGreaterThan(0);
    });

    it('presentation fields are included in all schemas', () => {
        const types = getEditableSectionTypes();
        for (const t of types) {
            const schema = generateEditorSchema(t)!;
            // spacer has no animation but should have presentation
            const hasPres = schema.fields.some((f) => f.key.startsWith('presentation.'));
            expect(hasPres, `${t} should have presentation fields`).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// getEditableSectionTypes / generateAllEditorSchemas
// ---------------------------------------------------------------------------

describe('getEditableSectionTypes', () => {
    it('returns a non-empty list of section types', () => {
        const types = getEditableSectionTypes();
        expect(types.length).toBeGreaterThan(0);
        expect(types).toContain('hero');
        expect(types).toContain('cards');
        expect(types).toContain('cta');
    });
});

describe('generateAllEditorSchemas', () => {
    it('returns one schema per editable type', () => {
        const schemas = generateAllEditorSchemas();
        const types = getEditableSectionTypes();
        expect(schemas.length).toBe(types.length);
    });
});

// ---------------------------------------------------------------------------
// applySectionPatch
// ---------------------------------------------------------------------------

describe('applySectionPatch', () => {
    it('patches a simple top-level field', () => {
        const spec = makeSpec([heroSection()]);
        const result = applySectionPatch(spec, 0, { titleKey: 'new.title' });
        expect((result.spec.sections[0] as any).titleKey).toBe('new.title');
        expect(result.warnings.length).toBe(0);
    });

    it('patches a nested presentation field', () => {
        const spec = makeSpec([heroSection()]);
        const result = applySectionPatch(spec, 0, { 'presentation.surface': 'dark' });
        expect((result.spec.sections[0] as any).presentation.surface).toBe('dark');
    });

    it('is immutable — original spec unchanged', () => {
        const spec = makeSpec([heroSection()]);
        const original = JSON.stringify(spec);
        applySectionPatch(spec, 0, { titleKey: 'changed' });
        expect(JSON.stringify(spec)).toBe(original);
    });

    it('warns on out-of-bounds index', () => {
        const spec = makeSpec([heroSection()]);
        const result = applySectionPatch(spec, 5, { titleKey: 'x' });
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].field).toBe('_index');
    });

    it('warns when required field is removed', () => {
        const spec = makeSpec([heroSection()]);
        const result = applySectionPatch(spec, 0, { titleKey: null });
        expect(result.warnings.some((w) => w.field === 'titleKey')).toBe(true);
    });

    it('removes a field when value is null', () => {
        const spec = makeSpec([{ type: 'hero', titleKey: 'hero.title', taglineKey: 'hero.tagline' } as SectionSpec]);
        const result = applySectionPatch(spec, 0, { taglineKey: null });
        expect((result.spec.sections[0] as any).taglineKey).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// addSection / removeSection / moveSection
// ---------------------------------------------------------------------------

describe('addSection', () => {
    it('appends section at end by default', () => {
        const spec = makeSpec([heroSection()]);
        const result = addSection(spec, ctaSection());
        expect(result.sections.length).toBe(2);
        expect(result.sections[1].type).toBe('cta');
    });

    it('inserts section at specific index', () => {
        const spec = makeSpec([heroSection(), ctaSection()]);
        const result = addSection(spec, spacerSection(), 1);
        expect(result.sections.length).toBe(3);
        expect(result.sections[1].type).toBe('spacer');
    });

    it('is immutable', () => {
        const spec = makeSpec([heroSection()]);
        const result = addSection(spec, ctaSection());
        expect(spec.sections.length).toBe(1);
        expect(result.sections.length).toBe(2);
    });
});

describe('removeSection', () => {
    it('removes section by index', () => {
        const spec = makeSpec([heroSection(), ctaSection(), spacerSection()]);
        const result = removeSection(spec, 1);
        expect(result.sections.length).toBe(2);
        expect(result.sections[0].type).toBe('hero');
        expect(result.sections[1].type).toBe('spacer');
    });

    it('returns same spec for out-of-bounds index', () => {
        const spec = makeSpec([heroSection()]);
        const result = removeSection(spec, 5);
        expect(result).toBe(spec);
    });
});

describe('moveSection', () => {
    it('moves section forward', () => {
        const spec = makeSpec([heroSection(), ctaSection(), spacerSection()]);
        const result = moveSection(spec, 0, 2);
        expect(result.sections[0].type).toBe('cta');
        expect(result.sections[1].type).toBe('spacer');
        expect(result.sections[2].type).toBe('hero');
    });

    it('moves section backward', () => {
        const spec = makeSpec([heroSection(), ctaSection(), spacerSection()]);
        const result = moveSection(spec, 2, 0);
        expect(result.sections[0].type).toBe('spacer');
        expect(result.sections[1].type).toBe('hero');
        expect(result.sections[2].type).toBe('cta');
    });

    it('returns same spec for same index', () => {
        const spec = makeSpec([heroSection()]);
        const result = moveSection(spec, 0, 0);
        expect(result).toBe(spec);
    });
});

// ---------------------------------------------------------------------------
// applyPagePatch
// ---------------------------------------------------------------------------

describe('applyPagePatch', () => {
    it('updates page-level fields', () => {
        const spec = makeSpec([heroSection()]);
        const result = applyPagePatch(spec, { titleKey: 'new.page.title', profile: 'home-signature' });
        expect(result.titleKey).toBe('new.page.title');
        expect(result.profile).toBe('home-signature');
    });

    it('preserves version and sections', () => {
        const spec = makeSpec([heroSection()]);
        const result = applyPagePatch(spec, { titleKey: 'x' });
        expect(result.version).toBe('1');
        expect(result.sections.length).toBe(1);
    });

    it('is immutable', () => {
        const spec = makeSpec([heroSection()]);
        const result = applyPagePatch(spec, { titleKey: 'x' });
        expect(spec.titleKey).toBeUndefined();
        expect(result.titleKey).toBe('x');
    });
});

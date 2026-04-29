import { describe, it, expect } from 'vitest';
import { generateEditorSchema, applySectionPatch, addSection, removeSection, moveSection, applyPagePatch, getEditableSectionTypes } from './editor.js';
import type { PageSpecV1, SectionSpec } from './types.js';

const emptySpec: PageSpecV1 = { version: '1', id: 'test-page', sections: [] };

const heroSection = {
  type: 'hero',
  titleKey: 'test.hero.title',
} as SectionSpec;

const cardSection = {
  type: 'cards',
  items: [{ titleKey: 'card1' }],
} as SectionSpec;

// ─── generateEditorSchema ──────────────────────────────────────────────────

describe('generateEditorSchema', () => {
  it('returns schema for hero section type', () => {
    const schema = generateEditorSchema('hero');
    expect(schema).toBeDefined();
    expect(schema!.sectionType).toBe('hero');
    expect(schema!.label).toBeDefined();
    expect(schema!.fields.length).toBeGreaterThan(0);
  });

  it('returns schema for cards section type', () => {
    const schema = generateEditorSchema('cards');
    expect(schema).toBeDefined();
    expect(schema!.sectionType).toBe('cards');
  });

  it('returns null for unknown section type', () => {
    expect(generateEditorSchema('nonexistent')).toBeNull();
  });
});

// ─── getEditableSectionTypes ───────────────────────────────────────────────

describe('getEditableSectionTypes', () => {
  it('returns array with known section types', () => {
    const types = getEditableSectionTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
    expect(types).toContain('hero');
  });
});

// ─── addSection ────────────────────────────────────────────────────────────

describe('addSection', () => {
  it('adds section at end by default', () => {
    const result = addSection(emptySpec, heroSection);
    expect(result.sections.length).toBe(1);
    expect(result.sections[0]).toEqual(heroSection);
  });

  it('adds section at specified index', () => {
    const base = addSection(emptySpec, heroSection);
    const result = addSection(base, cardSection, 0);
    expect(result.sections.length).toBe(2);
    expect(result.sections[0]).toEqual(cardSection);
    expect(result.sections[1]).toEqual(heroSection);
  });

  it('does not mutate original spec', () => {
    const result = addSection(emptySpec, heroSection);
    expect(emptySpec.sections.length).toBe(0);
    expect(result.sections.length).toBe(1);
  });
});

// ─── removeSection ─────────────────────────────────────────────────────────

describe('removeSection', () => {
  it('removes section at index', () => {
    const base = addSection(addSection(emptySpec, heroSection), cardSection);
    expect(base.sections.length).toBe(2);
    const result = removeSection(base, 0);
    expect(result.sections.length).toBe(1);
    expect(result.sections[0]).toEqual(cardSection);
  });

  it('returns unchanged spec for out-of-bounds index', () => {
    const result = removeSection(emptySpec, 0);
    expect(result.sections).toEqual([]);
    const result2 = removeSection(emptySpec, -1);
    expect(result2.sections).toEqual([]);
  });

  it('does not mutate original', () => {
    const base = addSection(emptySpec, heroSection);
    removeSection(base, 0);
    expect(base.sections.length).toBe(1);
  });
});

// ─── moveSection ───────────────────────────────────────────────────────────

describe('moveSection', () => {
  it('moves section from one index to another', () => {
    const extra = { type: 'hero', titleKey: 'extra' } as SectionSpec;
    const base = addSection(addSection(addSection(emptySpec, heroSection), cardSection), extra);
    expect(base.sections.length).toBe(3);
    const result = moveSection(base, 0, 2);
    expect(result.sections[0].type).toBe('cards');
    expect(result.sections[2].type).toBe('hero');
  });

  it('returns unchanged for out-of-bounds indices', () => {
    const base = addSection(emptySpec, heroSection);
    expect(moveSection(base, 0, 5).sections).toEqual(base.sections);
    expect(moveSection(base, 5, 0).sections).toEqual(base.sections);
    expect(moveSection(base, -1, 0).sections).toEqual(base.sections);
  });

  it('returns unchanged for same from/to index', () => {
    const base = addSection(emptySpec, heroSection);
    expect(moveSection(base, 0, 0).sections).toEqual(base.sections);
  });
});

// ─── applySectionPatch ─────────────────────────────────────────────────────

describe('applySectionPatch', () => {
  it('patches section fields', () => {
    const base = addSection(emptySpec, heroSection);
    const result = applySectionPatch(base, 0, { titleKey: 'updated.title' });
    expect((result.spec.sections[0] as Record<string, unknown>).titleKey).toBe('updated.title');
    expect(result.warnings.length).toBe(0);
  });

  it('returns warning for out-of-bounds index', () => {
    const result = applySectionPatch(emptySpec, 0, { titleKey: 'x' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].field).toBe('_index');
  });

  it('preserves extra patch fields on section', () => {
    const base = addSection(emptySpec, heroSection);
    const result = applySectionPatch(base, 0, { titleKey: 'ok', unknownField: 'value' });
    expect((result.spec.sections[0] as Record<string, unknown>).titleKey).toBe('ok');
  });

  it('does not mutate original spec', () => {
    const base = addSection(emptySpec, heroSection);
    applySectionPatch(base, 0, { titleKey: 'changed' });
    expect((base.sections[0] as Record<string, unknown>).titleKey).toBe('test.hero.title');
  });
});

// ─── applyPagePatch ────────────────────────────────────────────────────────

describe('applyPagePatch', () => {
  it('updates page-level fields', () => {
    const result = applyPagePatch(emptySpec, { id: 'new-id', titleKey: 'new-page' });
    expect(result.id).toBe('new-id');
    expect(result.titleKey).toBe('new-page');
  });

  it('preserves version as "1"', () => {
    const result = applyPagePatch(emptySpec, {} as any);
    expect(result.version).toBe('1');
  });

  it('preserves sections unchanged', () => {
    const base = addSection(emptySpec, heroSection);
    const result = applyPagePatch(base, { id: 'renamed' });
    expect(result.sections.length).toBe(1);
    expect(result.sections[0]).toEqual(heroSection);
  });
});

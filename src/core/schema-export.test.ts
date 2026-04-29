import { describe, it, expect } from 'vitest';
import {
  getPageSpecSchema,
  getCockpitActionSchema,
  getSectionSchema,
  getAllSectionSchemas,
  getSchemaDefinedSectionTypes,
} from './schema-export.js';

// ─── getPageSpecSchema ─────────────────────────────────────────────────────

describe('getPageSpecSchema', () => {
  it('returns a valid JSON Schema object', () => {
    const schema = getPageSpecSchema();
    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');

    const s = schema as Record<string, unknown>;
    expect(s.required).toBeInstanceOf(Array);
    const required = s.required as string[];
    expect(required).toContain('version');
    expect(required).toContain('id');
    expect(required).toContain('sections');
  });

  it('returns a new object each call (immutable)', () => {
    const a = getPageSpecSchema();
    const b = getPageSpecSchema();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('section items include hero and cards types', () => {
    const schema = getPageSpecSchema() as any;
    const sectionsProp = schema.properties?.sections;
    expect(sectionsProp).toBeDefined();
    expect(sectionsProp.type).toBe('array');

    // oneOf should contain hero schema
    const oneOf = sectionsProp.items?.oneOf;
    expect(Array.isArray(oneOf)).toBe(true);
    const heroSchema = oneOf.find((s: any) => s.properties?.type?.const === 'hero');
    expect(heroSchema).toBeDefined();
    const cardsSchema = oneOf.find((s: any) => s.properties?.type?.const === 'cards');
    expect(cardsSchema).toBeDefined();
  });
});

// ─── getCockpitActionSchema ────────────────────────────────────────────────

describe('getCockpitActionSchema', () => {
  it('returns a valid JSON Schema object', () => {
    const schema = getCockpitActionSchema();
    expect(schema).toBeDefined();

    const s = schema as Record<string, unknown>;
    expect(s.title).toBe('CockpitAction');
    const oneOf = s.oneOf as Array<Record<string, unknown>>;
    expect(Array.isArray(oneOf)).toBe(true);
    expect(oneOf.length).toBeGreaterThanOrEqual(6);
  });

  it('includes add-section action schema', () => {
    const schema = getCockpitActionSchema() as any;
    const addAction = schema.oneOf.find((s: any) => s.properties?.action?.const === 'add-section');
    expect(addAction).toBeDefined();
    expect(addAction.required).toContain('action');
    expect(addAction.required).toContain('section');
  });

  it('returns new object each call', () => {
    expect(getCockpitActionSchema()).not.toBe(getCockpitActionSchema());
  });
});

// ─── getSectionSchema ──────────────────────────────────────────────────────

describe('getSectionSchema', () => {
  it('returns schema for hero', () => {
    const schema = getSectionSchema('hero');
    expect(schema).toBeDefined();
    const s = schema as any;
    expect(s.properties?.type?.const).toBe('hero');
    expect(s.required).toContain('type');
    expect(s.required).toContain('titleKey');
  });

  it('returns schema for cards', () => {
    const schema = getSectionSchema('cards');
    expect(schema).toBeDefined();
    expect((schema as any).properties?.type?.const).toBe('cards');
  });

  it('returns null for unknown type', () => {
    expect(getSectionSchema('nonexistent')).toBeNull();
  });

  it('returns new object each call', () => {
    expect(getSectionSchema('hero')).not.toBe(getSectionSchema('hero'));
  });
});

// ─── getAllSectionSchemas ──────────────────────────────────────────────────

describe('getAllSectionSchemas', () => {
  it('returns a map with hero and cards', () => {
    const map = getAllSectionSchemas();
    expect(map['hero']).toBeDefined();
    expect(map['cards']).toBeDefined();
  });

  it('returns a new object each call', () => {
    expect(getAllSectionSchemas()).not.toBe(getAllSectionSchemas());
  });
});

// ─── getSchemaDefinedSectionTypes ──────────────────────────────────────────

describe('getSchemaDefinedSectionTypes', () => {
  it('returns array with hero and cards', () => {
    const types = getSchemaDefinedSectionTypes();
    expect(types).toContain('hero');
    expect(types).toContain('cards');
  });

  it('matches keys from getAllSectionSchemas', () => {
    const types = getSchemaDefinedSectionTypes();
    const map = getAllSectionSchemas();
    expect(types.sort()).toEqual(Object.keys(map).sort());
  });
});

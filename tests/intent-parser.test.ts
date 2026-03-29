/**
 * Tests for Intent Parser + REPL session.
 * Feature #778, PBI #780 (Phase 1).
 */

import { describe, it, expect } from 'vitest';
import type { PageSpecV1 } from '../src/core/types.js';
import {
    parseIntentLocal,
    resolveSectionType,
    parseIndex,
    buildMinimalSection,
    buildSectionSummary,
} from '../src/core/intent-parser.js';
import { processReplInput, createReplSession } from '../src/core/cockpit-repl.js';

// ---------------------------------------------------------------------------
// Fixture
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

// ---------------------------------------------------------------------------
// resolveSectionType
// ---------------------------------------------------------------------------

describe('resolveSectionType', () => {
    it('resolves Italian aliases', () => {
        expect(resolveSectionType('eroe')).toBe('hero');
        expect(resolveSectionType('carte')).toBe('cards');
        expect(resolveSectionType('statistiche')).toBe('stats');
        expect(resolveSectionType('confronto')).toBe('comparison');
        expect(resolveSectionType('consulente')).toBe('advisor');
    });

    it('resolves English types directly', () => {
        expect(resolveSectionType('hero')).toBe('hero');
        expect(resolveSectionType('cards')).toBe('cards');
        expect(resolveSectionType('how-it-works')).toBe('how-it-works');
    });

    it('returns null for unknown types', () => {
        expect(resolveSectionType('nonexistent')).toBeNull();
        expect(resolveSectionType('')).toBeNull();
    });

    it('is case insensitive', () => {
        expect(resolveSectionType('HERO')).toBe('hero');
        expect(resolveSectionType('Eroe')).toBe('hero');
    });
});

// ---------------------------------------------------------------------------
// parseIndex
// ---------------------------------------------------------------------------

describe('parseIndex', () => {
    it('parses numeric indices (1-based → 0-based)', () => {
        expect(parseIndex('1', 5)).toBe(0);
        expect(parseIndex('3', 5)).toBe(2);
    });

    it('parses Italian word indices', () => {
        expect(parseIndex('prima', 5)).toBe(0);
        expect(parseIndex('seconda', 5)).toBe(1);
        expect(parseIndex('ultima', 5)).toBe(4);
    });

    it('parses English word indices', () => {
        expect(parseIndex('first', 5)).toBe(0);
        expect(parseIndex('third', 5)).toBe(2);
        expect(parseIndex('last', 5)).toBe(4);
    });

    it('returns null for invalid input', () => {
        expect(parseIndex('abc', 5)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// buildMinimalSection
// ---------------------------------------------------------------------------

describe('buildMinimalSection', () => {
    it('builds valid hero section', () => {
        const s = buildMinimalSection('hero') as any;
        expect(s.type).toBe('hero');
        expect(s.titleKey).toBeTruthy();
    });

    it('builds valid cards section', () => {
        const s = buildMinimalSection('cards') as any;
        expect(s.type).toBe('cards');
        expect(s.variant).toBe('catalog');
        expect(s.items.length).toBeGreaterThan(0);
    });

    it('builds valid stats section', () => {
        const s = buildMinimalSection('stats') as any;
        expect(s.type).toBe('stats');
        expect(s.items.length).toBeGreaterThan(0);
    });

    it('builds valid form section', () => {
        const s = buildMinimalSection('form') as any;
        expect(s.type).toBe('form');
        expect(s.fields.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Intent parsing — Queries (IT)
// ---------------------------------------------------------------------------

describe('Intent Parser — Queries (IT)', () => {
    it('parses "mostrami le sezioni"', () => {
        const r = parseIntentLocal('mostrami le sezioni', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'list-sections' } });
        expect(r.intent!.confidence).toBe('high');
    });

    it('parses "descrivi la pagina"', () => {
        const r = parseIntentLocal('descrivi la pagina', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'describe-page' } });
    });

    it('parses "valida"', () => {
        const r = parseIntentLocal('valida', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'validate' } });
    });

    it('parses "quali tipi di sezioni sono disponibili"', () => {
        const r = parseIntentLocal('quali tipi di sezioni sono disponibili', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'list-section-types' } });
    });

    it('parses "mostra sezione 2"', () => {
        const r = parseIntentLocal('mostra sezione 2', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'get-section', index: 1 } });
    });
});

// ---------------------------------------------------------------------------
// Intent parsing — Queries (EN)
// ---------------------------------------------------------------------------

describe('Intent Parser — Queries (EN)', () => {
    it('parses "show me the sections"', () => {
        const r = parseIntentLocal('show me the sections', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'list-sections' } });
    });

    it('parses "validate"', () => {
        const r = parseIntentLocal('validate', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'validate' } });
    });

    it('parses "describe the page"', () => {
        const r = parseIntentLocal('describe the page', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action).toEqual({ action: 'query', query: { type: 'describe-page' } });
    });
});

// ---------------------------------------------------------------------------
// Intent parsing — Mutations
// ---------------------------------------------------------------------------

describe('Intent Parser — Mutations', () => {
    it('parses "aggiungi una sezione stats"', () => {
        const r = parseIntentLocal('aggiungi una sezione stats', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action.action).toBe('add-section');
        if (r.intent!.action.action === 'add-section') {
            expect(r.intent!.action.section.type).toBe('stats');
        }
    });

    it('parses "add a hero section"', () => {
        const r = parseIntentLocal('add a hero section', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action.action).toBe('add-section');
    });

    it('parses "rimuovi sezione 2"', () => {
        const r = parseIntentLocal('rimuovi sezione 2', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action.action).toBe('remove-section');
        if (r.intent!.action.action === 'remove-section') {
            expect(r.intent!.action.sectionIndex).toBe(1);
        }
    });

    it('parses "rimuovi la cta"', () => {
        const r = parseIntentLocal('rimuovi la cta', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action.action).toBe('remove-section');
        if (r.intent!.action.action === 'remove-section') {
            expect(r.intent!.action.sectionIndex).toBe(2);
        }
    });

    it('parses "sposta sezione 3 a posizione 1"', () => {
        const r = parseIntentLocal('sposta sezione 3 a posizione 1', baseSpec);
        expect(r.intent).not.toBeNull();
        expect(r.intent!.action.action).toBe('move-section');
        if (r.intent!.action.action === 'move-section') {
            expect(r.intent!.action.fromIndex).toBe(2);
            expect(r.intent!.action.toIndex).toBe(0);
        }
    });

    it('returns null for unparseable input', () => {
        const r = parseIntentLocal('fai qualcosa di magico', baseSpec);
        expect(r.intent).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// buildSectionSummary
// ---------------------------------------------------------------------------

describe('buildSectionSummary', () => {
    it('summarizes sections with indices and types', () => {
        const summary = buildSectionSummary(baseSpec);
        expect(summary).toHaveLength(3);
        expect(summary[0]).toEqual({ index: 0, type: 'hero', titleKey: 'test.hero.title' });
        expect(summary[1]).toEqual({ index: 1, type: 'cards', titleKey: 'test.cards.title' });
        expect(summary[2]).toEqual({ index: 2, type: 'cta', titleKey: 'test.cta.title' });
    });
});

// ---------------------------------------------------------------------------
// REPL session
// ---------------------------------------------------------------------------

describe('REPL Session', () => {
    it('createReplSession initializes correctly', () => {
        const session = createReplSession(baseSpec);
        expect(session.spec.id).toBe('test-page');
        expect(session.history).toHaveLength(0);
        expect(session.actionCount).toBe(0);
    });

    it('processes help command', async () => {
        const session = createReplSession(baseSpec);
        const { output, exit } = await processReplInput('help', session);
        expect(output).toContain('Valentino Cockpit');
        expect(exit).toBe(false);
    });

    it('processes exit command', async () => {
        const session = createReplSession(baseSpec);
        const { exit } = await processReplInput('exit', session);
        expect(exit).toBe(true);
    });

    it('processes esci command (IT)', async () => {
        const session = createReplSession(baseSpec);
        const { exit } = await processReplInput('esci', session);
        expect(exit).toBe(true);
    });

    it('processes json command', async () => {
        const session = createReplSession(baseSpec);
        const { output } = await processReplInput('json', session);
        const parsed = JSON.parse(output);
        expect(parsed.id).toBe('test-page');
    });

    it('executes query via natural language', async () => {
        const session = createReplSession(baseSpec);
        const { output } = await processReplInput('mostrami le sezioni', session);
        expect(output).toContain('Done');
        expect(session.actionCount).toBe(0); // queries don't count
    });

    it('executes mutation and updates spec', async () => {
        const session = createReplSession(baseSpec);
        const { output } = await processReplInput('aggiungi una sezione stats', session);
        expect(output).toContain('stats');
        expect(session.spec.sections).toHaveLength(4);
        expect(session.actionCount).toBe(1);
    });

    it('supports undo after mutation', async () => {
        const session = createReplSession(baseSpec);
        await processReplInput('aggiungi una sezione stats', session);
        expect(session.spec.sections).toHaveLength(4);

        await processReplInput('undo', session);
        expect(session.spec.sections).toHaveLength(3);
    });

    it('handles unparseable input gracefully', async () => {
        const session = createReplSession(baseSpec);
        const { output } = await processReplInput('fai magie arcane', session);
        expect(output).toContain('Non ho capito');
    });

    it('empty input returns empty output', async () => {
        const session = createReplSession(baseSpec);
        const { output } = await processReplInput('', session);
        expect(output).toBe('');
    });
});

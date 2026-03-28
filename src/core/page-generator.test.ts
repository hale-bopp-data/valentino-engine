import { describe, it, expect } from 'vitest';
import { parsePrompt, generatePageSpecLocal, generatePageSpec } from './page-generator.js';
import type { PageSpecV1 } from './types.js';

describe('parsePrompt', () => {
    it('detects landing page type', () => {
        const intent = parsePrompt('Voglio una landing page per un ristorante');
        expect(intent.pageType).toBe('landing');
        expect(intent.profile).toBe('home-signature');
    });

    it('detects service page type', () => {
        const intent = parsePrompt('Pagina per servizio di consulenza');
        expect(intent.pageType).toBe('service');
        expect(intent.profile).toBe('product-surface');
    });

    it('detects about page type', () => {
        const intent = parsePrompt('Pagina chi siamo del team');
        expect(intent.pageType).toBe('about');
        expect(intent.profile).toBe('reading-manifesto');
    });

    it('extracts section intents', () => {
        const intent = parsePrompt('Landing page con hero, 3 card e CTA');
        const types = intent.sectionIntents.map(s => s.type);
        expect(types).toContain('hero');
        expect(types).toContain('cards');
        expect(types).toContain('cta');
    });

    it('extracts listed items for cards', () => {
        const intent = parsePrompt('Landing page con 3 card: design, sviluppo, supporto');
        expect(intent.items).toEqual(['design', 'sviluppo', 'supporto']);
        const cardsIntent = intent.sectionIntents.find(s => s.type === 'cards');
        expect(cardsIntent?.items).toEqual(['design', 'sviluppo', 'supporto']);
    });

    it('extracts steps for how-it-works', () => {
        const intent = parsePrompt('Pagina con come funziona: analisi, progetto, lancio');
        expect(intent.steps).toEqual(['analisi', 'progetto', 'lancio']);
        const hiwIntent = intent.sectionIntents.find(s => s.type === 'how-it-works');
        expect(hiwIntent?.steps).toEqual(['analisi', 'progetto', 'lancio']);
    });

    it('extracts title from "per un X" pattern', () => {
        const intent = parsePrompt('Landing page per un ristorante con hero');
        expect(intent.title).toBe('Ristorante');
    });

    it('defaults to hero + cards + cta when no sections detected', () => {
        const intent = parsePrompt('Fai qualcosa di bello');
        const types = intent.sectionIntents.map(s => s.type);
        expect(types).toEqual(['hero', 'cards', 'cta']);
    });

    it('prepends hero if not mentioned', () => {
        const intent = parsePrompt('Pagina con statistiche e CTA');
        expect(intent.sectionIntents[0].type).toBe('hero');
    });
});

describe('generatePageSpecLocal', () => {
    it('generates valid PageSpecV1 from prompt', () => {
        const result = generatePageSpecLocal(
            'Landing page per consulenza con hero, 3 card: design, sviluppo, supporto e CTA',
            { id: 'test-page' },
        );
        expect(result.mode).toBe('local');
        expect(result.spec.version).toBe('1');
        expect(result.spec.id).toBe('test-page');
        expect(result.spec.sections.length).toBeGreaterThanOrEqual(3);
    });

    it('generates cards with correct item count', () => {
        const result = generatePageSpecLocal(
            'Landing page con 3 card: design, sviluppo, supporto.',
            { id: 'cards-test' },
        );
        const cards = result.spec.sections.find(s => s.type === 'cards');
        expect(cards).toBeDefined();
        if (cards?.type === 'cards') {
            expect(cards.items).toHaveLength(3);
        }
    });

    it('generates how-it-works with steps', () => {
        const result = generatePageSpecLocal(
            'Pagina con come funziona: analisi, progetto, lancio.',
            { id: 'hiw-test' },
        );
        const hiw = result.spec.sections.find(s => s.type === 'how-it-works');
        expect(hiw).toBeDefined();
        if (hiw?.type === 'how-it-works') {
            expect(hiw.steps).toHaveLength(3);
        }
    });

    it('generates stats section', () => {
        const result = generatePageSpecLocal(
            'Landing page con statistiche',
            { id: 'stats-test' },
        );
        const stats = result.spec.sections.find(s => s.type === 'stats');
        expect(stats).toBeDefined();
    });

    it('always produces a valid spec', () => {
        const result = generatePageSpecLocal('qualsiasi cosa', { id: 'any' });
        expect(result.spec.version).toBe('1');
        expect(result.spec.id).toBe('any');
        expect(Array.isArray(result.spec.sections)).toBe(true);
        expect(result.spec.sections.length).toBeGreaterThan(0);
    });

    it('resolves with catalog when provided', () => {
        const result = generatePageSpecLocal(
            'Landing page con hero',
            {
                id: 'catalog-test',
                catalog: {
                    version: '1',
                    templates: {},
                    sectionPresets: {
                        'hero-home': { presentation: { surface: 'dark' } },
                    },
                    transitionProfiles: {},
                    pageBlueprints: {},
                },
            },
        );
        expect(result.spec.version).toBe('1');
    });
});

describe('generatePageSpec (async)', () => {
    it('uses local mode when no llm provided', async () => {
        const result = await generatePageSpec(
            'Landing page per ristorante',
            { id: 'async-local' },
        );
        expect(result.mode).toBe('local');
    });

    it('uses llm mode when callback succeeds', async () => {
        const mockLlm = async (): Promise<PageSpecV1> => ({
            version: '1',
            id: 'llm-gen',
            sections: [{ type: 'hero', titleKey: 'llm.hero.title' }],
        });
        const result = await generatePageSpec(
            'Landing page per ristorante',
            { id: 'llm-test', llm: mockLlm },
        );
        expect(result.mode).toBe('llm');
        expect(result.spec.id).toBe('llm-test');
    });

    it('falls back to local when llm throws', async () => {
        const failingLlm = async () => { throw new Error('API down'); };
        const result = await generatePageSpec(
            'Landing page per ristorante',
            { id: 'fallback-test', llm: failingLlm },
        );
        expect(result.mode).toBe('local');
        expect(result.warnings.some(w => w.includes('LLM call failed'))).toBe(true);
    });

    it('falls back to local when llm returns invalid JSON string', async () => {
        const badLlm = async () => 'not json at all {{{';
        const result = await generatePageSpec(
            'Landing page',
            { id: 'bad-json', llm: badLlm },
        );
        expect(result.mode).toBe('local');
        expect(result.warnings.some(w => w.includes('invalid JSON'))).toBe(true);
    });

    it('falls back to local when llm returns invalid spec', async () => {
        const invalidLlm = async () => ({ notASpec: true });
        const result = await generatePageSpec(
            'Landing page',
            { id: 'invalid-spec', llm: invalidLlm },
        );
        expect(result.mode).toBe('local');
        expect(result.warnings.some(w => w.includes('validation'))).toBe(true);
    });
});

import { describe, it, expect } from 'vitest';
import { probeSectionIntegrity } from './section-integrity.js';

describe('probeSectionIntegrity', () => {
    it('returns valid for empty sections', () => {
        expect(probeSectionIntegrity([]).valid).toBe(true);
    });

    it('warns on hero without titleKey', () => {
        const result = probeSectionIntegrity([
            { type: 'hero' },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'hero-title-required' }));
    });

    it('passes for valid hero', () => {
        const result = probeSectionIntegrity([
            { type: 'hero', titleKey: 'h' },
        ] as any);
        expect(result.valid).toBe(true);
    });

    it('passes for valid cards', () => {
        const result = probeSectionIntegrity([
            { type: 'cards', variant: 'catalog', items: [{ titleKey: 't' }] },
        ] as any);
        expect(result.valid).toBe(true);
    });

    it('warns on empty cards items', () => {
        const result = probeSectionIntegrity([
            { type: 'cards', variant: 'catalog', items: [] },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'cards-items-required' }));
    });

    it('warns on empty form fields', () => {
        const result = probeSectionIntegrity([
            { type: 'form', titleKey: 't', fields: [], submitKey: 's' },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'form-fields-required' }));
    });

    it('warns on empty comparison left', () => {
        const result = probeSectionIntegrity([
            { type: 'comparison', titleKey: 't', left: { titleKey: 'l', itemsKeys: [] }, right: { titleKey: 'r', itemsKeys: ['a'] } },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'comparison-left-required' }));
    });

    it('warns on empty comparison right', () => {
        const result = probeSectionIntegrity([
            { type: 'comparison', titleKey: 't', left: { titleKey: 'l', itemsKeys: ['a'] }, right: { titleKey: 'r', itemsKeys: [] } },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'comparison-right-required' }));
    });

    it('warns on empty how-it-works steps', () => {
        const result = probeSectionIntegrity([
            { type: 'how-it-works', steps: [] },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'how-it-works-steps-required' }));
    });

    it('warns on empty advisor prompts', () => {
        const result = probeSectionIntegrity([
            { type: 'advisor', titleKey: 't', submitKey: 's', fallbackTitleKey: 'f', fallbackBodyKey: 'fb', prompts: [] },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'advisor-prompts-required' }));
    });

    it('warns on empty stats items', () => {
        const result = probeSectionIntegrity([
            { type: 'stats', items: [] },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'stats-items-required' }));
    });

    it('warns on empty data-list columns', () => {
        const result = probeSectionIntegrity([
            { type: 'data-list', dataUrl: '/api', columns: [] },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'data-list-columns-required' }));
    });

    it('warns on empty action-form fields', () => {
        const result = probeSectionIntegrity([
            { type: 'action-form', titleKey: 't', submitUrl: '/api', submitKey: 's', successKey: 'ok', fields: [] },
        ] as any);
        expect(result.warnings).toContainEqual(expect.objectContaining({ rule: 'action-form-fields-required' }));
    });

    it('reports correct index', () => {
        const result = probeSectionIntegrity([
            { type: 'hero', titleKey: 'h' },
            { type: 'cards', variant: 'catalog', items: [] },
        ] as any);
        expect(result.warnings[0].index).toBe(1);
    });

    it('skips types without integrity rules (hero, spacer, cta)', () => {
        const result = probeSectionIntegrity([
            { type: 'hero', titleKey: 'h' },
            { type: 'spacer' },
            { type: 'cta', titleKey: 'c' },
        ] as any);
        expect(result.valid).toBe(true);
    });
});

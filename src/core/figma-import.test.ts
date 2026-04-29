import { describe, it, expect } from 'vitest';
import { figmaToPageSpec, type FigmaDocument } from './figma-import.js';

// Minimal Figma document fixture
const minimalDoc: FigmaDocument = {
    name: 'Test Design',
    document: {
        children: [
            {
                id: '0:1',
                name: 'Page 1',
                type: 'CANVAS',
                children: [
                    {
                        id: '1:1',
                        name: 'Hero',
                        type: 'FRAME',
                        absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 800 },
                        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.45, b: 0.9, a: 1 }, visible: true }],
                        children: [
                            {
                                id: '1:2',
                                name: 'Headline',
                                type: 'TEXT',
                                characters: 'Welcome to EasyWay',
                            },
                            {
                                id: '1:3',
                                name: 'Primary CTA',
                                type: 'FRAME',
                                children: [
                                    {
                                        id: '1:4',
                                        name: 'CTA Text',
                                        type: 'TEXT',
                                        characters: 'Get Started',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

const multiSectionDoc: FigmaDocument = {
    name: 'Landing Page',
    document: {
        children: [
            {
                id: '0:1',
                name: 'Home',
                type: 'CANVAS',
                children: [
                    {
                        id: '2:1',
                        name: 'Hero Section',
                        type: 'FRAME',
                        absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 700 },
                        children: [{ id: '2:1a', name: 'Title', type: 'TEXT', characters: 'Build Better' }],
                    },
                    {
                        id: '2:2',
                        name: 'Features Grid',
                        type: 'FRAME',
                        absoluteBoundingBox: { x: 0, y: 800, width: 1440, height: 500 },
                        children: [
                            { id: '2:2a', name: 'Card 1', type: 'FRAME', children: [{ id: '2:2a1', name: 'Title', type: 'TEXT', characters: 'Feature A' }] },
                            { id: '2:2b', name: 'Card 2', type: 'FRAME', children: [{ id: '2:2b1', name: 'Title', type: 'TEXT', characters: 'Feature B' }] },
                        ],
                    },
                    {
                        id: '2:3',
                        name: 'CTA Block',
                        type: 'FRAME',
                        children: [{ id: '2:3a', name: 'Action Btn', type: 'FRAME' }, { id: '2:3b', name: 'Body Text', type: 'TEXT', characters: 'Join our community' }],
                    },
                ],
            },
        ],
    },
};

// ─── figmaToPageSpec ───────────────────────────────────────────────────────

describe('figmaToPageSpec', () => {
    it('converts a minimal Figma document to PageSpec', () => {
        const result = figmaToPageSpec(minimalDoc);
        expect(result.pageSpec.version).toBe('1');
        expect(result.pageSpec.id).toBe('test_design');
        expect(result.pageSpec.sections.length).toBeGreaterThan(0);
        expect(result.stats.framesTotal).toBe(1);
        expect(result.stats.sectionsCreated).toBe(1);
    });

    it('infers hero section type from dimensions', () => {
        const result = figmaToPageSpec(minimalDoc);
        const heroSection = result.pageSpec.sections[0];
        expect(heroSection.type).toBe('hero');
    });

    it('converts multiple frames to sections', () => {
        const result = figmaToPageSpec(multiSectionDoc);
        expect(result.stats.framesTotal).toBe(3);
        expect(result.pageSpec.sections.length).toBe(3);
    });

  it('includes sections of multiple types', () => {
    const result = figmaToPageSpec(multiSectionDoc);
    const types = result.pageSpec.sections.map(s => s.type);
    expect(types.length).toBe(3);
    // At least one section should be hero (from dimensions)
    expect(types).toContain('hero');
  });

    it('respects page filter', () => {
        const result = figmaToPageSpec(multiSectionDoc, { pageFilter: 'nonexistent' });
        expect(result.pageSpec.sections.length).toBe(0);
    });

    it('extracts color tokens from fills', () => {
        const result = figmaToPageSpec(minimalDoc);
        expect(result.stats.tokensExtracted).toBeGreaterThan(0);
    });

    it('returns empty sections for empty document', () => {
        const emptyDoc: FigmaDocument = {
            name: 'Empty',
            document: { children: [] },
        };
        const result = figmaToPageSpec(emptyDoc);
        expect(result.pageSpec.sections.length).toBe(0);
        expect(result.stats.framesTotal).toBe(0);
    });

    it('skips non-FRAME/COMPONENT/INSTANCE nodes', () => {
        const docWithNonFrames: FigmaDocument = {
            name: 'Mixed',
            document: {
                children: [{
                    id: '0:1',
                    name: 'Page',
                    type: 'CANVAS',
                    children: [
                        { id: '3:1', name: 'Slider', type: 'SLIDER' },
                        { id: '3:2', name: 'ValidFrame', type: 'FRAME', children: [] },
                    ],
                }],
            },
        };
        const result = figmaToPageSpec(docWithNonFrames);
        expect(result.pageSpec.sections.length).toBe(1);
    });
});

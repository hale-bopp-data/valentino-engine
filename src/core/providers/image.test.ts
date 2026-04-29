import { describe, it, expect } from 'vitest';
import { generatePlaceholder } from './image.js';

// ─── generatePlaceholder (synchronous, no network) ─────────────────────────

describe('generatePlaceholder', () => {
    it('generates valid SVG with default colors', () => {
        const svg = generatePlaceholder();
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
        expect(svg).toContain('#1a73e8');
        expect(svg).toContain('#0a0a0a');
        expect(svg).toContain('width="1200"');
        expect(svg).toContain('height="630"');
    });

    it('uses provided colors', () => {
        const svg = generatePlaceholder({
            primaryColor: '#ff0000',
            backgroundColor: '#ffffff',
            accentColor: '#00ff00',
            width: 800,
            height: 400,
        });
        expect(svg).toContain('#ff0000');
        expect(svg).toContain('#ffffff');
        expect(svg).toContain('#00ff00');
        expect(svg).toContain('width="800"');
        expect(svg).toContain('height="400"');
    });

  it('minimal style excludes accent rectangle', () => {
    const svg = generatePlaceholder({ style: 'minimal' });
    // Minimal style skips the accent gradient bar (the visible rectangle)
    expect(svg).not.toContain('url(#accent)');
  });

    it('corporate style includes accent bar', () => {
        const svg = generatePlaceholder({ style: 'corporate' });
        expect(svg).toContain('url(#accent)');
    });

    it('includes placeholder text', () => {
        const svg = generatePlaceholder();
        expect(svg).toContain('placeholder');
    });

    it('creates valid XML', () => {
        const svg = generatePlaceholder();
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        // Should be parseable — has matching tags
        expect(svg).toContain('<defs>');
        expect(svg).toContain('</defs>');
        expect(svg).toContain('<text');
        expect(svg).toContain('</text>');
    });
});

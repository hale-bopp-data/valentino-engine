import { describe, it, expect } from 'vitest';
import {
    parseHexColor, parseRgbColor, parseColor,
    relativeLuminance, contrastRatio, checkWcagContrast,
} from './contrast.js';

describe('parseHexColor', () => {
    it('parses #RGB shorthand', () => {
        expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
        expect(parseHexColor('#000')).toEqual([0, 0, 0]);
    });

    it('parses #RRGGBB', () => {
        expect(parseHexColor('#ff0000')).toEqual([255, 0, 0]);
        expect(parseHexColor('#00ff00')).toEqual([0, 255, 0]);
    });

    it('parses #RRGGBBAA (ignores alpha)', () => {
        expect(parseHexColor('#ff000080')).toEqual([255, 0, 0]);
    });

    it('returns null for invalid', () => {
        expect(parseHexColor('#gg')).toBeNull();
    });
});

describe('parseRgbColor', () => {
    it('parses rgb()', () => {
        expect(parseRgbColor('rgb(255, 0, 0)')).toEqual([255, 0, 0]);
    });

    it('parses rgba()', () => {
        expect(parseRgbColor('rgba(0, 128, 255, 0.5)')).toEqual([0, 128, 255]);
    });

    it('returns null for invalid', () => {
        expect(parseRgbColor('hsl(0, 100%, 50%)')).toBeNull();
    });
});

describe('parseColor', () => {
    it('delegates to hex parser', () => {
        expect(parseColor('#f00')).toEqual([255, 0, 0]);
    });

    it('delegates to rgb parser', () => {
        expect(parseColor('rgb(0, 0, 0)')).toEqual([0, 0, 0]);
    });

    it('returns null for unsupported', () => {
        expect(parseColor('red')).toBeNull();
    });
});

describe('relativeLuminance', () => {
    it('white has luminance ~1', () => {
        expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 2);
    });

    it('black has luminance 0', () => {
        expect(relativeLuminance(0, 0, 0)).toBe(0);
    });
});

describe('contrastRatio', () => {
    it('black on white = 21:1', () => {
        const ratio = contrastRatio(1.0, 0.0);
        expect(ratio).toBeCloseTo(21, 0);
    });

    it('same color = 1:1', () => {
        expect(contrastRatio(0.5, 0.5)).toBeCloseTo(1, 1);
    });
});

describe('checkWcagContrast', () => {
    it('black on white passes AA', () => {
        const result = checkWcagContrast('#000000', '#ffffff', 'AA');
        expect(result.passes).toBe(true);
        expect(result.ratio).toBeGreaterThan(20);
    });

    it('black on white passes AAA', () => {
        const result = checkWcagContrast('#000', '#fff', 'AAA');
        expect(result.passes).toBe(true);
    });

    it('light gray on white fails AA', () => {
        const result = checkWcagContrast('#cccccc', '#ffffff', 'AA');
        expect(result.passes).toBe(false);
    });

    it('returns ratio 0 for unparseable colors', () => {
        const result = checkWcagContrast('invalid', '#fff');
        expect(result.ratio).toBe(0);
        expect(result.passes).toBe(false);
    });

    it('defaults to AA level', () => {
        const result = checkWcagContrast('#000', '#fff');
        expect(result.level).toBe('AA');
    });
});

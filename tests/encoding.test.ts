import { describe, it, expect } from 'vitest';
import { checkMojibake, checkTypography, checkEncoding, MOJIBAKE_PATTERN_COUNT, TYPO_RULE_COUNT } from '../src/index.js';

function makeContent(file: string, entries: Record<string, string>) {
    return new Map([[file, new Map(Object.entries(entries))]]);
}

describe('checkMojibake', () => {
    it('detects Latin-1 mojibake for è', () => {
        const content = makeContent('it.json', { 'test.key': 'perchÃ¨ funziona' });
        const w = checkMojibake(content);
        expect(w).toHaveLength(1);
        expect(w[0].type).toBe('mojibake');
        expect(w[0].severity).toBe('error');
        expect(w[0].match).toBe('Ã¨');
    });

    it('detects Win-1252 smart quote mojibake', () => {
        const content = makeContent('en.json', { 'quote': 'It\u00e2\u20ac\u2122s broken' });
        const w = checkMojibake(content);
        expect(w.some(w => w.message.includes('right single quote'))).toBe(true);
    });

    it('no warnings for clean UTF-8', () => {
        const content = makeContent('it.json', { 'ok': 'Perché funziona così bene' });
        expect(checkMojibake(content)).toHaveLength(0);
    });

    it('no warnings for empty content', () => {
        expect(checkMojibake(new Map())).toHaveLength(0);
    });

    it('reports correct file and key', () => {
        const content = makeContent('content/it.json', { 'hero.title': 'Ã¨ rotto' });
        const w = checkMojibake(content);
        expect(w[0].file).toBe('content/it.json');
        expect(w[0].key).toBe('hero.title');
    });
});

describe('checkTypography', () => {
    it('detects Italian E-apostrophe', () => {
        const content = makeContent('it.json', { 'body': "E' importante" });
        const w = checkTypography(content, 'it');
        expect(w.some(w => w.message.includes("È"))).toBe(true);
    });

    it('detects ASCII ellipsis (any language)', () => {
        const content = makeContent('en.json', { 'text': 'Loading...' });
        const w = checkTypography(content);
        expect(w.some(w => w.message.includes('ellipsis'))).toBe(true);
    });

    it('detects double hyphen', () => {
        const content = makeContent('en.json', { 'text': 'this -- that' });
        const w = checkTypography(content);
        expect(w.some(w => w.message.includes('em dash'))).toBe(true);
    });

    it('detects straight double quotes', () => {
        const content = makeContent('en.json', { 'text': 'He said "hello"' });
        const w = checkTypography(content);
        expect(w.some(w => w.message.includes('curly quotes'))).toBe(true);
    });

    it('filters by language', () => {
        const content = makeContent('de.json', { 'text': 'fuer die Zukunft' });
        const w = checkTypography(content, 'de');
        expect(w.some(w => w.message.includes('für'))).toBe(true);
    });

    it('does not apply language-specific rules to other languages', () => {
        const content = makeContent('en.json', { 'text': 'fuer something' });
        const w = checkTypography(content, 'en');
        expect(w.some(w => w.message.includes('für'))).toBe(false);
    });

    it('no warnings for clean typography', () => {
        const content = makeContent('it.json', { 'text': 'È una bella giornata, più che mai' });
        const w = checkTypography(content, 'it');
        // Only universal rules should match, not Italian-specific
        expect(w.every(w => w.severity === 'warning')).toBe(true);
    });
});

describe('checkEncoding', () => {
    it('combines mojibake and typography checks', () => {
        const content = makeContent('it.json', {
            'broken': 'Ã¨ rotto',
            'apostrophe': "E' sbagliato",
        });
        const w = checkEncoding(content, 'it');
        expect(w.some(w => w.type === 'mojibake')).toBe(true);
        expect(w.some(w => w.type === 'typography')).toBe(true);
    });

    it('works across multiple files', () => {
        const content = new Map([
            ['it.json', new Map([['a', 'Ã¨']])],
            ['en.json', new Map([['b', 'Loading...']])],
        ]);
        const w = checkEncoding(content);
        expect(w.length).toBeGreaterThanOrEqual(2);
        expect(w.some(w => w.file === 'it.json')).toBe(true);
        expect(w.some(w => w.file === 'en.json')).toBe(true);
    });
});

describe('constants', () => {
    it('has expected mojibake pattern count', () => {
        expect(MOJIBAKE_PATTERN_COUNT).toBe(14);
    });

    it('has expected typo rule count', () => {
        expect(TYPO_RULE_COUNT).toBeGreaterThanOrEqual(15);
    });
});

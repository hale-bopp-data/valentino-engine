import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createBackup, restoreBackup, backupExists, computeDiff, formatDiff, parseFixArgs } from './backup.js';

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valentino-backup-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createBackup', () => {
    it('creates .valentino-backup file with original content', () => {
        const file = path.join(tmpDir, 'test.css');
        fs.writeFileSync(file, 'body { color: red; }');
        const result = createBackup(file);
        expect(result.backupPath).toBe(`${file}.valentino-backup`);
        expect(result.originalContent).toBe('body { color: red; }');
        expect(fs.existsSync(result.backupPath)).toBe(true);
        expect(fs.readFileSync(result.backupPath, 'utf-8')).toBe('body { color: red; }');
    });

    it('overwrites existing backup', () => {
        const file = path.join(tmpDir, 'test.css');
        fs.writeFileSync(file, 'v1');
        createBackup(file);
        fs.writeFileSync(file, 'v2');
        const result = createBackup(file);
        expect(fs.readFileSync(result.backupPath, 'utf-8')).toBe('v2');
    });
});

describe('restoreBackup', () => {
    it('restores from backup when it exists', () => {
        const file = path.join(tmpDir, 'test.css');
        fs.writeFileSync(file, 'original');
        createBackup(file);
        fs.writeFileSync(file, 'modified');
        expect(restoreBackup(file)).toBe(true);
        expect(fs.readFileSync(file, 'utf-8')).toBe('original');
    });

    it('returns false when no backup exists', () => {
        const file = path.join(tmpDir, 'nobackup.css');
        expect(restoreBackup(file)).toBe(false);
    });
});

describe('backupExists', () => {
    it('returns true when backup exists', () => {
        const file = path.join(tmpDir, 'test.css');
        fs.writeFileSync(file, 'content');
        createBackup(file);
        expect(backupExists(file)).toBe(true);
    });

    it('returns false when no backup exists', () => {
        const file = path.join(tmpDir, 'test.css');
        expect(backupExists(file)).toBe(false);
    });
});

describe('computeDiff', () => {
    it('returns empty hunks for identical content', () => {
        const hunks = computeDiff('line1\nline2', 'line1\nline2');
        expect(hunks).toHaveLength(0);
    });

    it('detects single line change', () => {
        const hunks = computeDiff(
            'line1\ncolor: red;\nline3',
            'line1\ncolor: var(--valentino-color-red);\nline3'
        );
        expect(hunks).toHaveLength(1);
        const changed = hunks[0].lines.filter(l => l.type !== 'context');
        expect(changed).toHaveLength(2);
        expect(changed[0].type).toBe('removed');
        expect(changed[0].content).toBe('color: red;');
        expect(changed[1].type).toBe('added');
        expect(changed[1].content).toBe('color: var(--valentino-color-red);');
    });

    it('merges nearby changes into one hunk', () => {
        const hunks = computeDiff(
            'a\nb\nc\nd\ne',
            'a\nB\nc\nD\ne'
        );
        expect(hunks).toHaveLength(1);
    });

    it('separates distant changes into separate hunks', () => {
        const lines = Array.from({ length: 20 }, (_, i) => `line${i}`);
        const modified = [...lines];
        modified[1] = 'CHANGED1';
        modified[18] = 'CHANGED18';
        const hunks = computeDiff(lines.join('\n'), modified.join('\n'));
        expect(hunks.length).toBeGreaterThanOrEqual(2);
    });
});

describe('formatDiff', () => {
    it('returns no-change message for empty hunks', () => {
        const result = formatDiff([], 'test.css');
        expect(result).toContain('No changes');
    });

    it('formats hunks with +/- prefixes', () => {
        const hunks = computeDiff(
            'a\nold\nc',
            'a\nnew\nc'
        );
        const output = formatDiff(hunks, 'test.css');
        expect(output).toContain('--- test.css.valentino-backup');
        expect(output).toContain('+++ test.css');
        expect(output).toContain('- old');
        expect(output).toContain('+ new');
    });
});

describe('parseFixArgs', () => {
    it('extracts --fix flag', () => {
        const result = parseFixArgs(['style.css', '--fix']);
        expect(result.fix).toBe(true);
        expect(result.file).toBe('style.css');
        expect(result.noBackup).toBe(false);
    });

    it('extracts --no-backup flag', () => {
        const result = parseFixArgs(['--fix', '--no-backup', 'file.css']);
        expect(result.fix).toBe(true);
        expect(result.noBackup).toBe(true);
        expect(result.file).toBe('file.css');
    });

    it('handles file-only args', () => {
        const result = parseFixArgs(['theme.css']);
        expect(result.fix).toBe(false);
        expect(result.file).toBe('theme.css');
    });

    it('handles empty args', () => {
        const result = parseFixArgs([]);
        expect(result.fix).toBe(false);
        expect(result.file).toBeUndefined();
    });
});

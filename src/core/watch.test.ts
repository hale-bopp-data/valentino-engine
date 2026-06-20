import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { auditFileForWatch, formatWatchEvent } from './watch.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valentino-watch-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('auditFileForWatch — CSS', () => {
  it('returns clean event for valid CSS', () => {
    const file = path.join(tmpDir, 'clean.css');
    fs.writeFileSync(file, '.btn { display: flex; }');
    const event = auditFileForWatch(file);
    expect(event.violations).toBe(0);
    expect(event.file).toBe(file);
    expect(event.timestamp).toBeTruthy();
  });

  it('returns violations for bad CSS', () => {
    const file = path.join(tmpDir, 'bad.css');
    fs.writeFileSync(file, 'body { color: red; }');
    const event = auditFileForWatch(file);
    expect(event.violations).toBeGreaterThan(0);
    expect(event.details.length).toBeGreaterThan(0);
  });

  it('detects self-referencing tokens', () => {
    const file = path.join(tmpDir, 'loop.css');
    fs.writeFileSync(file, '--loop: var(--loop);');
    const event = auditFileForWatch(file);
    expect(event.violations).toBeGreaterThan(0);
    expect(event.details.some(d => d.includes('[token]'))).toBe(true);
  });

  it('detects token override warnings', () => {
    const file = path.join(tmpDir, 'override.css');
    fs.writeFileSync(file, '.card { --custom: red; }');
    const event = auditFileForWatch(file);
    expect(event.warnings).toBeGreaterThan(0);
  });
});

describe('auditFileForWatch — HTML', () => {
  it('returns clean event for valid HTML', () => {
    const file = path.join(tmpDir, 'clean.html');
    fs.writeFileSync(file, '<html><body><p>ok</p></body></html>');
    const event = auditFileForWatch(file);
    expect(event.violations).toBe(0);
  });

  it('detects inline styles on critical elements', () => {
    const file = path.join(tmpDir, 'bad.html');
    fs.writeFileSync(file, '<form style="display:none">');
    const event = auditFileForWatch(file);
    expect(event.violations).toBeGreaterThan(0);
  });

  it('audits CSS in style tags', () => {
    const file = path.join(tmpDir, 'styled.html');
    fs.writeFileSync(file, '<style>--loop: var(--loop);</style>');
    const event = auditFileForWatch(file);
    expect(event.violations).toBeGreaterThan(0);
  });
});

describe('formatWatchEvent', () => {
  it('formats clean event', () => {
    const event = {
      file: 'test.css',
      timestamp: '2026-06-20T12:00:00Z',
      violations: 0,
      warnings: 0,
      details: [],
    };
    const output = formatWatchEvent(event);
    expect(output).toContain('CLEAN');
    expect(output).toContain('test.css');
  });

  it('formats dirty event', () => {
    const event = {
      file: 'test.css',
      timestamp: '2026-06-20T12:00:00Z',
      violations: 2,
      warnings: 1,
      details: ['violation 1', 'violation 2'],
    };
    const output = formatWatchEvent(event);
    expect(output).toContain('DIRTY');
    expect(output).toContain('2 violation(s)');
  });

  it('truncates long detail list', () => {
    const event = {
      file: 'test.css',
      timestamp: '2026-06-20T12:00:00Z',
      violations: 15,
      warnings: 0,
      details: Array.from({ length: 15 }, (_, i) => `detail ${i}`),
    };
    const output = formatWatchEvent(event);
    expect(output).toContain('... and 5 more');
  });
});

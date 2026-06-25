import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runAudit, detectFileType, extractStyleCss } from './audit-pipeline.js';
import { generateReport } from './report.js';
import { auditFileForWatch } from './watch.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valentino-pipeline-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('detectFileType', () => {
  it('detects html and css', () => {
    expect(detectFileType('a.html')).toBe('html');
    expect(detectFileType('a.HTM')).toBe('html');
    expect(detectFileType('a.css')).toBe('css');
    expect(detectFileType('noext')).toBe('css');
  });
});

describe('extractStyleCss', () => {
  it('extracts css from style tags', () => {
    expect(extractStyleCss('<style>.a{color:var(--x)}</style>')).toContain('.a{color:var(--x)}');
    expect(extractStyleCss('<p>no style</p>')).toBe('');
  });
});

describe('runAudit — CSS', () => {
  it('passes clean css', () => {
    const result = runAudit('.btn { display: flex; }', 'css');
    expect(result.passed).toBe(true);
    expect(result.totalViolations).toBe(0);
  });

  it('flags named colors', () => {
    const result = runAudit('body { color: red; }', 'css');
    expect(result.passed).toBe(false);
    const css = result.sections.find(s => s.name === 'CSS Guardrails');
    expect(css!.violations).toBeGreaterThan(0);
  });

  it('honours allowTokenDefinitions', () => {
    const css = ':root {\n  --vr-12: 12px;\n}\n.btn { display: flex; }';
    expect(runAudit(css, 'css').totalViolations).toBeGreaterThan(0);
    expect(runAudit(css, 'css', { allowTokenDefinitions: true }).totalViolations).toBe(0);
  });
});

describe('runAudit — HTML runs CSS guardrails over <style> (Bug #3149 drift #1)', () => {
  it('flags hardcoded color inside a style tag', () => {
    const result = runAudit('<style>.x { color: red; }</style>', 'html');
    const css = result.sections.find(s => s.name === 'CSS Guardrails');
    expect(css).toBeDefined();
    expect(css!.violations).toBeGreaterThan(0);
    expect(result.totalViolations).toBeGreaterThan(0);
  });
});

describe('report / watch parity (Bug #3149)', () => {
  const fixtures: Array<{ name: string; content: string }> = [
    { name: 'clean.css', content: '.btn { display: flex; }' },
    { name: 'named.css', content: 'body { color: red; }' },
    { name: 'tokendef.css', content: ':root { --vr-12: 12px; }\n.b { display: flex; }' },
    { name: 'override.css', content: '.card { --custom: blue; }' },
    { name: 'clean.html', content: '<html><body><p>ok</p></body></html>' },
    { name: 'inline.html', content: '<form style="display:none"><input onclick="x()"></form>' },
    { name: 'styled.html', content: '<style>.x { color: red; }</style>' },
  ];

  for (const { name, content } of fixtures) {
    it(`same violation/warning counts for ${name}`, () => {
      const file = path.join(tmpDir, name);
      fs.writeFileSync(file, content);

      const report = generateReport(file);
      const event = auditFileForWatch(file);

      expect(event.violations).toBe(report.totalViolations);
      expect(event.warnings).toBe(report.totalWarnings);
    });
  }

  it('watch no longer misses CSS guardrails inside <style> (drift #1 regression)', () => {
    const file = path.join(tmpDir, 'styled.html');
    fs.writeFileSync(file, '<style>.x { color: red; }</style>');

    const report = generateReport(file);
    const event = auditFileForWatch(file);

    expect(report.sections.find(s => s.name === 'CSS Guardrails')!.violations).toBeGreaterThan(0);
    expect(event.violations).toBeGreaterThan(0);
    expect(event.violations).toBe(report.totalViolations);
  });
});

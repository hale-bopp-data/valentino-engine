import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateReport, formatReport } from './report.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valentino-report-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('generateReport — CSS', () => {
  it('reports clean CSS file', () => {
    const file = path.join(tmpDir, 'clean.css');
    fs.writeFileSync(file, '.btn { display: flex; }');
    const report = generateReport(file);
    expect(report.fileType).toBe('css');
    expect(report.passed).toBe(true);
    expect(report.totalViolations).toBe(0);
  });

  it('detects named color violations', () => {
    const file = path.join(tmpDir, 'bad.css');
    fs.writeFileSync(file, 'body { color: red; }');
    const report = generateReport(file);
    expect(report.passed).toBe(false);
    expect(report.totalViolations).toBeGreaterThan(0);
  });

  it('includes token validation section', () => {
    const file = path.join(tmpDir, 'tokens.css');
    fs.writeFileSync(file, '--loop: var(--loop);');
    const report = generateReport(file);
    const tokenSection = report.sections.find(s => s.name === 'Token Validation');
    expect(tokenSection).toBeDefined();
    expect(tokenSection!.violations).toBeGreaterThan(0);
  });

  it('includes security section for CSS', () => {
    const file = path.join(tmpDir, 'sec.css');
    fs.writeFileSync(file, '.card { --override: red; }');
    const report = generateReport(file);
    const secSection = report.sections.find(s => s.name === 'Security Certification');
    expect(secSection).toBeDefined();
  });

  it('skips token definitions with allowTokenDefinitions option', () => {
    const file = path.join(tmpDir, 'tokens.css');
    fs.writeFileSync(file, ':root {\n  --vr-12: 12px;\n  --vc-accent: #0072bc;\n}\n.btn { display: flex; }');
    const without = generateReport(file);
    const withOption = generateReport(file, { allowTokenDefinitions: true });
    expect(without.totalViolations).toBeGreaterThan(0);
    expect(withOption.totalViolations).toBe(0);
  });
});

describe('generateReport — HTML', () => {
  it('reports clean HTML file', () => {
    const file = path.join(tmpDir, 'clean.html');
    fs.writeFileSync(file, '<html><body><p>hello</p></body></html>');
    const report = generateReport(file);
    expect(report.fileType).toBe('html');
    expect(report.passed).toBe(true);
  });

  it('detects inline style violations', () => {
    const file = path.join(tmpDir, 'bad.html');
    fs.writeFileSync(file, '<form style="display:none"><input onclick="x()">');
    const report = generateReport(file);
    expect(report.passed).toBe(false);
    const secSection = report.sections.find(s => s.name === 'Security Certification');
    expect(secSection!.violations).toBeGreaterThan(0);
  });

  it('audits CSS within style tags', () => {
    const file = path.join(tmpDir, 'styled.html');
    fs.writeFileSync(file, '<html><head><style>body { color: red; }</style></head><body></body></html>');
    const report = generateReport(file);
    const cssSection = report.sections.find(s => s.name === 'CSS Guardrails');
    expect(cssSection).toBeDefined();
  });
});

describe('formatReport', () => {
  it('formats passing report', () => {
    const file = path.join(tmpDir, 'ok.css');
    fs.writeFileSync(file, '.btn { display: flex; }');
    const report = generateReport(file);
    const output = formatReport(report);
    expect(output).toContain('RESULT: PASS');
  });

  it('formats failing report', () => {
    const file = path.join(tmpDir, 'fail.css');
    fs.writeFileSync(file, 'body { color: red; }');
    const report = generateReport(file);
    const output = formatReport(report);
    expect(output).toContain('RESULT: FAIL');
    expect(output).toContain('FAIL');
  });

  it('contains section headers', () => {
    const file = path.join(tmpDir, 'test.css');
    fs.writeFileSync(file, 'body { color: var(--ok); }');
    const report = generateReport(file);
    const output = formatReport(report);
    expect(output).toContain('CSS Guardrails');
    expect(output).toContain('Token Validation');
  });

  it('truncates long detail lists', () => {
    const file = path.join(tmpDir, 'many.css');
    const lines = Array.from({ length: 30 }, (_, i) => `p { color: red; }`).join('\n');
    fs.writeFileSync(file, lines);
    const report = generateReport(file);
    const output = formatReport(report);
    expect(output).toContain('... and');
  });
});

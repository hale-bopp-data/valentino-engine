import { describe, it, expect } from 'vitest';
import { formatAuditDom, auditDomToJson } from '../src/core/audit-dom.js';
import type { AuditDomResult } from '../src/core/audit-dom.js';

const makeResult = (overrides: Partial<AuditDomResult> = {}): AuditDomResult => ({
  passed: true,
  available: true,
  url: 'http://localhost:3000',
  violations: [],
  consoleMessages: [],
  pageErrors: [],
  failedResources: [],
  durationMs: 123,
  summary: 'audit-dom PASS — 0 warning(s)',
  viewport: { width: 1440, height: 900 },
  pageTitle: 'Test Page',
  ...overrides,
});

describe('audit-dom', () => {
  describe('formatAuditDom', () => {
    it('formats passing result', () => {
      const output = formatAuditDom(makeResult(), 'http://localhost:3000');
      expect(output).toContain('PASS');
      expect(output).toContain('Test Page');
      expect(output).toContain('123ms');
    });

    it('formats failing result with violations', () => {
      const result = makeResult({
        passed: false,
        violations: [
          { type: 'overflow', severity: 'error', message: 'Horizontal overflow detected' },
          { type: 'inline-style', severity: 'warning', selector: 'div.hero', message: 'Inline style detected', details: 'color: red' },
          { type: 'missing-label', severity: 'error', selector: 'button.submit', message: 'Interactive element without accessible label' },
        ],
        summary: 'audit-dom FAIL — 2 error(s), 1 warning(s)',
      });
      const output = formatAuditDom(result, 'http://localhost:3000');
      expect(output).toContain('FAIL');
      expect(output).toContain('OVERFLOW');
      expect(output).toContain('INLINE-STYLE');
      expect(output).toContain('MISSING-LABEL');
      expect(output).toContain('div.hero');
    });

    it('shows failed resources', () => {
      const result = makeResult({
        failedResources: ['404 http://localhost:3000/missing.js'],
      });
      const output = formatAuditDom(result, 'http://localhost:3000');
      expect(output).toContain('FAILED RESOURCES');
      expect(output).toContain('missing.js');
    });

    it('shows page errors', () => {
      const result = makeResult({
        pageErrors: ['ReferenceError: foo is not defined'],
      });
      const output = formatAuditDom(result, 'http://localhost:3000');
      expect(output).toContain('PAGE ERRORS');
      expect(output).toContain('ReferenceError');
    });
  });

  describe('auditDomToJson', () => {
    it('creates JSON output with all sections', () => {
      const result = makeResult();
      const json = auditDomToJson(result);
      expect(json.tool).toBe('audit-dom');
      expect(json.passed).toBe(true);
      expect(json.sections).toHaveLength(5);
      expect(json.sections.map(s => s.name)).toEqual([
        'Inline Styles', 'Overflow', 'Console Errors', 'Network Errors', 'Accessibility Labels',
      ]);
    });

    it('marks sections as fail when violations present', () => {
      const result = makeResult({
        passed: false,
        violations: [
          { type: 'overflow', severity: 'error', message: 'overflow' },
          { type: 'network-error', severity: 'error', message: '404', details: '404 /x.js' },
          { type: 'missing-label', severity: 'error', selector: 'button', message: 'no label' },
        ],
      });
      const json = auditDomToJson(result);
      expect(json.passed).toBe(false);
      expect(json.exitCode).toBe(1);
      const overflow = json.sections.find(s => s.name === 'Overflow');
      expect(overflow?.status).toBe('fail');
      const network = json.sections.find(s => s.name === 'Network Errors');
      expect(network?.status).toBe('fail');
      const a11y = json.sections.find(s => s.name === 'Accessibility Labels');
      expect(a11y?.status).toBe('fail');
    });

    it('includes schemaVersion and timestamp', () => {
      const json = auditDomToJson(makeResult());
      expect(json.schemaVersion).toBe(1);
      expect(json.timestamp).toBeTruthy();
    });
  });
});

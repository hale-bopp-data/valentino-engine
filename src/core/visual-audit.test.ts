import { describe, it, expect } from 'vitest';
import { runVisualAudit, formatVisualAudit, runResponsiveAudit, formatResponsiveAudit, EXIT_CODES } from './visual-audit.js';

describe('runVisualAudit', () => {
  it('returns result with available flag', async () => {
    const html = '<html><body><div>test</div></body></html>';
    const result = await runVisualAudit(html);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('summary');
  });

  it('handles empty HTML gracefully', async () => {
    const result = await runVisualAudit('');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('summary');
  });
});

describe('formatVisualAudit', () => {
  it('formats skipped result', () => {
    const result = {
      passed: true,
      available: false,
      violations: [],
      warnings: [],
      elementCount: 0,
      durationMs: 0,
      summary: 'Visual audit skipped: Playwright not installed.',
    };
    const output = formatVisualAudit(result, 'test.html');
    expect(output).toContain('Visual audit');
    expect(output).toContain('test.html');
  });

  it('formats passed result', () => {
    const result = {
      passed: true,
      available: true,
      violations: [],
      warnings: [],
      elementCount: 3,
      durationMs: 100,
      summary: 'Visual audit passed',
    };
    const output = formatVisualAudit(result, 'page.html');
    expect(output).toContain('PASSED');
    expect(output).toContain('3');
  });

  it('formats failed result with violations', () => {
    const result = {
      passed: false,
      available: true,
      violations: [{
        type: 'overflow' as const,
        severity: 'error' as const,
        selector: 'div',
        message: 'Horizontal overflow',
      }],
      warnings: [],
      elementCount: 1,
      durationMs: 50,
      summary: 'Visual audit FAILED',
    };
    const output = formatVisualAudit(result, 'page.html');
    expect(output).toContain('FAILED');
    expect(output).toContain('ERRORS');
    expect(output).toContain('overflow');
  });

  it('formats warnings section', () => {
    const result = {
      passed: true,
      available: true,
      violations: [],
      warnings: [{
        type: 'contrast' as const,
        severity: 'warning' as const,
        message: 'Low contrast 2.5:1',
      }],
      elementCount: 1,
      durationMs: 50,
      summary: 'passed',
    };
    const output = formatVisualAudit(result, 'page.html');
    expect(output).toContain('WARNINGS');
    expect(output).toContain('contrast');
  });
});

describe('EXIT_CODES', () => {
  it('exports expected exit codes', () => {
    expect(EXIT_CODES.PASS).toBe(0);
    expect(EXIT_CODES.VIOLATIONS).toBe(1);
    expect(EXIT_CODES.TOOL_ERROR).toBe(2);
    expect(EXIT_CODES.NO_BROWSER).toBe(3);
  });
});

describe('runVisualAudit — URL detection', () => {
  it('accepts result structure with viewport and phase', async () => {
    const result = await runVisualAudit('<html><body>test</body></html>');
    expect(result).toHaveProperty('passed');
    if (result.available) {
      expect(result).toHaveProperty('viewport');
      expect(result).toHaveProperty('phase');
    }
  });
});

describe('runResponsiveAudit', () => {
  it('returns result with 3 viewports', async () => {
    const result = await runResponsiveAudit('<html><body>test</body></html>');
    expect(result).toHaveProperty('viewports');
    expect(result.viewports).toHaveLength(3);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('durationMs');
  });
});

describe('formatResponsiveAudit', () => {
  it('formats multi-viewport result', () => {
    const vp = {
      passed: true,
      available: false,
      violations: [],
      warnings: [],
      elementCount: 0,
      durationMs: 0,
      summary: 'skipped',
      viewport: { width: 1440, height: 900 },
    };
    const result = {
      viewports: [vp, { ...vp, viewport: { width: 768, height: 1024 } }, { ...vp, viewport: { width: 390, height: 844 } }],
      passed: true,
      summary: 'all pass',
      durationMs: 100,
    };
    const output = formatResponsiveAudit(result, 'test.html');
    expect(output).toContain('Responsive visual audit');
    expect(output).toContain('desktop');
    expect(output).toContain('RESPONSIVE RESULT: PASS');
  });
});

describe('formatVisualAudit — viewport label', () => {
  it('includes viewport dimensions in output', () => {
    const result = {
      passed: true,
      available: true,
      violations: [],
      warnings: [],
      elementCount: 2,
      durationMs: 50,
      summary: 'ok',
      viewport: { width: 390, height: 844 },
    };
    const output = formatVisualAudit(result, 'page.html');
    expect(output).toContain('[390x844]');
  });
});

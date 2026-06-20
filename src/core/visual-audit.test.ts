import { describe, it, expect } from 'vitest';
import { runVisualAudit, formatVisualAudit } from './visual-audit.js';

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

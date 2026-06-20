import { describe, it, expect } from 'vitest';
import { verifyTokensRuntime, formatVerifyRuntime } from './verify-tokens-runtime.js';

describe('verifyTokensRuntime', () => {
  it('returns result object with expected fields', async () => {
    const result = await verifyTokensRuntime(':root { --c: blue; }');
    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('summary');
  });

  it('handles empty CSS', async () => {
    const result = await verifyTokensRuntime('');
    expect(result.totalTokens).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('handles CSS with no custom properties', async () => {
    const result = await verifyTokensRuntime('body { color: red; }');
    expect(result.totalTokens).toBe(0);
    expect(result.passed).toBe(true);
  });
});

describe('formatVerifyRuntime', () => {
  it('formats skipped result', () => {
    const result = {
      available: false,
      passed: true,
      results: [],
      unresolvedCount: 0,
      mismatchCount: 0,
      totalTokens: 0,
      durationMs: 0,
      summary: 'Runtime verification skipped: Playwright not installed.',
    };
    const output = formatVerifyRuntime(result);
    expect(output).toContain('skipped');
  });

  it('formats passed result', () => {
    const result = {
      available: true,
      passed: true,
      results: [{ token: '--c', expected: 'blue', actual: 'blue', resolved: true, match: true }],
      unresolvedCount: 0,
      mismatchCount: 0,
      totalTokens: 1,
      durationMs: 50,
      summary: 'All 1 token(s) resolve correctly',
    };
    const output = formatVerifyRuntime(result);
    expect(output).toContain('PASSED');
    expect(output).toContain('Resolved: 1');
  });

  it('formats failed result', () => {
    const result = {
      available: true,
      passed: false,
      results: [{ token: '--c', expected: 'var(--c)', actual: '', resolved: false, match: false }],
      unresolvedCount: 1,
      mismatchCount: 0,
      totalTokens: 1,
      durationMs: 50,
      summary: '1/1 token(s) failed to resolve',
    };
    const output = formatVerifyRuntime(result);
    expect(output).toContain('FAILED');
    expect(output).toContain('Unresolved: 1');
  });
});

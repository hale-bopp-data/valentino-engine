import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMEOUTS,
  PLAYWRIGHT_INSTALL_HINT,
  isContextDestroyedError,
  isBrowserNotInstalledError,
  evaluateWithRetry,
  loadPlaywright,
  withBrowser,
} from '../src/core/playwright-runtime.js';

const noSleep = async () => { /* no real delay in tests */ };

function makePage(behaviors: Array<'ok' | 'destroy' | 'fatal'>, value: unknown = { ok: true }) {
  let i = 0;
  return {
    calls: () => i,
    evaluate: async () => {
      const b = behaviors[Math.min(i, behaviors.length - 1)];
      i++;
      if (b === 'destroy') throw new Error('Execution context was destroyed, most likely because of a navigation.');
      if (b === 'fatal') throw new Error('SyntaxError: Unexpected token in audit script');
      return value;
    },
  };
}

describe('playwright-runtime — defaults', () => {
  it('exposes sane default timeouts', () => {
    expect(DEFAULT_TIMEOUTS.navMs).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_TIMEOUTS.settleMs).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_TIMEOUTS.evaluateRetries).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_TIMEOUTS.retryBackoffMs).toBeGreaterThanOrEqual(0);
  });

  it('install hint is actionable', () => {
    expect(PLAYWRIGHT_INSTALL_HINT).toContain('playwright install');
  });
});

describe('playwright-runtime — error classification', () => {
  it('detects transient context-destroyed errors', () => {
    expect(isContextDestroyedError(new Error('Execution context was destroyed, most likely because of a navigation.'))).toBe(true);
    expect(isContextDestroyedError(new Error('Cannot find context with specified id'))).toBe(true);
    expect(isContextDestroyedError(new Error('Target closed'))).toBe(true);
  });

  it('does not flag unrelated errors as transient', () => {
    expect(isContextDestroyedError(new Error('SyntaxError: Unexpected token'))).toBe(false);
    expect(isContextDestroyedError('boom')).toBe(false);
  });

  it('detects missing chromium binary (actionable install)', () => {
    expect(isBrowserNotInstalledError(new Error("Executable doesn't exist at /path/chrome"))).toBe(true);
    expect(isBrowserNotInstalledError(new Error('Please run the following command to download new browsers'))).toBe(true);
    expect(isBrowserNotInstalledError(new Error('run: npx playwright install'))).toBe(true);
  });

  it('does not flag unrelated launch errors as missing-binary', () => {
    expect(isBrowserNotInstalledError(new Error('connection refused'))).toBe(false);
  });
});

describe('playwright-runtime — evaluateWithRetry', () => {
  it('returns the value on first success without retrying', async () => {
    const page = makePage(['ok'], { count: 7 });
    const out = await evaluateWithRetry(page, '() => 0', undefined, { sleep: noSleep });
    expect(out).toEqual({ count: 7 });
    expect(page.calls()).toBe(1);
  });

  it('retries a transient context-destroyed error then succeeds', async () => {
    const page = makePage(['destroy', 'destroy', 'ok'], { recovered: true });
    const attempts: number[] = [];
    const out = await evaluateWithRetry(page, '() => 0', undefined, {
      retries: 2,
      sleep: noSleep,
      onRetry: (n) => attempts.push(n),
    });
    expect(out).toEqual({ recovered: true });
    expect(attempts).toEqual([1, 2]);
    expect(page.calls()).toBe(3);
  });

  it('fails loud immediately on a non-transient error (no retry)', async () => {
    const page = makePage(['fatal'], {});
    await expect(evaluateWithRetry(page, '() => 0', undefined, { retries: 3, sleep: noSleep }))
      .rejects.toThrow(/SyntaxError/);
    expect(page.calls()).toBe(1);
  });

  it('throws after exhausting retries on a persistent context-destroyed error', async () => {
    const page = makePage(['destroy'], {});
    await expect(evaluateWithRetry(page, '() => 0', undefined, { retries: 2, sleep: noSleep }))
      .rejects.toThrow(/Execution context was destroyed/);
    expect(page.calls()).toBe(3);
  });
});

describe('playwright-runtime — loadPlaywright / withBrowser', () => {
  it('loadPlaywright returns a boolean availability with an actionable reason when missing', async () => {
    const r = await loadPlaywright();
    expect(typeof r.available).toBe('boolean');
    if (!r.available) {
      expect(r.reason).toContain('playwright install');
    }
  });

  it('withBrowser surfaces an actionable reason when Playwright/chromium is unavailable', async () => {
    const r = await withBrowser(async () => 'ran');
    expect(typeof r.available).toBe('boolean');
    if (r.available) {
      expect(r.value).toBe('ran');
    } else {
      expect(r.reason).toBeTruthy();
    }
  });
});

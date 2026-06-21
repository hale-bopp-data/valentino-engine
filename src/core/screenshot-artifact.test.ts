/**
 * Tests for screenshot artifact support (#3081).
 * Validates the filename helper, the screenshot field contract on results,
 * and the stable JSON schema passthrough. Browser-dependent capture is tested
 * conditionally (skipped when Playwright is not installed).
 */

import { describe, it, expect } from 'vitest';
import {
  screenshotFileName,
  runVisualAudit,
  DEFAULT_SCREENSHOT_DIR,
} from '../core/visual-audit.js';
import { auditDomToJson, type AuditDomResult } from '../core/audit-dom.js';

async function playwrightAvailable(): Promise<boolean> {
  try {
    // @ts-ignore optional peer
    await import(/* webpackIgnore: true */ 'playwright');
    return true;
  } catch {
    return false;
  }
}

describe('screenshotFileName (#3081)', () => {
  it('slugifies a URL (no protocol) and embeds viewport + .png', () => {
    const name = screenshotFileName('https://example.com/app/dashboard', 1440, 900);
    expect(name).toMatch(/^valentino-example-com-app-dashboard-1440x900-.*\.png$/);
    expect(name).not.toContain('https');
    expect(name).not.toContain('/');
  });

  it('falls back to inline-html for non-URL sources', () => {
    expect(screenshotFileName('inline-html', 390, 844)).toMatch(/^valentino-inline-html-390x844-.*\.png$/);
  });

  it('produces distinct names per viewport', () => {
    const a = screenshotFileName('http://x.test', 1440, 900);
    const b = screenshotFileName('http://x.test', 390, 844);
    expect(a).toContain('1440x900');
    expect(b).toContain('390x844');
    expect(a).not.toBe(b);
  });

  it('DEFAULT_SCREENSHOT_DIR is the documented default', () => {
    expect(DEFAULT_SCREENSHOT_DIR).toBe('.valentino/screenshots');
  });
});

describe('runVisualAudit screenshot contract (#3081)', () => {
  it('returns screenshot=null with a reason when Playwright is unavailable', async () => {
    if (await playwrightAvailable()) return; // covered by the conditional test below
    const result = await runVisualAudit('<html><body><h1>hi</h1></body></html>');
    expect(result.available).toBe(false);
    expect(result.screenshot).toBeNull();
    expect(result.screenshotReason).toContain('Playwright not installed');
  });

  it('captures a screenshot when Playwright is available', async () => {
    if (!(await playwrightAvailable())) return;
    const { existsSync, rmSync } = await import('fs');
    const dir = '.valentino/test-screenshots';
    const result = await runVisualAudit('<html><body><h1>hi</h1></body></html>', {
      settleMs: 0,
      screenshotDir: dir,
    });
    expect(result.available).toBe(true);
    expect(typeof result.screenshot).toBe('string');
    if (result.screenshot) expect(existsSync(result.screenshot)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not capture when screenshot=false (available path)', async () => {
    if (!(await playwrightAvailable())) return;
    const result = await runVisualAudit('<html><body><h1>hi</h1></body></html>', {
      settleMs: 0,
      screenshot: false,
    });
    expect(result.screenshot).toBeNull();
    expect(result.screenshotReason).toBe('disabled');
  });
});

describe('auditDomToJson screenshot passthrough (#3081)', () => {
  it('carries the screenshot path into the stable JSON schema', () => {
    const result: AuditDomResult = {
      passed: true,
      available: true,
      url: 'http://x.test',
      violations: [],
      consoleMessages: [],
      pageErrors: [],
      failedResources: [],
      durationMs: 1,
      summary: 'ok',
      screenshot: '.valentino/screenshots/shot.png',
    };
    const json = auditDomToJson(result);
    expect(json.schemaVersion).toBe(2);
    expect(json.screenshot).toBe('.valentino/screenshots/shot.png');
  });

  it('passes through null screenshot', () => {
    const result: AuditDomResult = {
      passed: true,
      available: false,
      url: '',
      violations: [],
      consoleMessages: [],
      pageErrors: [],
      failedResources: [],
      durationMs: 0,
      summary: 'skip',
      screenshot: null,
    };
    expect(auditDomToJson(result).screenshot).toBeNull();
  });
});

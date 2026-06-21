import { createJsonOutput, type JsonOutput } from './json-output.js';

export interface DomViolation {
  type: 'inline-style' | 'overflow' | 'console-error' | 'network-error' | 'missing-label';
  severity: 'error' | 'warning';
  selector?: string;
  message: string;
  details?: string;
}

export interface AuditDomResult {
  passed: boolean;
  available: boolean;
  url: string;
  violations: DomViolation[];
  consoleMessages: string[];
  pageErrors: string[];
  failedResources: string[];
  durationMs: number;
  summary: string;
  viewport?: { width: number; height: number };
  pageTitle?: string;
}

export interface AuditDomOptions {
  viewports?: Array<{ width: number; height: number; label: string }>;
  settleMs?: number;
  json?: boolean;
}

export const EXIT_CODES = {
  PASS: 0,
  VIOLATIONS: 1,
  TOOL_ERROR: 2,
  NO_BROWSER: 3,
} as const;

const DEFAULT_VIEWPORTS = [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile' },
] as const;

const SKIPPED_RESULT: AuditDomResult = {
  passed: true,
  available: false,
  url: '',
  violations: [],
  consoleMessages: [],
  pageErrors: [],
  failedResources: [],
  durationMs: 0,
  summary: 'Playwright not available — audit-dom skipped.',
};

const AUDIT_DOM_SCRIPT = `
() => {
  const violations = [];

  const els = document.querySelectorAll('*');
  for (const el of els) {
    const style = el.getAttribute('style');
    if (style && style.trim().length > 0) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : '';
      const selector = tag + id + cls;
      violations.push({
        type: 'inline-style',
        severity: 'warning',
        selector,
        message: 'Inline style detected in runtime DOM',
        details: style.length > 120 ? style.substring(0, 120) + '...' : style,
      });
    }
  }

  const overflowX = document.documentElement.scrollWidth > window.innerWidth;
  if (overflowX) {
    violations.push({
      type: 'overflow',
      severity: 'error',
      message: 'Horizontal overflow detected: scrollWidth(' + document.documentElement.scrollWidth + ') > innerWidth(' + window.innerWidth + ')',
    });
  }

  const interactive = document.querySelectorAll('button, input, select, textarea, a, [role="button"], [role="link"], [role="checkbox"], [role="radio"]');
  for (const el of interactive) {
    const tag = el.tagName.toLowerCase();
    const ariaLabel = el.getAttribute('aria-label');
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    const title = el.getAttribute('title');
    const text = el.textContent?.trim();
    const label = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    const placeholder = el.getAttribute('placeholder');

    if (!ariaLabel && !ariaLabelledBy && !title && !text && !label && !placeholder) {
      const id = el.id ? '#' + el.id : '';
      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : '';
      const selector = tag + id + cls;
      violations.push({
        type: 'missing-label',
        severity: 'error',
        selector,
        message: 'Interactive element without accessible label',
      });
    }
  }

  return { violations, title: document.title };
}
`;

export async function runAuditDom(
  url: string,
  options: AuditDomOptions = {},
): Promise<AuditDomResult> {
  const t0 = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return SKIPPED_RESULT;
  }

  const { settleMs = 2000 } = options;
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const failedResources: string[] = [];
  const violations: DomViolation[] = [];

  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    page.on('console', (msg: { type: () => string; text: () => string }) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMessages.push(`[${type}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err: Error) => {
      pageErrors.push(err.message);
    });

    page.on('response', (response: { status: () => number; url: () => string }) => {
      const status = response.status();
      if (status >= 400) {
        failedResources.push(`${status} ${response.url()}`);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(settleMs);

    const result = await page.evaluate(AUDIT_DOM_SCRIPT);
    violations.push(...(result.violations || []));

    for (const msg of consoleMessages) {
      if (msg.startsWith('[error]')) {
        violations.push({
          type: 'console-error',
          severity: 'warning',
          message: msg,
        });
      }
    }

    for (const res of failedResources) {
      violations.push({
        type: 'network-error',
        severity: 'error',
        message: `Failed resource: ${res}`,
        details: res,
      });
    }

    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    return {
      passed: errors.length === 0,
      available: true,
      url,
      violations,
      consoleMessages,
      pageErrors,
      failedResources,
      durationMs: Date.now() - t0,
      summary: errors.length === 0
        ? `audit-dom PASS — ${warnings.length} warning(s)`
        : `audit-dom FAIL — ${errors.length} error(s), ${warnings.length} warning(s)`,
      viewport: { width: 1440, height: 900 },
      pageTitle: result.title,
    };
  } catch (err) {
    return {
      passed: false,
      available: true,
      url,
      violations: [{
        type: 'console-error',
        severity: 'error',
        message: `Audit error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      consoleMessages,
      pageErrors,
      failedResources,
      durationMs: Date.now() - t0,
      summary: `audit-dom ERROR — ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    if (browser) await browser.close();
  }
}

export async function runMultiViewportAuditDom(
  url: string,
  options: AuditDomOptions = {},
): Promise<{ viewports: AuditDomResult[]; passed: boolean; summary: string; durationMs: number }> {
  const t0 = Date.now();
  const viewports = options.viewports || [...DEFAULT_VIEWPORTS];
  const results: AuditDomResult[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return {
      viewports: [SKIPPED_RESULT],
      passed: true,
      summary: 'Playwright not available — audit-dom skipped.',
      durationMs: 0,
    };
  }

  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });

    for (const vp of viewports) {
      const consoleMessages: string[] = [];
      const pageErrors: string[] = [];
      const failedResources: string[] = [];
      const violations: DomViolation[] = [];

      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

      page.on('console', (msg: { type: () => string; text: () => string }) => {
        const type = msg.type();
        if (type === 'error' || type === 'warning') {
          consoleMessages.push(`[${type}] ${msg.text()}`);
        }
      });

      page.on('pageerror', (err: Error) => {
        pageErrors.push(err.message);
      });

      page.on('response', (response: { status: () => number; url: () => string }) => {
        const status = response.status();
        if (status >= 400) {
          failedResources.push(`${status} ${response.url()}`);
        }
      });

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(options.settleMs || 2000);

      const result = await page.evaluate(AUDIT_DOM_SCRIPT);
      violations.push(...(result.violations || []));

      for (const msg of consoleMessages) {
        if (msg.startsWith('[error]')) {
          violations.push({ type: 'console-error', severity: 'warning', message: msg });
        }
      }

      for (const res of failedResources) {
        violations.push({ type: 'network-error', severity: 'error', message: `Failed resource: ${res}`, details: res });
      }

      const errors = violations.filter(v => v.severity === 'error');
      const warnings = violations.filter(v => v.severity === 'warning');

      results.push({
        passed: errors.length === 0,
        available: true,
        url,
        violations,
        consoleMessages,
        pageErrors,
        failedResources,
        durationMs: 0,
        summary: `${vp.label} (${vp.width}x${vp.height}): ${errors.length} error(s), ${warnings.length} warning(s)`,
        viewport: { width: vp.width, height: vp.height },
        pageTitle: result.title,
      });

      await page.close();
    }
  } finally {
    if (browser) await browser.close();
  }

  const passed = results.every(r => r.passed);
  return {
    viewports: results,
    passed,
    summary: passed
      ? `audit-dom PASS on ${results.length} viewport(s)`
      : `audit-dom FAIL on ${results.filter(r => !r.passed).length}/${results.length} viewport(s)`,
    durationMs: Date.now() - t0,
  };
}

export function formatAuditDom(result: AuditDomResult, source: string): string {
  const lines: string[] = [];
  lines.push(`\n━━━ DOM Audit: ${source} ━━━`);
  if (result.pageTitle) lines.push(`  Page: ${result.pageTitle}`);
  lines.push(`  Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);

  if (result.violations.length > 0) {
    const byType = new Map<string, DomViolation[]>();
    for (const v of result.violations) {
      const arr = byType.get(v.type) || [];
      arr.push(v);
      byType.set(v.type, arr);
    }

    for (const [type, items] of byType) {
      lines.push(`\n  ${type.toUpperCase()} (${items.length}):`);
      for (const item of items.slice(0, 10)) {
        const sel = item.selector ? ` [${item.selector}]` : '';
        lines.push(`    ${item.severity === 'error' ? '!' : '-'} ${item.message}${sel}`);
        if (item.details) lines.push(`      ${item.details}`);
      }
      if (items.length > 10) lines.push(`    ... and ${items.length - 10} more`);
    }
  }

  if (result.failedResources.length > 0) {
    lines.push(`\n  FAILED RESOURCES (${result.failedResources.length}):`);
    for (const r of result.failedResources.slice(0, 5)) {
      lines.push(`    ! ${r}`);
    }
  }

  if (result.pageErrors.length > 0) {
    lines.push(`\n  PAGE ERRORS (${result.pageErrors.length}):`);
    for (const e of result.pageErrors.slice(0, 5)) {
      lines.push(`    ! ${e}`);
    }
  }

  lines.push(`  Duration: ${result.durationMs}ms`);
  lines.push('');
  return lines.join('\n');
}

export function auditDomToJson(result: AuditDomResult): JsonOutput {
  const inlineStyles = result.violations.filter(v => v.type === 'inline-style');
  const overflows = result.violations.filter(v => v.type === 'overflow');
  const consoleErrs = result.violations.filter(v => v.type === 'console-error');
  const networkErrs = result.violations.filter(v => v.type === 'network-error');
  const missingLabels = result.violations.filter(v => v.type === 'missing-label');

  return createJsonOutput({
    tool: 'audit-dom',
    file: result.url,
    passed: result.passed,
    exitCode: result.passed ? 0 : 1,
    sections: [
      {
        name: 'Inline Styles',
        status: inlineStyles.length === 0 ? 'pass' : 'warn',
        violations: inlineStyles,
        warnings: [],
      },
      {
        name: 'Overflow',
        status: overflows.length === 0 ? 'pass' : 'fail',
        violations: overflows,
        warnings: [],
      },
      {
        name: 'Console Errors',
        status: consoleErrs.length === 0 ? 'pass' : 'warn',
        violations: [],
        warnings: consoleErrs,
      },
      {
        name: 'Network Errors',
        status: networkErrs.length === 0 ? 'pass' : 'fail',
        violations: networkErrs,
        warnings: [],
      },
      {
        name: 'Accessibility Labels',
        status: missingLabels.length === 0 ? 'pass' : 'fail',
        violations: missingLabels,
        warnings: [],
      },
    ],
    summary: result.summary,
  });
}

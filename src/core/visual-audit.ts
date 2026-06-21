import type { AuditProfile } from './spa-profile.js';
import { buildSpaAuditScript } from './spa-profile.js';

export interface VisualAuditViolation {
  type: 'overflow' | 'collision' | 'contrast' | 'missing-element';
  severity: 'error' | 'warning';
  selector?: string;
  message: string;
}

export interface VisualAuditResult {
  passed: boolean;
  available: boolean;
  violations: VisualAuditViolation[];
  warnings: VisualAuditViolation[];
  elementCount: number;
  durationMs: number;
  summary: string;
  viewport?: { width: number; height: number };
  phase?: string;
  profile?: AuditProfile;
  meta?: Record<string, unknown>;
  consoleMessages?: string[];
  pageErrors?: string[];
  pageTitle?: string;
  diagnostics?: string;
}

export interface ResponsiveAuditResult {
  viewports: VisualAuditResult[];
  passed: boolean;
  summary: string;
  durationMs: number;
}

export interface VisualAuditOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  contrastThreshold?: number;
  settleMs?: number;
  url?: string;
  responsive?: boolean;
  profile?: AuditProfile;
  debug?: boolean;
}

export const EXIT_CODES = {
  PASS: 0,
  VIOLATIONS: 1,
  TOOL_ERROR: 2,
  NO_BROWSER: 3,
} as const;

const RESPONSIVE_VIEWPORTS = [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile' },
] as const;

const SKIPPED_RESULT: VisualAuditResult = {
  passed: true,
  available: false,
  violations: [],
  warnings: [],
  elementCount: 0,
  durationMs: 0,
  summary: 'Visual audit skipped: Playwright not installed. Run `npm install --save-dev playwright` and `npx playwright install chromium` to enable.',
  phase: 'init',
};

const AUDIT_SCRIPT = `
(threshold) => {
  const violations = [];
  const warnings = [];

  const sections = document.querySelectorAll('section, [data-section-index], main > *, header, nav, footer, .container, .wrapper, article, aside');
  sections.forEach((el, i) => {
    if (el.scrollWidth > el.clientWidth + 2) {
      violations.push({
        type: 'overflow',
        severity: 'error',
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(' ')[0] : ''),
        message: 'Horizontal overflow: scrollWidth=' + el.scrollWidth + ' > clientWidth=' + el.clientWidth,
      });
    }
  });

  const elements = Array.from(sections);
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i].getBoundingClientRect();
      const b = elements[j].getBoundingClientRect();
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 10 && overlapY > 10) {
        warnings.push({
          type: 'collision',
          severity: 'warning',
          message: 'Bounding box collision between element #' + i + ' and #' + j,
        });
      }
    }
  }

  if (document.documentElement.scrollWidth > window.innerWidth + 2) {
    violations.push({
      type: 'overflow',
      severity: 'error',
      selector: 'html',
      message: 'Page-level horizontal overflow: scrollWidth=' + document.documentElement.scrollWidth + ' > viewport=' + window.innerWidth,
    });
  }

  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  function contrastRatio(c1, c2) {
    const l1 = luminance(...c1), l2 = luminance(...c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function parseRgb(color) {
    const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
  }

  document.querySelectorAll('h1, h2, h3, h4, p, a, span, li, td, th, label, button').forEach(el => {
    const style = window.getComputedStyle(el);
    const fg = parseRgb(style.color);
    const bg = parseRgb(style.backgroundColor);
    if (fg && bg) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < threshold) {
        warnings.push({
          type: 'contrast',
          severity: 'warning',
          selector: el.tagName.toLowerCase(),
          message: 'Low contrast ' + ratio.toFixed(2) + ':1 (need >=' + threshold + ') on ' + el.tagName,
        });
      }
    }
  });

  return { violations, warnings, elementCount: sections.length };
}
`;

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

export async function runVisualAudit(
  htmlOrUrl: string,
  options: VisualAuditOptions = {},
): Promise<VisualAuditResult> {
  const t0 = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return SKIPPED_RESULT;
  }

  const {
    viewportWidth = 1440,
    viewportHeight = 900,
    contrastThreshold = 4.5,
    settleMs = 1000,
    url: explicitUrl,
    profile = 'landing',
    debug = false,
  } = options;

  const auditScript = profile === 'landing' ? AUDIT_SCRIPT : buildSpaAuditScript(profile);

  const targetUrl = explicitUrl || (isUrl(htmlOrUrl) ? htmlOrUrl : undefined);
  const html = targetUrl ? undefined : htmlOrUrl;

  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  let phase = 'browser-launch';
  let pageTitle = '';

  try {
    browser = await pw.chromium.launch({ headless: true });
    phase = 'page-create';

    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight },
    });

    page.on('console', (msg: { type: () => string; text: () => string }) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMessages.push(`[${type}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err: { message: string }) => {
      pageErrors.push(err.message);
    });

    phase = 'content-load';
    if (targetUrl) {
      const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response || response.status() >= 400) {
        pageTitle = await page.title().catch(() => '');
        return {
          passed: false,
          available: true,
          violations: [{
            type: 'missing-element',
            severity: 'error',
            message: `URL returned HTTP ${response?.status() ?? 'no response'}: ${targetUrl}`,
          }],
          warnings: [],
          elementCount: 0,
          durationMs: Date.now() - t0,
          summary: `Visual audit failed: URL unreachable or error status`,
          viewport: { width: viewportWidth, height: viewportHeight },
          phase,
          consoleMessages: consoleMessages.length > 0 ? consoleMessages : undefined,
          pageErrors: pageErrors.length > 0 ? pageErrors : undefined,
          pageTitle: pageTitle || undefined,
        };
      }
    } else {
      await page.setContent(html!, { waitUntil: 'networkidle' });
    }

    if (settleMs > 0) await page.waitForTimeout(settleMs);
    pageTitle = await page.title().catch(() => '');

    phase = 'audit-script';

    if (debug) {
      const scriptPreview = auditScript.substring(0, 500);
      consoleMessages.push(`[debug] Audit script (first 500 chars): ${scriptPreview}`);
      consoleMessages.push(`[debug] Profile: ${profile}, Contrast threshold: ${contrastThreshold}`);
      const readyState = await page.evaluate('document.readyState').catch(() => 'unknown');
      consoleMessages.push(`[debug] document.readyState: ${readyState}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawResult: any;
    try {
      rawResult = await page.evaluate(auditScript, contrastThreshold);
    } catch (evalErr) {
      const evalMsg = evalErr instanceof Error ? evalErr.message : String(evalErr);
      const readyState = await page.evaluate('document.readyState').catch(() => 'unknown');
      const docUrl = await page.evaluate('document.URL').catch(() => 'unknown');
      const diagnostics = [
        `Audit script threw in phase "${phase}"`,
        `Error: ${evalMsg}`,
        `document.readyState: ${readyState}`,
        `document.URL: ${docUrl}`,
        `Page title: ${pageTitle}`,
        consoleMessages.length > 0 ? `Console (${consoleMessages.length}): ${consoleMessages.slice(0, 5).join(' | ')}` : 'Console: empty',
        pageErrors.length > 0 ? `Page errors (${pageErrors.length}): ${pageErrors.slice(0, 3).join(' | ')}` : 'Page errors: none',
      ].join('\n');

      return {
        passed: false,
        available: true,
        violations: [{
          type: 'missing-element',
          severity: 'error',
          message: `Audit script error: ${evalMsg}`,
        }],
        warnings: [],
        elementCount: 0,
        durationMs: Date.now() - t0,
        summary: `Visual audit failed: audit script threw an error`,
        viewport: { width: viewportWidth, height: viewportHeight },
        phase,
        consoleMessages: consoleMessages.length > 0 ? consoleMessages : undefined,
        pageErrors: pageErrors.length > 0 ? pageErrors : undefined,
        pageTitle: pageTitle || undefined,
        diagnostics,
      };
    }

    if (debug) {
      const rawPreview = JSON.stringify(rawResult)?.substring(0, 500) ?? 'undefined';
      consoleMessages.push(`[debug] Raw result type: ${typeof rawResult}, preview: ${rawPreview}`);
    }

    const result = rawResult as {
      violations: VisualAuditViolation[];
      warnings: VisualAuditViolation[];
      elementCount: number;
      meta?: Record<string, unknown>;
    };

    if (!result || !Array.isArray(result.violations)) {
      const rawType = result === null ? 'null' : typeof result;
      const rawPreview = JSON.stringify(result)?.substring(0, 200) ?? 'undefined';
      const diagnostics = [
        `Audit script returned malformed data in phase "${phase}"`,
        `Expected: {violations: [], warnings: [], elementCount: number}`,
        `Received type: ${rawType}`,
        `Received preview: ${rawPreview}`,
        `Page title: ${pageTitle}`,
        consoleMessages.length > 0 ? `Console (${consoleMessages.length}): ${consoleMessages.slice(0, 5).join(' | ')}` : 'Console: empty',
        pageErrors.length > 0 ? `Page errors (${pageErrors.length}): ${pageErrors.slice(0, 3).join(' | ')}` : 'Page errors: none',
      ].join('\n');

      return {
        passed: false,
        available: true,
        violations: [{
          type: 'missing-element',
          severity: 'error',
          message: `Audit script returned ${rawType} instead of {violations, warnings, elementCount}. ${pageErrors.length > 0 ? 'Page errors: ' + pageErrors[0] : 'No page errors.'}`,
        }],
        warnings: [],
        elementCount: 0,
        durationMs: Date.now() - t0,
        summary: `Visual audit failed: audit script returned malformed data (${rawType})`,
        viewport: { width: viewportWidth, height: viewportHeight },
        phase,
        consoleMessages: consoleMessages.length > 0 ? consoleMessages : undefined,
        pageErrors: pageErrors.length > 0 ? pageErrors : undefined,
        pageTitle: pageTitle || undefined,
        diagnostics,
      };
    }

    const durationMs = Date.now() - t0;
    const passed = result.violations.length === 0;

    return {
      passed,
      available: true,
      violations: result.violations,
      warnings: result.warnings,
      elementCount: result.elementCount,
      durationMs,
      summary: passed
        ? `Visual audit passed in ${durationMs}ms — ${result.elementCount} elements, ${result.warnings.length} warning(s)`
        : `Visual audit FAILED in ${durationMs}ms — ${result.violations.length} error(s), ${result.warnings.length} warning(s)`,
      viewport: { width: viewportWidth, height: viewportHeight },
      phase: 'complete',
      profile,
      meta: result.meta,
      consoleMessages: consoleMessages.length > 0 ? consoleMessages : undefined,
      pageErrors: pageErrors.length > 0 ? pageErrors : undefined,
      pageTitle: pageTitle || undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const diagnostics = [
      `Visual audit crashed in phase "${phase}"`,
      `Error: ${msg}`,
      `Page title: ${pageTitle || 'N/A'}`,
      consoleMessages.length > 0 ? `Console (${consoleMessages.length}): ${consoleMessages.slice(0, 5).join(' | ')}` : 'Console: empty',
      pageErrors.length > 0 ? `Page errors (${pageErrors.length}): ${pageErrors.slice(0, 3).join(' | ')}` : 'Page errors: none',
    ].join('\n');

    return {
      passed: false,
      available: true,
      violations: [{
        type: 'overflow',
        severity: 'error',
        message: `Visual audit error in phase "${phase}": ${msg}`,
      }],
      warnings: [],
      elementCount: 0,
      durationMs: Date.now() - t0,
      summary: `Visual audit crashed in phase "${phase}": ${msg}`,
      viewport: { width: viewportWidth, height: viewportHeight },
      phase,
      consoleMessages: consoleMessages.length > 0 ? consoleMessages : undefined,
      pageErrors: pageErrors.length > 0 ? pageErrors : undefined,
      pageTitle: pageTitle || undefined,
      diagnostics,
    };
  } finally {
    await browser?.close();
  }
}

export async function runResponsiveAudit(
  htmlOrUrl: string,
  options: Omit<VisualAuditOptions, 'viewportWidth' | 'viewportHeight' | 'responsive'> = {},
): Promise<ResponsiveAuditResult> {
  const t0 = Date.now();
  const viewports: VisualAuditResult[] = [];

  for (const vp of RESPONSIVE_VIEWPORTS) {
    const result = await runVisualAudit(htmlOrUrl, {
      ...options,
      viewportWidth: vp.width,
      viewportHeight: vp.height,
    });
    viewports.push(result);
  }

  const passed = viewports.every(v => v.passed);
  const totalViolations = viewports.reduce((s, v) => s + v.violations.length, 0);
  const totalWarnings = viewports.reduce((s, v) => s + v.warnings.length, 0);
  const durationMs = Date.now() - t0;

  const lines = RESPONSIVE_VIEWPORTS.map((vp, i) => {
    const r = viewports[i];
    const status = !r.available ? 'SKIP' : r.passed ? 'PASS' : 'FAIL';
    return `  ${vp.label} (${vp.width}x${vp.height}): ${status} — ${r.violations.length} error(s), ${r.warnings.length} warning(s)`;
  });

  return {
    viewports,
    passed,
    durationMs,
    summary: `Responsive audit ${passed ? 'PASSED' : 'FAILED'} in ${durationMs}ms — ${totalViolations} error(s), ${totalWarnings} warning(s)\n${lines.join('\n')}`,
  };
}

export function formatVisualAudit(result: VisualAuditResult, source: string): string {
  const lines: string[] = [];
  const vpLabel = result.viewport ? ` [${result.viewport.width}x${result.viewport.height}]` : '';
  lines.push(`Visual audit: ${source}${vpLabel}`);
  lines.push(`  Elements scanned: ${result.elementCount}`);
  lines.push(`  Duration: ${result.durationMs}ms`);
  if (result.pageTitle) lines.push(`  Page title: ${result.pageTitle}`);
  lines.push('');

  if (!result.available) {
    lines.push(result.summary);
    return lines.join('\n');
  }

  if (result.violations.length > 0) {
    lines.push(`ERRORS (${result.violations.length}):`);
    for (const v of result.violations) {
      lines.push(`  [${v.type}] ${v.message}${v.selector ? ` (${v.selector})` : ''}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push(`WARNINGS (${result.warnings.length}):`);
    for (const w of result.warnings) {
      lines.push(`  [${w.type}] ${w.message}${w.selector ? ` (${w.selector})` : ''}`);
    }
    lines.push('');
  }

  if (result.pageErrors && result.pageErrors.length > 0) {
    lines.push(`PAGE ERRORS (${result.pageErrors.length}):`);
    for (const e of result.pageErrors.slice(0, 10)) {
      lines.push(`  ${e}`);
    }
    lines.push('');
  }

  if (result.consoleMessages && result.consoleMessages.length > 0) {
    lines.push(`CONSOLE (${result.consoleMessages.length}):`);
    for (const m of result.consoleMessages.slice(0, 20)) {
      lines.push(`  ${m}`);
    }
    lines.push('');
  }

  if (result.diagnostics) {
    lines.push('DIAGNOSTICS:');
    for (const d of result.diagnostics.split('\n')) {
      lines.push(`  ${d}`);
    }
    lines.push('');
  }

  lines.push(result.passed ? 'PASSED' : 'FAILED');
  return lines.join('\n');
}

export function formatResponsiveAudit(result: ResponsiveAuditResult, source: string): string {
  const labels = ['desktop', 'tablet', 'mobile'];
  const lines: string[] = [];
  lines.push(`Responsive visual audit: ${source}`);
  lines.push('='.repeat(60));

  for (let i = 0; i < result.viewports.length; i++) {
    lines.push('');
    lines.push(formatVisualAudit(result.viewports[i], `${source} [${labels[i] ?? i}]`));
  }

  lines.push('\n' + '='.repeat(60));
  lines.push(result.passed ? 'RESPONSIVE RESULT: PASS' : 'RESPONSIVE RESULT: FAIL');
  return lines.join('\n');
}

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
  } = options;

  const targetUrl = explicitUrl || (isUrl(htmlOrUrl) ? htmlOrUrl : undefined);
  const html = targetUrl ? undefined : htmlOrUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  let phase = 'browser-launch';

  try {
    browser = await pw.chromium.launch({ headless: true });
    phase = 'page-create';

    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight },
    });

    phase = 'content-load';
    if (targetUrl) {
      const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      if (!response || response.status() >= 400) {
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
        };
      }
    } else {
      await page.setContent(html!, { waitUntil: 'networkidle' });
    }

    if (settleMs > 0) await page.waitForTimeout(settleMs);

    phase = 'audit-script';
    const result = await page.evaluate(AUDIT_SCRIPT, contrastThreshold) as {
      violations: VisualAuditViolation[];
      warnings: VisualAuditViolation[];
      elementCount: number;
    };

    if (!result || !Array.isArray(result.violations)) {
      return {
        passed: false,
        available: true,
        violations: [{
          type: 'missing-element',
          severity: 'error',
          message: `Audit script returned invalid result in phase "${phase}": expected {violations, warnings, elementCount}`,
        }],
        warnings: [],
        elementCount: 0,
        durationMs: Date.now() - t0,
        summary: `Visual audit failed: audit script returned malformed data`,
        viewport: { width: viewportWidth, height: viewportHeight },
        phase,
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
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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

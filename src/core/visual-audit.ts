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
}

export interface VisualAuditOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  contrastThreshold?: number;
  settleMs?: number;
}

const SKIPPED_RESULT: VisualAuditResult = {
  passed: true,
  available: false,
  violations: [],
  warnings: [],
  elementCount: 0,
  durationMs: 0,
  summary: 'Visual audit skipped: Playwright not installed. Run `npm install --save-dev playwright` and `npx playwright install chromium` to enable.',
};

const AUDIT_SCRIPT = `
(threshold) => {
  const violations = [];
  const warnings = [];

  const sections = document.querySelectorAll('section, [data-section-index], main > *');
  sections.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 2) {
      violations.push({
        type: 'overflow',
        severity: 'error',
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
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

export async function runVisualAudit(
  html: string,
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
  } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight },
    });

    await page.setContent(html, { waitUntil: 'networkidle' });
    if (settleMs > 0) await page.waitForTimeout(settleMs);

    const result = await page.evaluate(AUDIT_SCRIPT, contrastThreshold) as {
      violations: VisualAuditViolation[];
      warnings: VisualAuditViolation[];
      elementCount: number;
    };

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
    };
  } catch (err) {
    return {
      passed: false,
      available: true,
      violations: [{
        type: 'overflow',
        severity: 'error',
        message: `Visual audit error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      warnings: [],
      elementCount: 0,
      durationMs: Date.now() - t0,
      summary: `Visual audit crashed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await browser?.close();
  }
}

export function formatVisualAudit(result: VisualAuditResult, filePath: string): string {
  const lines: string[] = [];
  lines.push(`Visual audit: ${filePath}`);
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

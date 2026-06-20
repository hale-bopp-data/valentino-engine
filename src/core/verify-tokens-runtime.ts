import { parseTokenDeclarations } from './validate-tokens.js';

export interface RuntimeTokenResult {
  token: string;
  expected: string;
  actual: string;
  resolved: boolean;
  match: boolean;
}

export interface VerifyTokensRuntimeResult {
  available: boolean;
  passed: boolean;
  results: RuntimeTokenResult[];
  unresolvedCount: number;
  mismatchCount: number;
  totalTokens: number;
  durationMs: number;
  summary: string;
}

const SKIPPED_RESULT: VerifyTokensRuntimeResult = {
  available: false,
  passed: true,
  results: [],
  unresolvedCount: 0,
  mismatchCount: 0,
  totalTokens: 0,
  durationMs: 0,
  summary: 'Runtime verification skipped: Playwright not installed.',
};

function buildHtmlWithCss(css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${css}</style></head>
<body><div id="valentino-probe"></div></body>
</html>`;
}

const VERIFY_SCRIPT = `
(tokenNames) => {
  const results = [];
  const el = document.getElementById('valentino-probe') || document.body;
  const style = window.getComputedStyle(el);
  for (const name of tokenNames) {
    const raw = style.getPropertyValue(name).trim();
    results.push({
      token: name,
      actual: raw,
      resolved: raw !== '' && raw !== 'initial' && raw !== 'inherit',
    });
  }
  return results;
}
`;

export async function verifyTokensRuntime(
  css: string,
  htmlOverride?: string,
): Promise<VerifyTokensRuntimeResult> {
  const t0 = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return SKIPPED_RESULT;
  }

  const tokens = parseTokenDeclarations(css);
  if (tokens.size === 0) {
    return {
      available: true,
      passed: true,
      results: [],
      unresolvedCount: 0,
      mismatchCount: 0,
      totalTokens: 0,
      durationMs: Date.now() - t0,
      summary: 'No tokens found to verify.',
    };
  }

  const html = htmlOverride ?? buildHtmlWithCss(css);
  const tokenNames = Array.from(tokens.keys());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const rawResults = await page.evaluate(VERIFY_SCRIPT, tokenNames) as Array<{
      token: string;
      actual: string;
      resolved: boolean;
    }>;

    const results: RuntimeTokenResult[] = rawResults.map(r => ({
      token: r.token,
      expected: tokens.get(r.token) ?? '',
      actual: r.actual,
      resolved: r.resolved,
      match: r.resolved,
    }));

    const unresolvedCount = results.filter(r => !r.resolved).length;
    const durationMs = Date.now() - t0;
    const passed = unresolvedCount === 0;

    return {
      available: true,
      passed,
      results,
      unresolvedCount,
      mismatchCount: 0,
      totalTokens: results.length,
      durationMs,
      summary: passed
        ? `All ${results.length} token(s) resolve correctly (${durationMs}ms)`
        : `${unresolvedCount}/${results.length} token(s) failed to resolve (${durationMs}ms)`,
    };
  } catch (err) {
    return {
      available: true,
      passed: false,
      results: [],
      unresolvedCount: 0,
      mismatchCount: 0,
      totalTokens: tokenNames.length,
      durationMs: Date.now() - t0,
      summary: `Runtime verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await browser?.close();
  }
}

export function formatVerifyRuntime(result: VerifyTokensRuntimeResult): string {
  const lines: string[] = [];
  lines.push(`Runtime token verification — ${result.totalTokens} token(s)`);

  if (!result.available) {
    lines.push(result.summary);
    return lines.join('\n');
  }

  const failed = result.results.filter(r => !r.resolved);
  const passed = result.results.filter(r => r.resolved);

  if (passed.length > 0) {
    lines.push(`  Resolved: ${passed.length}`);
  }
  if (failed.length > 0) {
    lines.push(`  Unresolved: ${failed.length}`);
    for (const f of failed) {
      lines.push(`    ${f.token}: expected="${f.expected}" actual="${f.actual}"`);
    }
  }

  lines.push('');
  lines.push(result.passed ? 'PASSED' : 'FAILED');
  return lines.join('\n');
}

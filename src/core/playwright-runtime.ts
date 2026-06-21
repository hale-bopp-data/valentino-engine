/**
 * Playwright runtime robustness (#3085) — part 7/7 of the Visual QA Guardrail (#3080).
 *
 * G16 "presa elettrica": a single, predictable interface for loading Playwright,
 * detecting install status, managing browser lifecycle, and retrying transient
 * "execution context destroyed" failures (common on SPA/dashboard pages that
 * navigate mid-audit — lesson from #3072/#3073).
 *
 * Fail-loud by design: errors are classified and surfaced with actionable
 * messages; non-transient failures are re-thrown, never swallowed.
 */

export const PLAYWRIGHT_INSTALL_HINT =
  'Run `npm install --save-dev playwright` and `npx playwright install chromium` to enable.';

/** Sane, centralized default timeouts (SSoT for the audit pipeline). */
export const DEFAULT_TIMEOUTS = {
  /** Navigation (page.goto) + waitForSelector timeout, ms. */
  navMs: 30_000,
  /** Post-load settle delay before auditing, ms. */
  settleMs: 1_000,
  /** Retry attempts for an evaluate that hits a transient context-destroyed error. */
  evaluateRetries: 2,
  /** Backoff between evaluate retries, ms. */
  retryBackoffMs: 150,
} as const;

export interface PlaywrightModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chromium: any;
}

export type LoadPlaywrightResult =
  | { available: true; pw: PlaywrightModule }
  | { available: false; reason: string };

/**
 * Recognize the transient "execution context was destroyed" / navigation race
 * that warrants a retry (vs a real failure).
 */
export function isContextDestroyedError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    m.includes('execution context was destroyed') ||
    m.includes('execution context is not available') ||
    m.includes('cannot find context with specified id') ||
    m.includes('most likely because of a navigation') ||
    m.includes('target closed')
  );
}

/**
 * Recognize the "browser binary not installed" launch failure so we can emit an
 * actionable message instead of a cryptic stack (auto-install detection).
 */
export function isBrowserNotInstalledError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    m.includes("executable doesn't exist") ||
    m.includes('please run the following command to download new browsers') ||
    m.includes('npx playwright install') ||
    m.includes('looks like playwright')
  );
}

/** Dynamically import Playwright with an actionable not-installed reason. */
export async function loadPlaywright(): Promise<LoadPlaywrightResult> {
  try {
    // @ts-ignore optional peer dependency, resolved at runtime
    const pw = await import(/* webpackIgnore: true */ 'playwright');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (pw && (pw as any).default ? (pw as any).default : pw) as PlaywrightModule;
    if (!mod || !mod.chromium) {
      return { available: false, reason: `Playwright loaded but the chromium API is missing. ${PLAYWRIGHT_INSTALL_HINT}` };
    }
    return { available: true, pw: mod };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { available: false, reason: `Playwright not installed (${msg}). ${PLAYWRIGHT_INSTALL_HINT}` };
  }
}

export interface EvaluateRetryOptions {
  /** Max retries on transient context-destroyed errors (default: DEFAULT_TIMEOUTS.evaluateRetries). */
  retries?: number;
  /** Backoff between retries, ms (default: DEFAULT_TIMEOUTS.retryBackoffMs). */
  backoffMs?: number;
  /** Injectable sleeper (tests pass a no-op to avoid real delays). */
  sleep?: (ms: number) => Promise<void>;
  /** Diagnostics hook fired before each retry. */
  onRetry?: (attempt: number, err: unknown) => void;
}

interface EvaluatablePage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate: (script: any, arg?: any) => Promise<any>;
}

/**
 * Run `page.evaluate` with targeted retry on transient "execution context
 * destroyed" errors. Non-transient errors propagate immediately (fail-loud).
 */
export async function evaluateWithRetry(
  page: EvaluatablePage,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  script: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arg?: any,
  options: EvaluateRetryOptions = {},
): Promise<unknown> {
  const retries = options.retries ?? DEFAULT_TIMEOUTS.evaluateRetries;
  const backoffMs = options.backoffMs ?? DEFAULT_TIMEOUTS.retryBackoffMs;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await page.evaluate(script, arg);
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isContextDestroyedError(err)) {
        options.onRetry?.(attempt + 1, err);
        await sleep(backoffMs);
        continue;
      }
      throw err; // fail-loud: non-transient, or retries exhausted
    }
  }
  // Defensive: loop always returns or throws above.
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface WithBrowserResult<T> {
  available: boolean;
  reason?: string;
  value?: T;
}

/**
 * Browser lifecycle wrapper: load Playwright, launch chromium, run `fn`, and
 * ALWAYS close the browser (best-effort, never masks the primary error).
 * Returns `available:false` with an actionable reason when Playwright or the
 * chromium binary is missing.
 */
export async function withBrowser<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (browser: any) => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  launchOptions: Record<string, any> = { headless: true },
): Promise<WithBrowserResult<T>> {
  const loaded = await loadPlaywright();
  if (!loaded.available) return { available: false, reason: loaded.reason };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  try {
    browser = await loaded.pw.chromium.launch(launchOptions);
  } catch (err) {
    const reason = isBrowserNotInstalledError(err)
      ? `Chromium browser binary not installed. ${PLAYWRIGHT_INSTALL_HINT}`
      : `Failed to launch Chromium: ${err instanceof Error ? err.message : String(err)}`;
    return { available: false, reason };
  }

  try {
    const value = await fn(browser);
    return { available: true, value };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        // Best-effort close; do not mask the primary result/error. Surface in debug.
        if (process.env.VALENTINO_DEBUG) {
          console.warn('[playwright-runtime] browser close failed:', closeErr instanceof Error ? closeErr.message : String(closeErr));
        }
      }
    }
  }
}

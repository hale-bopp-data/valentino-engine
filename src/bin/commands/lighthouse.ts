/**
 * valentino lighthouse — Automated Lighthouse performance audit
 *
 * Wraps Google Lighthouse CLI. Falls back to fetch-based basic checks
 * when Chrome/Lighthouse is not available (CI, headless server).
 *
 * Usage:
 *   valentino lighthouse                                   # dev (localhost:5174)
 *   valentino lighthouse --target http://80.225.86.168     # production
 *   valentino lighthouse --json                            # JSON output
 *   valentino lighthouse --threshold 80                    # fail if score < 80
 *
 * PBI #623 — S189
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type Category = typeof CATEGORIES[number];

export interface CheckResult {
  check: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  score?: number;
  threshold?: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Lighthouse runner
// ---------------------------------------------------------------------------

function findLighthouse(): string | null {
  const localBin = resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'lighthouse');
  if (existsSync(localBin) || existsSync(localBin + '.cmd')) return localBin;
  try {
    execFileSync('npx', ['lighthouse', '--version'], { stdio: 'pipe', timeout: 15000 });
    return null; // use npx
  } catch {
    return null;
  }
}

function runLighthouseCli(url: string): Record<string, unknown> | null {
  const tmpOutput = resolve(__dirname, '..', '..', '..', '.lighthouse-report.json');
  const lhBin = findLighthouse();

  const lhArgs = [
    url,
    '--output=json',
    `--output-path=${tmpOutput}`,
    '--chrome-flags=--headless --no-sandbox --disable-gpu',
    '--only-categories=' + CATEGORIES.join(','),
    '--quiet',
  ];

  try {
    if (lhBin) {
      execFileSync(lhBin, lhArgs, { stdio: 'pipe', timeout: 120000 });
    } else {
      execFileSync('npx', ['lighthouse', ...lhArgs], { stdio: 'pipe', timeout: 180000 });
    }
  } catch {
    return null;
  }

  if (!existsSync(tmpOutput)) return null;

  try {
    const report = JSON.parse(readFileSync(tmpOutput, 'utf-8'));
    unlinkSync(tmpOutput);
    return report;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Score extraction
// ---------------------------------------------------------------------------

function extractScores(report: Record<string, unknown>): Record<Category, number> | null {
  const categories = (report as any).categories;
  if (!categories) return null;

  const scores: Partial<Record<Category, number>> = {};
  for (const cat of CATEGORIES) {
    if (categories[cat]?.score != null) {
      scores[cat] = Math.round(categories[cat].score * 100);
    }
  }
  return Object.keys(scores).length > 0 ? scores as Record<Category, number> : null;
}

function buildResults(scores: Record<Category, number>, threshold: number, target: string): CheckResult[] {
  const results: CheckResult[] = [
    { check: 'lighthouse-run', status: 'PASS', message: `Lighthouse completed against ${target}` },
  ];

  for (const [cat, score] of Object.entries(scores)) {
    const status: CheckResult['status'] =
      score >= threshold ? 'PASS' : score >= threshold - 20 ? 'WARN' : 'FAIL';
    results.push({
      check: `lighthouse-${cat}`,
      status,
      score,
      threshold,
      message: `${cat}: ${score}/100${status !== 'PASS' ? ` (threshold: ${threshold})` : ''}`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Fallback: fetch-based basic checks
// ---------------------------------------------------------------------------

async function basicPerformanceChecks(url: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const start = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - start;
    const body = await res.text();

    results.push({
      check: 'perf-response-time',
      status: elapsed < 1000 ? 'PASS' : elapsed < 3000 ? 'WARN' : 'FAIL',
      score: elapsed,
      message: `Response time: ${elapsed}ms${elapsed > 3000 ? ' (>3s, slow)' : ''}`,
    });

    const sizeKB = Math.round(body.length / 1024);
    results.push({
      check: 'perf-page-size',
      status: sizeKB < 500 ? 'PASS' : sizeKB < 1000 ? 'WARN' : 'FAIL',
      score: sizeKB,
      message: `Page size: ${sizeKB}KB${sizeKB > 1000 ? ' (>1MB, heavy)' : ''}`,
    });

    const encoding = res.headers.get('content-encoding');
    results.push({
      check: 'perf-compression',
      status: encoding ? 'PASS' : 'WARN',
      message: encoding ? `Compression: ${encoding}` : 'No compression detected',
    });

    const cacheControl = res.headers.get('cache-control');
    results.push({
      check: 'perf-cache-headers',
      status: cacheControl ? 'PASS' : 'WARN',
      message: cacheControl ? `Cache-Control: ${cacheControl}` : 'No Cache-Control header',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      check: 'perf-reachable',
      status: 'FAIL',
      message: `Cannot reach ${url}: ${msg}`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API (pure function for library consumers)
// ---------------------------------------------------------------------------

export interface LighthouseOptions {
  target?: string;
  threshold?: number;
  json?: boolean;
}

export async function lighthouse(opts: LighthouseOptions = {}): Promise<CheckResult[]> {
  const target = opts.target ?? 'http://localhost:5174';
  const threshold = opts.threshold ?? 70;

  const report = runLighthouseCli(target);
  const scores = report ? extractScores(report) : null;

  if (scores) {
    return buildResults(scores, threshold, target);
  }

  return basicPerformanceChecks(target);
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

export async function runLighthouse(args: string[]): Promise<void> {
  const targetIdx = args.indexOf('--target');
  const target = targetIdx !== -1 && args[targetIdx + 1]
    ? args[targetIdx + 1].replace(/\/$/, '')
    : 'http://localhost:5174';

  const jsonMode = args.includes('--json');

  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 && args[thresholdIdx + 1]
    ? parseInt(args[thresholdIdx + 1], 10)
    : 70;

  const results = await lighthouse({ target, threshold, json: jsonMode });

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const fails = results.filter(r => r.status === 'FAIL');
  const warns = results.filter(r => r.status === 'WARN');
  const passes = results.filter(r => r.status === 'PASS');

  console.log(`[lighthouse] ${results.length} check(s) against ${target}:`);
  for (const r of passes) console.log(`  PASS  ${r.check} :: ${r.message}`);
  for (const r of warns) console.log(`  WARN  ${r.check} :: ${r.message}`);
  for (const r of fails) console.log(`  FAIL  ${r.check} :: ${r.message}`);
  console.log(`\n  Summary: ${passes.length} PASS, ${warns.length} WARN, ${fails.length} FAIL`);

  if (fails.length > 0) process.exit(1);
}

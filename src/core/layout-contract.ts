/**
 * Layout Contracts (#3083) — declarative region contract + verify via Playwright.
 *
 * Mirrors the grid-contract (#3040) init/verify shape but operates on semantic
 * page REGIONS (header / sidebar / main / footer) and asserts structural
 * guardrails that matter for dashboards/apps:
 *   - sidebar must not overlap main
 *   - header/footer must not cover main content
 *   - main must stay within the viewport horizontally
 *   - declared z-order between overlapping regions must hold
 *
 * The browser scripts only scrape geometry; all decisions live in the pure
 * `analyzeLayout()` (Node-testable, no browser needed).
 */

import { createJsonOutput, type JsonOutput } from './json-output.js';

export type LayoutRegionName = 'header' | 'sidebar' | 'main' | 'footer';

export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutRegion {
  name: LayoutRegionName;
  selector: string;
  zIndex?: number;
  rect?: RegionRect;
}

export interface LayoutContract {
  version: 1;
  viewport: { width: number; height: number };
  regions: LayoutRegion[];
}

export interface LayoutViolation {
  type: 'missing' | 'overlap' | 'covered' | 'out-of-viewport' | 'z-order';
  region: string;
  otherRegion?: string;
  selector: string;
  message: string;
}

export interface LayoutVerifyResult {
  available: boolean;
  passed: boolean;
  violations: LayoutViolation[];
  summary: string;
}

/** A region as scraped from the live DOM during verify. */
export interface ScrapedRegion {
  name: LayoutRegionName;
  selector: string;
  found: boolean;
  rect?: RegionRect;
  zIndex?: number;
}

export interface ScrapedLayout {
  viewport: { width: number; height: number };
  regions: ScrapedRegion[];
}

export interface LayoutContractOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  settleMs?: number;
  /** Significant-overlap threshold in px on both axes (default: 8). */
  overlapThreshold?: number;
  /** Horizontal viewport tolerance in px (default: 2). */
  viewportTolerance?: number;
  /** Override the candidate selectors used during init. */
  regionSelectors?: Partial<Record<LayoutRegionName, string[]>>;
}

export const REGION_ORDER: LayoutRegionName[] = ['header', 'sidebar', 'main', 'footer'];

export const DEFAULT_REGION_SELECTORS: Record<LayoutRegionName, string[]> = {
  header: ['header', '[role="banner"]', '.app-header', '.site-header', '.header'],
  sidebar: ['aside', '[role="complementary"]', '.sidebar', '.side-nav', 'nav.sidebar'],
  main: ['main', '[role="main"]', '#main', '.main-content', '.content'],
  footer: ['footer', '[role="contentinfo"]', '.site-footer', '.footer'],
};

const SKIPPED_RESULT: LayoutVerifyResult = {
  available: false,
  passed: true,
  violations: [],
  summary: 'Layout contract verification skipped: Playwright not installed.',
};

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

// ── Browser scripts (geometry scraping only) ────────────────────────────────

const INIT_SCRIPT = `
(regionSelectors) => {
  const order = ['header', 'sidebar', 'main', 'footer'];
  const regions = [];
  for (const name of order) {
    const candidates = regionSelectors[name] || [];
    for (const sel of candidates) {
      let el = null;
      try { el = document.querySelector(sel); } catch (e) { el = null; }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const cs = window.getComputedStyle(el);
      const zRaw = cs.zIndex;
      const z = zRaw && zRaw !== 'auto' && !isNaN(parseInt(zRaw, 10)) ? parseInt(zRaw, 10) : undefined;
      regions.push({
        name: name,
        selector: sel,
        zIndex: z,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      });
      break;
    }
  }
  return { viewport: { width: window.innerWidth, height: window.innerHeight }, regions };
}
`;

const SCRAPE_SCRIPT = `
(contract) => {
  const out = [];
  for (const region of contract.regions) {
    let el = null;
    try { el = document.querySelector(region.selector); } catch (e) { el = null; }
    if (!el) { out.push({ name: region.name, selector: region.selector, found: false }); continue; }
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const zRaw = cs.zIndex;
    const z = zRaw && zRaw !== 'auto' && !isNaN(parseInt(zRaw, 10)) ? parseInt(zRaw, 10) : undefined;
    out.push({
      name: region.name,
      selector: region.selector,
      found: true,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      zIndex: z,
    });
  }
  return { viewport: { width: window.innerWidth, height: window.innerHeight }, regions: out };
}
`;

/**
 * Deterministic IIFE invocation (#3072/#3073 lesson): never rely on Playwright's
 * string→function auto-call heuristic, which can resolve to `undefined` on SPAs.
 */
function invocable(script: string, arg: unknown): string {
  return `(${script.trim()})(${JSON.stringify(arg)})`;
}

// ── Pure analysis (Node-testable, no browser) ───────────────────────────────

function overlap(a: RegionRect, b: RegionRect): { x: number; y: number } {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { x, y };
}

/**
 * Pure layout analysis: given the contract and the scraped live geometry,
 * return the list of violations. No browser dependency — fully unit-testable.
 */
export function analyzeLayout(
  contract: LayoutContract,
  scraped: ScrapedLayout,
  options: { overlapThreshold?: number; viewportTolerance?: number } = {},
): LayoutViolation[] {
  const T = options.overlapThreshold ?? 8;
  const tol = options.viewportTolerance ?? 2;
  const violations: LayoutViolation[] = [];

  const byName = new Map<string, ScrapedRegion>();
  for (const r of scraped.regions) byName.set(r.name, r);

  // 1. Missing regions (declared in contract but absent at verify time)
  for (const region of contract.regions) {
    const s = byName.get(region.name);
    if (!s || !s.found || !s.rect) {
      violations.push({
        type: 'missing',
        region: region.name,
        selector: region.selector,
        message: `Region "${region.name}" not found at "${region.selector}"`,
      });
    }
  }

  const rectOf = (name: LayoutRegionName): { rect: RegionRect; z?: number; sel: string } | null => {
    const s = byName.get(name);
    if (!s || !s.found || !s.rect) return null;
    return { rect: s.rect, z: s.zIndex, sel: s.selector };
  };
  const declaredZ = (name: LayoutRegionName): number | undefined =>
    contract.regions.find(r => r.name === name)?.zIndex;

  const main = rectOf('main');
  const viewportWidth = scraped.viewport?.width ?? contract.viewport.width;

  const coverPairs: Array<[LayoutRegionName, 'overlap' | 'covered']> = [
    ['sidebar', 'overlap'],
    ['header', 'covered'],
    ['footer', 'covered'],
  ];

  if (main) {
    for (const [name, vtype] of coverPairs) {
      const other = rectOf(name);
      if (!other) continue;
      const ov = overlap(main.rect, other.rect);
      if (ov.x > T && ov.y > T) {
        // Regions should not visually collide; the overlap is reported even if
        // an intentional z-index stacking exists.
        violations.push({
          type: vtype,
          region: name,
          otherRegion: 'main',
          selector: other.sel,
          message:
            vtype === 'overlap'
              ? `Region "${name}" overlaps "main" by ${Math.round(ov.x)}x${Math.round(ov.y)}px`
              : `Region "${name}" covers "main" by ${Math.round(ov.x)}x${Math.round(ov.y)}px`,
        });

        // z-order coherence: if both declared a z-index, the actual order must match.
        const dz = declaredZ(name);
        const dmain = declaredZ('main');
        if (dz !== undefined && dmain !== undefined && other.z !== undefined && main.z !== undefined) {
          const declaredAboveMain = dz > dmain;
          const actualAboveMain = other.z > main.z;
          if (declaredAboveMain !== actualAboveMain) {
            violations.push({
              type: 'z-order',
              region: name,
              otherRegion: 'main',
              selector: other.sel,
              message: `z-order mismatch: "${name}" declared ${declaredAboveMain ? 'above' : 'below'} main but rendered ${actualAboveMain ? 'above' : 'below'}`,
            });
          }
        }
      }
    }

    // 2. main horizontal containment within the viewport
    const left = main.rect.x;
    const right = main.rect.x + main.rect.width;
    if (left < -tol || right > viewportWidth + tol) {
      violations.push({
        type: 'out-of-viewport',
        region: 'main',
        selector: main.sel,
        message: `Region "main" exceeds viewport horizontally (left=${Math.round(left)}, right=${Math.round(right)}, viewport=${viewportWidth})`,
      });
    }
  }

  return violations;
}

// ── Playwright-backed init / verify ─────────────────────────────────────────

async function withPage<T>(
  htmlOrUrl: string,
  viewport: { width: number; height: number },
  settleMs: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (page: any) => Promise<T>,
  fallback: () => T | null,
): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore optional peer dependency
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return fallback();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport });
    if (isUrl(htmlOrUrl)) {
      await page.goto(htmlOrUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    } else {
      await page.setContent(htmlOrUrl, { waitUntil: 'networkidle' });
    }
    if (settleMs > 0) await page.waitForTimeout(settleMs);
    return await fn(page);
  } finally {
    await browser?.close();
  }
}

export async function initLayoutContract(
  htmlOrUrl: string,
  options: LayoutContractOptions = {},
): Promise<LayoutContract | null> {
  const viewportWidth = options.viewportWidth ?? 1440;
  const viewportHeight = options.viewportHeight ?? 900;
  const settleMs = options.settleMs ?? 500;
  const regionSelectors: Record<LayoutRegionName, string[]> = {
    header: options.regionSelectors?.header ?? DEFAULT_REGION_SELECTORS.header,
    sidebar: options.regionSelectors?.sidebar ?? DEFAULT_REGION_SELECTORS.sidebar,
    main: options.regionSelectors?.main ?? DEFAULT_REGION_SELECTORS.main,
    footer: options.regionSelectors?.footer ?? DEFAULT_REGION_SELECTORS.footer,
  };

  return withPage(
    htmlOrUrl,
    { width: viewportWidth, height: viewportHeight },
    settleMs,
    async (page) => {
      const scraped = (await page.evaluate(invocable(INIT_SCRIPT, regionSelectors))) as ScrapedLayout | null;
      if (!scraped) return null;
      const contract: LayoutContract = {
        version: 1,
        viewport: { width: viewportWidth, height: viewportHeight },
        regions: (scraped.regions ?? []).map(r => ({
          name: r.name,
          selector: r.selector,
          zIndex: r.zIndex,
          rect: r.rect,
        })),
      };
      return contract;
    },
    () => null,
  );
}

export async function verifyLayoutContract(
  htmlOrUrl: string,
  contract: LayoutContract,
  options: LayoutContractOptions = {},
): Promise<LayoutVerifyResult> {
  const viewportWidth = options.viewportWidth ?? contract.viewport?.width ?? 1440;
  const viewportHeight = options.viewportHeight ?? contract.viewport?.height ?? 900;
  const settleMs = options.settleMs ?? 500;

  const result = await withPage<LayoutVerifyResult>(
    htmlOrUrl,
    { width: viewportWidth, height: viewportHeight },
    settleMs,
    async (page) => {
      try {
        const scraped = (await page.evaluate(invocable(SCRAPE_SCRIPT, contract))) as ScrapedLayout | undefined;
        if (!scraped || !Array.isArray(scraped.regions)) {
          return {
            available: true,
            passed: false,
            violations: [{
              type: 'missing' as const,
              region: 'document',
              selector: 'document',
              message: 'Layout scrape returned no regions (page not ready / context destroyed)',
            }],
            summary: 'Layout contract error: scrape returned malformed data',
          };
        }
        const violations = analyzeLayout(contract, scraped, {
          overlapThreshold: options.overlapThreshold,
          viewportTolerance: options.viewportTolerance,
        });
        return {
          available: true,
          passed: violations.length === 0,
          violations,
          summary: violations.length === 0
            ? `Layout contract verified: ${contract.regions.length} region(s) OK`
            : `Layout contract FAILED: ${violations.length} violation(s)`,
        };
      } catch (err) {
        return {
          available: true,
          passed: false,
          violations: [{
            type: 'missing' as const,
            region: 'document',
            selector: 'document',
            message: `Runtime error: ${err instanceof Error ? err.message : String(err)}`,
          }],
          summary: `Layout contract error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
    () => SKIPPED_RESULT,
  );

  return result ?? SKIPPED_RESULT;
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function formatLayoutContract(contract: LayoutContract): string {
  const lines: string[] = [];
  lines.push(`Layout Contract (${contract.viewport.width}x${contract.viewport.height})`);
  lines.push(`  regions: ${contract.regions.length}`);
  for (const r of contract.regions) {
    let detail = `    ${r.name}: ${r.selector}`;
    if (r.zIndex !== undefined) detail += ` (z=${r.zIndex})`;
    if (r.rect) detail += ` [${Math.round(r.rect.width)}x${Math.round(r.rect.height)}]`;
    lines.push(detail);
  }
  return lines.join('\n');
}

export function formatLayoutVerify(result: LayoutVerifyResult): string {
  const lines: string[] = [];
  if (!result.available) {
    lines.push(result.summary);
    return lines.join('\n');
  }
  if (result.violations.length > 0) {
    lines.push(`Layout contract violations (${result.violations.length}):`);
    for (const v of result.violations) {
      const other = v.otherRegion ? ` <-> ${v.otherRegion}` : '';
      lines.push(`  [${v.type}] ${v.region}${other}: ${v.message} (${v.selector})`);
    }
  }
  lines.push(result.passed ? 'PASSED' : 'FAILED');
  return lines.join('\n');
}

export function layoutContractToJson(result: LayoutVerifyResult, file?: string): JsonOutput {
  const byType = (t: LayoutViolation['type']) => result.violations.filter(v => v.type === t);
  const overlaps = byType('overlap');
  const covered = byType('covered');
  const oob = byType('out-of-viewport');
  const missing = byType('missing');
  const zorder = byType('z-order');

  return createJsonOutput({
    tool: 'layout-contract',
    file,
    passed: result.passed,
    exitCode: result.available ? (result.passed ? 0 : 1) : 3,
    sections: [
      { name: 'Sidebar/Main Overlap', status: overlaps.length === 0 ? 'pass' : 'fail', violations: overlaps, warnings: [] },
      { name: 'Header/Footer Cover', status: covered.length === 0 ? 'pass' : 'fail', violations: covered, warnings: [] },
      { name: 'Main Viewport Containment', status: oob.length === 0 ? 'pass' : 'fail', violations: oob, warnings: [] },
      { name: 'Region Presence', status: missing.length === 0 ? 'pass' : 'fail', violations: missing, warnings: [] },
      { name: 'Z-Order Coherence', status: zorder.length === 0 ? 'pass' : 'warn', violations: [], warnings: zorder },
    ],
    summary: result.summary,
  });
}

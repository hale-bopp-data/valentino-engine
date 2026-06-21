import { describe, it, expect } from 'vitest';
import {
  analyzeLayout,
  formatLayoutContract,
  formatLayoutVerify,
  layoutContractToJson,
  type LayoutContract,
  type LayoutVerifyResult,
  type ScrapedLayout,
  type RegionRect,
} from './layout-contract.js';

const VIEWPORT = { width: 1440, height: 900 };

function rect(x: number, y: number, width: number, height: number): RegionRect {
  return { x, y, width, height };
}

function contractOf(regions: LayoutContract['regions']): LayoutContract {
  return { version: 1, viewport: VIEWPORT, regions };
}

function scrapedOf(regions: ScrapedLayout['regions']): ScrapedLayout {
  return { viewport: VIEWPORT, regions };
}

describe('analyzeLayout (#3083)', () => {
  it('clean dashboard layout → no violations', () => {
    const contract = contractOf([
      { name: 'header', selector: 'header' },
      { name: 'sidebar', selector: 'aside' },
      { name: 'main', selector: 'main' },
      { name: 'footer', selector: 'footer' },
    ]);
    const scraped = scrapedOf([
      { name: 'header', selector: 'header', found: true, rect: rect(0, 0, 1440, 60) },
      { name: 'sidebar', selector: 'aside', found: true, rect: rect(0, 60, 240, 840) },
      { name: 'main', selector: 'main', found: true, rect: rect(240, 60, 1200, 840) },
      { name: 'footer', selector: 'footer', found: true, rect: rect(0, 900, 1440, 60) },
    ]);
    expect(analyzeLayout(contract, scraped)).toHaveLength(0);
  });

  it('flags sidebar overlapping main', () => {
    const contract = contractOf([
      { name: 'sidebar', selector: 'aside' },
      { name: 'main', selector: 'main' },
    ]);
    const scraped = scrapedOf([
      { name: 'sidebar', selector: 'aside', found: true, rect: rect(0, 60, 300, 840) },
      { name: 'main', selector: 'main', found: true, rect: rect(200, 60, 1240, 840) },
    ]);
    const v = analyzeLayout(contract, scraped);
    expect(v.some(x => x.type === 'overlap' && x.region === 'sidebar')).toBe(true);
  });

  it('flags header covering main', () => {
    const contract = contractOf([
      { name: 'header', selector: 'header' },
      { name: 'main', selector: 'main' },
    ]);
    const scraped = scrapedOf([
      { name: 'header', selector: 'header', found: true, rect: rect(0, 0, 1440, 120) },
      { name: 'main', selector: 'main', found: true, rect: rect(240, 60, 1200, 840) },
    ]);
    const v = analyzeLayout(contract, scraped);
    expect(v.some(x => x.type === 'covered' && x.region === 'header')).toBe(true);
  });

  it('flags main exceeding the viewport horizontally', () => {
    const contract = contractOf([{ name: 'main', selector: 'main' }]);
    const scraped = scrapedOf([
      { name: 'main', selector: 'main', found: true, rect: rect(240, 60, 1300, 840) }, // right = 1540 > 1440
    ]);
    const v = analyzeLayout(contract, scraped);
    expect(v.some(x => x.type === 'out-of-viewport' && x.region === 'main')).toBe(true);
  });

  it('flags a missing region', () => {
    const contract = contractOf([
      { name: 'main', selector: 'main' },
      { name: 'footer', selector: 'footer' },
    ]);
    const scraped = scrapedOf([
      { name: 'main', selector: 'main', found: true, rect: rect(0, 0, 1440, 800) },
      { name: 'footer', selector: 'footer', found: false },
    ]);
    const v = analyzeLayout(contract, scraped);
    expect(v.some(x => x.type === 'missing' && x.region === 'footer')).toBe(true);
  });

  it('does not flag tiny sub-threshold overlaps', () => {
    const contract = contractOf([
      { name: 'sidebar', selector: 'aside' },
      { name: 'main', selector: 'main' },
    ]);
    const scraped = scrapedOf([
      { name: 'sidebar', selector: 'aside', found: true, rect: rect(0, 60, 244, 840) },
      { name: 'main', selector: 'main', found: true, rect: rect(240, 60, 1200, 840) }, // 4px overlap < 8px threshold
    ]);
    expect(analyzeLayout(contract, scraped).some(x => x.type === 'overlap')).toBe(false);
  });

  it('detects z-order mismatch on overlapping regions', () => {
    const contract = contractOf([
      { name: 'header', selector: 'header', zIndex: 10 }, // declared above main
      { name: 'main', selector: 'main', zIndex: 1 },
    ]);
    const scraped = scrapedOf([
      { name: 'header', selector: 'header', found: true, rect: rect(0, 0, 1440, 120), zIndex: 1 }, // actually below
      { name: 'main', selector: 'main', found: true, rect: rect(240, 60, 1200, 840), zIndex: 10 },
    ]);
    const v = analyzeLayout(contract, scraped);
    expect(v.some(x => x.type === 'z-order' && x.region === 'header')).toBe(true);
  });
});

describe('formatLayoutContract / formatLayoutVerify (#3083)', () => {
  it('formats a contract with regions', () => {
    const out = formatLayoutContract(contractOf([
      { name: 'main', selector: 'main', zIndex: 1, rect: rect(0, 0, 1200, 800) },
    ]));
    expect(out).toContain('Layout Contract (1440x900)');
    expect(out).toContain('main: main');
    expect(out).toContain('z=1');
  });

  it('formats a passed result', () => {
    const result: LayoutVerifyResult = { available: true, passed: true, violations: [], summary: 'ok' };
    expect(formatLayoutVerify(result)).toContain('PASSED');
  });

  it('formats a failed result with violation detail', () => {
    const result: LayoutVerifyResult = {
      available: true,
      passed: false,
      violations: [{ type: 'overlap', region: 'sidebar', otherRegion: 'main', selector: 'aside', message: 'overlaps' }],
      summary: 'FAILED',
    };
    const out = formatLayoutVerify(result);
    expect(out).toContain('FAILED');
    expect(out).toContain('overlap');
    expect(out).toContain('sidebar');
  });

  it('formats a skipped result', () => {
    const result: LayoutVerifyResult = { available: false, passed: true, violations: [], summary: 'skipped: Playwright not installed.' };
    expect(formatLayoutVerify(result)).toContain('skipped');
  });
});

describe('layoutContractToJson (#3083)', () => {
  it('maps violations into the stable JSON schema (v2)', () => {
    const result: LayoutVerifyResult = {
      available: true,
      passed: false,
      violations: [
        { type: 'overlap', region: 'sidebar', otherRegion: 'main', selector: 'aside', message: 'overlaps' },
        { type: 'out-of-viewport', region: 'main', selector: 'main', message: 'too wide' },
      ],
      summary: 'FAILED: 2 violation(s)',
    };
    const json = layoutContractToJson(result, 'page.html');
    expect(json.tool).toBe('layout-contract');
    expect(typeof json.schemaVersion).toBe('number');
    expect(json.passed).toBe(false);
    expect(json.exitCode).toBe(1);
    expect(json.file).toBe('page.html');
    const overlap = json.sections.find(s => s.name === 'Sidebar/Main Overlap');
    expect(overlap?.status).toBe('fail');
    expect(overlap?.violations).toHaveLength(1);
  });

  it('uses exitCode 3 when Playwright unavailable', () => {
    const result: LayoutVerifyResult = { available: false, passed: true, violations: [], summary: 'skipped' };
    expect(layoutContractToJson(result).exitCode).toBe(3);
  });
});

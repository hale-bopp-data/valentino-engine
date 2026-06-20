import { describe, it, expect } from 'vitest';
import { formatGridContract, formatGridVerify } from './grid-contract.js';
import type { GridContract, GridVerifyResult } from './grid-contract.js';

describe('formatGridContract', () => {
  it('formats basic contract', () => {
    const contract: GridContract = {
      version: 1,
      selector: 'main',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      slots: [
        { selector: 'div:nth-child(1)', childCount: 0 },
        { selector: 'div:nth-child(2)', childCount: 0 },
      ],
    };
    const output = formatGridContract(contract);
    expect(output).toContain('Grid Contract: main');
    expect(output).toContain('display: grid');
    expect(output).toContain('1fr 1fr');
    expect(output).toContain('slots: 2');
  });

  it('includes grid-area info', () => {
    const contract: GridContract = {
      version: 1,
      selector: '.layout',
      display: 'grid',
      gridTemplateAreas: '"header header" "sidebar content"',
      slots: [
        { selector: '.header', gridArea: 'header', childCount: 0 },
        { selector: '.sidebar', gridArea: 'sidebar', childCount: 0 },
      ],
    };
    const output = formatGridContract(contract);
    expect(output).toContain('area: header');
    expect(output).toContain('area: sidebar');
  });

  it('includes gap info', () => {
    const contract: GridContract = {
      version: 1,
      selector: 'main',
      display: 'grid',
      gap: '16px',
      slots: [],
    };
    const output = formatGridContract(contract);
    expect(output).toContain('gap: 16px');
  });
});

describe('formatGridVerify', () => {
  it('formats passed result', () => {
    const result: GridVerifyResult = {
      available: true,
      passed: true,
      violations: [],
      summary: 'Grid contract verified: 2 slot(s) match',
    };
    const output = formatGridVerify(result);
    expect(output).toContain('PASSED');
  });

  it('formats failed result', () => {
    const result: GridVerifyResult = {
      available: true,
      passed: false,
      violations: [{
        type: 'mismatch',
        selector: 'main',
        property: 'display',
        expected: 'grid',
        actual: 'block',
        message: 'display mismatch',
      }],
      summary: 'Grid contract FAILED',
    };
    const output = formatGridVerify(result);
    expect(output).toContain('FAILED');
    expect(output).toContain('mismatch');
  });

  it('formats skipped result', () => {
    const result: GridVerifyResult = {
      available: false,
      passed: true,
      violations: [],
      summary: 'Grid contract verification skipped.',
    };
    const output = formatGridVerify(result);
    expect(output).toContain('skipped');
  });

  it('shows multiple violations', () => {
    const result: GridVerifyResult = {
      available: true,
      passed: false,
      violations: [
        { type: 'missing', selector: '.nav', message: 'Slot not found: .nav' },
        { type: 'extra', selector: 'main', expected: '2', actual: '3', message: 'Child count mismatch' },
      ],
      summary: 'Grid contract FAILED: 2 violation(s)',
    };
    const output = formatGridVerify(result);
    expect(output).toContain('missing');
    expect(output).toContain('extra');
  });
});

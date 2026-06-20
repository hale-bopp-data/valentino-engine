export interface GridSlot {
  selector: string;
  gridArea?: string;
  gridColumn?: string;
  gridRow?: string;
  display?: string;
  childCount: number;
}

export interface GridContract {
  version: 1;
  selector: string;
  display: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridTemplateAreas?: string;
  gap?: string;
  slots: GridSlot[];
}

export interface GridVerifyViolation {
  type: 'missing' | 'mismatch' | 'extra';
  selector: string;
  property?: string;
  expected?: string;
  actual?: string;
  message: string;
}

export interface GridVerifyResult {
  available: boolean;
  passed: boolean;
  violations: GridVerifyViolation[];
  summary: string;
}

const SKIPPED_RESULT: GridVerifyResult = {
  available: false,
  passed: true,
  violations: [],
  summary: 'Grid contract verification skipped: Playwright not installed.',
};

const INIT_SCRIPT = `
(containerSelector) => {
  const container = document.querySelector(containerSelector);
  if (!container) return null;

  const style = window.getComputedStyle(container);
  const children = Array.from(container.children);

  const slots = children.map((child, i) => {
    const cs = window.getComputedStyle(child);
    const tag = child.tagName.toLowerCase();
    const id = child.id ? '#' + child.id : '';
    const cls = child.className ? '.' + child.className.split(' ').join('.') : '';
    return {
      selector: tag + id + cls || tag + ':nth-child(' + (i + 1) + ')',
      gridArea: cs.gridArea !== 'auto / auto / auto / auto' ? cs.gridArea : undefined,
      gridColumn: cs.gridColumn !== 'auto / auto' ? cs.gridColumn : undefined,
      gridRow: cs.gridRow !== 'auto / auto' ? cs.gridRow : undefined,
      display: cs.display,
      childCount: child.children.length,
    };
  });

  return {
    version: 1,
    selector: containerSelector,
    display: style.display,
    gridTemplateColumns: style.gridTemplateColumns !== 'none' ? style.gridTemplateColumns : undefined,
    gridTemplateRows: style.gridTemplateRows !== 'none' ? style.gridTemplateRows : undefined,
    gridTemplateAreas: style.gridTemplateAreas !== 'none' ? style.gridTemplateAreas : undefined,
    gap: style.gap !== 'normal' && style.gap !== 'normal normal' ? style.gap : undefined,
    slots,
  };
}
`;

const VERIFY_SCRIPT = `
(contract) => {
  const violations = [];
  const container = document.querySelector(contract.selector);
  if (!container) {
    violations.push({
      type: 'missing',
      selector: contract.selector,
      message: 'Container not found: ' + contract.selector,
    });
    return violations;
  }

  const style = window.getComputedStyle(container);

  if (style.display !== contract.display) {
    violations.push({
      type: 'mismatch',
      selector: contract.selector,
      property: 'display',
      expected: contract.display,
      actual: style.display,
      message: 'display: expected "' + contract.display + '", got "' + style.display + '"',
    });
  }

  if (contract.gridTemplateColumns) {
    const actual = style.gridTemplateColumns;
    if (actual === 'none' || actual !== contract.gridTemplateColumns) {
      violations.push({
        type: 'mismatch',
        selector: contract.selector,
        property: 'gridTemplateColumns',
        expected: contract.gridTemplateColumns,
        actual: actual,
        message: 'grid-template-columns mismatch',
      });
    }
  }

  const children = Array.from(container.children);
  for (const slot of contract.slots) {
    const el = container.querySelector(slot.selector);
    if (!el) {
      violations.push({
        type: 'missing',
        selector: slot.selector,
        message: 'Slot not found: ' + slot.selector,
      });
      continue;
    }

    const cs = window.getComputedStyle(el);
    if (slot.gridArea) {
      const actual = cs.gridArea;
      if (actual !== slot.gridArea) {
        violations.push({
          type: 'mismatch',
          selector: slot.selector,
          property: 'gridArea',
          expected: slot.gridArea,
          actual: actual,
          message: 'grid-area mismatch on ' + slot.selector,
        });
      }
    }
  }

  const expectedCount = contract.slots.length;
  if (children.length !== expectedCount) {
    violations.push({
      type: children.length > expectedCount ? 'extra' : 'missing',
      selector: contract.selector,
      expected: String(expectedCount),
      actual: String(children.length),
      message: 'Child count: expected ' + expectedCount + ', got ' + children.length,
    });
  }

  return violations;
}
`;

export async function initGridContract(
  html: string,
  containerSelector = 'main',
): Promise<GridContract | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const contract = await page.evaluate(INIT_SCRIPT, containerSelector) as GridContract | null;
    return contract;
  } finally {
    await browser?.close();
  }
}

export async function verifyGridContract(
  html: string,
  contract: GridContract,
): Promise<GridVerifyResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pw: any;
  try {
    // @ts-ignore
    pw = await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return SKIPPED_RESULT;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const violations = await page.evaluate(VERIFY_SCRIPT, contract) as GridVerifyViolation[];

    return {
      available: true,
      passed: violations.length === 0,
      violations,
      summary: violations.length === 0
        ? `Grid contract verified: ${contract.slots.length} slot(s) match`
        : `Grid contract FAILED: ${violations.length} violation(s)`,
    };
  } catch (err) {
    return {
      available: true,
      passed: false,
      violations: [{
        type: 'missing',
        selector: contract.selector,
        message: `Runtime error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      summary: `Grid contract error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await browser?.close();
  }
}

export function formatGridContract(contract: GridContract): string {
  const lines: string[] = [];
  lines.push(`Grid Contract: ${contract.selector}`);
  lines.push(`  display: ${contract.display}`);
  if (contract.gridTemplateColumns) lines.push(`  grid-template-columns: ${contract.gridTemplateColumns}`);
  if (contract.gridTemplateRows) lines.push(`  grid-template-rows: ${contract.gridTemplateRows}`);
  if (contract.gridTemplateAreas) lines.push(`  grid-template-areas: ${contract.gridTemplateAreas}`);
  if (contract.gap) lines.push(`  gap: ${contract.gap}`);
  lines.push(`  slots: ${contract.slots.length}`);
  for (const slot of contract.slots) {
    let detail = `    ${slot.selector}`;
    if (slot.gridArea) detail += ` (area: ${slot.gridArea})`;
    if (slot.gridColumn) detail += ` (col: ${slot.gridColumn})`;
    lines.push(detail);
  }
  return lines.join('\n');
}

export function formatGridVerify(result: GridVerifyResult): string {
  const lines: string[] = [];
  if (!result.available) {
    lines.push(result.summary);
    return lines.join('\n');
  }

  if (result.violations.length > 0) {
    lines.push(`Grid contract violations (${result.violations.length}):`);
    for (const v of result.violations) {
      lines.push(`  [${v.type}] ${v.message}`);
    }
  }

  lines.push(result.passed ? 'PASSED' : 'FAILED');
  return lines.join('\n');
}

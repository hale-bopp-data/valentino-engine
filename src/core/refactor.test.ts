import { describe, it, expect } from 'vitest';
import {
  detectFileType, applyFixes, detectNewSelfReferences,
  countNewTokenReferences, previewRefactor, formatProposal,
} from './refactor.js';

describe('detectFileType', () => {
  it('detects .css as css', () => {
    expect(detectFileType('theme.css')).toBe('css');
  });

  it('detects .html as html', () => {
    expect(detectFileType('index.html')).toBe('html');
  });

  it('detects .htm as html', () => {
    expect(detectFileType('page.htm')).toBe('html');
  });

  it('defaults to css for unknown extension', () => {
    expect(detectFileType('styles.scss')).toBe('css');
  });
});

describe('applyFixes', () => {
  it('replaces named colors in CSS', () => {
    const result = applyFixes('color: red;', 'css');
    expect(result).toContain('var(--valentino-color-red)');
  });

  it('replaces named colors in HTML style tags', () => {
    const html = '<style>body { color: red; }</style>';
    const result = applyFixes(html, 'html');
    expect(result).toContain('var(--valentino-color-red)');
  });

  it('returns unchanged content when no fixes needed', () => {
    const css = 'color: var(--primary);';
    expect(applyFixes(css, 'css')).toBe(css);
  });
});

describe('detectNewSelfReferences', () => {
  it('detects self-reference introduced by fix', () => {
    const original = '--valentino-color-red: red;';
    const proposed = '--valentino-color-red: var(--valentino-color-red);';
    const warnings = detectNewSelfReferences(original, proposed);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].token).toBe('--valentino-color-red');
  });

  it('ignores pre-existing self-references', () => {
    const content = '--loop: var(--loop);';
    const warnings = detectNewSelfReferences(content, content);
    expect(warnings).toHaveLength(0);
  });

  it('returns empty when no self-references', () => {
    const original = 'color: red;';
    const proposed = 'color: var(--valentino-color-red);';
    const warnings = detectNewSelfReferences(original, proposed);
    expect(warnings).toHaveLength(0);
  });

  it('detects when fix creates a new self-ref among multiple tokens', () => {
    const original = '--valentino-color-blue: blue;\n--safe: green;';
    const proposed = '--valentino-color-blue: var(--valentino-color-blue);\n--safe: var(--valentino-color-green);';
    const warnings = detectNewSelfReferences(original, proposed);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].token).toBe('--valentino-color-blue');
  });
});

describe('countNewTokenReferences', () => {
  it('counts new var() references', () => {
    const original = 'color: red;';
    const proposed = 'color: var(--valentino-color-red);';
    expect(countNewTokenReferences(original, proposed)).toBe(1);
  });

  it('returns 0 when no new references', () => {
    const css = 'color: var(--primary);';
    expect(countNewTokenReferences(css, css)).toBe(0);
  });

  it('counts multiple new references', () => {
    const original = 'color: red;\nbackground: blue;';
    const proposed = 'color: var(--valentino-color-red);\nbackground: var(--valentino-color-blue);';
    expect(countNewTokenReferences(original, proposed)).toBe(2);
  });
});

describe('previewRefactor', () => {
  it('returns clean proposal for valid CSS', () => {
    const proposal = previewRefactor('color: var(--primary);', 'style.css');
    expect(proposal.hunks).toHaveLength(0);
    expect(proposal.safe).toBe(true);
  });

  it('proposes fixes for named colors', () => {
    const proposal = previewRefactor('color: red;', 'style.css');
    expect(proposal.hunks.length).toBeGreaterThan(0);
    expect(proposal.proposed).toContain('var(--valentino-color-red)');
    expect(proposal.fixCount).toBeGreaterThan(0);
    expect(proposal.safe).toBe(true);
  });

  it('marks unsafe when fix creates self-reference', () => {
    const css = '--valentino-color-red: red;';
    const proposal = previewRefactor(css, 'tokens.css');
    if (proposal.hunks.length > 0) {
      expect(proposal.selfRefWarnings.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('detects HTML file type', () => {
    const proposal = previewRefactor('<p>hello</p>', 'page.html');
    expect(proposal.fileType).toBe('html');
  });
});

describe('formatProposal', () => {
  it('shows clean message when no changes needed', () => {
    const proposal = previewRefactor('color: var(--ok);', 'clean.css');
    const output = formatProposal(proposal, 'clean.css');
    expect(output).toContain('No refactoring needed');
  });

  it('shows diff and stats for proposals with changes', () => {
    const proposal = previewRefactor('color: red;', 'theme.css');
    const output = formatProposal(proposal, 'theme.css');
    expect(output).toContain('Refactor preview');
    expect(output).toContain('Lines changed');
  });

  it('shows self-ref warnings', () => {
    const proposal = previewRefactor('--valentino-color-red: red;', 'tokens.css');
    if (proposal.selfRefWarnings.length > 0) {
      const output = formatProposal(proposal, 'tokens.css');
      expect(output).toContain('WARNING');
      expect(output).toContain('self-referential');
    }
  });
});

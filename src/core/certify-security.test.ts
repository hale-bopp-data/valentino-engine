import { describe, it, expect } from 'vitest';
import {
  checkInlineStyles, checkEventHandlers, checkTokenOverrides,
  checkMissingAlt, checkMissingAria, checkHeadingOrder, checkFocusManagement,
  certifySecurity, certifySecurityCss, formatCertification,
} from './certify-security.js';

describe('checkInlineStyles', () => {
  it('detects inline style on critical element', () => {
    const v = checkInlineStyles('<form style="display:none">');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('critical');
    expect(v[0].element).toBe('form');
  });

  it('detects inline style on non-critical element as warning', () => {
    const v = checkInlineStyles('<div style="color:red">');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('warning');
  });

  it('detects multiple inline styles', () => {
    const html = '<input style="border:0">\n<button style="opacity:0">';
    const v = checkInlineStyles(html);
    expect(v).toHaveLength(2);
    expect(v[0].element).toBe('input');
    expect(v[1].element).toBe('button');
  });

  it('returns empty for clean HTML', () => {
    expect(checkInlineStyles('<div class="safe"><p>text</p></div>')).toHaveLength(0);
  });

  it('truncates long style values in detail', () => {
    const longStyle = 'a'.repeat(100);
    const v = checkInlineStyles(`<div style="${longStyle}">`);
    expect(v[0].detail.length).toBeLessThan(200);
  });
});

describe('checkEventHandlers', () => {
  it('detects onclick handler', () => {
    const v = checkEventHandlers('<button onclick="alert(1)">');
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('critical');
    expect(v[0].detail).toContain('onclick');
  });

  it('detects onsubmit handler', () => {
    const v = checkEventHandlers('<form onsubmit="steal()">');
    expect(v).toHaveLength(1);
    expect(v[0].element).toBe('form');
  });

  it('returns empty for clean HTML', () => {
    expect(checkEventHandlers('<button class="btn">OK</button>')).toHaveLength(0);
  });

  it('detects multiple handlers', () => {
    const html = '<a onmouseover="x()">\n<div onload="y()">';
    const v = checkEventHandlers(html);
    expect(v).toHaveLength(2);
  });
});

describe('checkTokenOverrides', () => {
  it('detects token override outside :root', () => {
    const css = '.card { --valentino-color-primary: red; }';
    const v = checkTokenOverrides(css);
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe('token-override');
    expect(v[0].detail).toContain('--valentino-color-primary');
    expect(v[0].detail).toContain('.card');
  });

  it('allows token declaration inside :root', () => {
    const css = ':root { --valentino-color-primary: blue; }';
    const v = checkTokenOverrides(css);
    expect(v).toHaveLength(0);
  });

  it('allows token declaration inside html', () => {
    const css = 'html { --valentino-color-primary: blue; }';
    const v = checkTokenOverrides(css);
    expect(v).toHaveLength(0);
  });

  it('detects multiple overrides', () => {
    const css = '.dark { --color-bg: #000; --color-text: #fff; }';
    const v = checkTokenOverrides(css);
    expect(v).toHaveLength(2);
  });

  it('returns empty for CSS without custom properties', () => {
    const css = '.card { color: var(--primary); padding: 1rem; }';
    const v = checkTokenOverrides(css);
    expect(v).toHaveLength(0);
  });
});

describe('checkMissingAlt', () => {
  it('detects img without alt', () => {
    const v = checkMissingAlt('<img src="logo.png">');
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe('missing-alt');
    expect(v[0].severity).toBe('critical');
    expect(v[0].element).toBe('img');
  });

  it('allows img with alt attribute', () => {
    expect(checkMissingAlt('<img src="logo.png" alt="Company logo">')).toHaveLength(0);
  });

  it('allows img with empty alt (decorative)', () => {
    expect(checkMissingAlt('<img src="spacer.gif" alt="">')).toHaveLength(0);
  });

  it('detects multiple images without alt', () => {
    const html = '<img src="a.png">\n<img src="b.png">';
    expect(checkMissingAlt(html)).toHaveLength(2);
  });

  it('returns empty for HTML without images', () => {
    expect(checkMissingAlt('<div><p>text</p></div>')).toHaveLength(0);
  });
});

describe('checkMissingAria', () => {
  it('detects input without accessible name', () => {
    const v = checkMissingAria('<input type="text" name="email">');
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe('missing-aria');
    expect(v[0].severity).toBe('critical');
  });

  it('allows input with aria-label', () => {
    expect(checkMissingAria('<input type="text" aria-label="Email">')).toHaveLength(0);
  });

  it('allows input with placeholder', () => {
    expect(checkMissingAria('<input type="text" placeholder="Enter email">')).toHaveLength(0);
  });

  it('allows input with title', () => {
    expect(checkMissingAria('<input type="text" title="Email address">')).toHaveLength(0);
  });

  it('skips hidden input', () => {
    expect(checkMissingAria('<input type="hidden" name="token">')).toHaveLength(0);
  });

  it('skips submit input', () => {
    expect(checkMissingAria('<input type="submit">')).toHaveLength(0);
  });

  it('detects button without text content', () => {
    const v = checkMissingAria('<button></button>');
    expect(v).toHaveLength(1);
    expect(v[0].element).toBe('button');
  });

  it('allows button with text content', () => {
    expect(checkMissingAria('<button>Submit</button>')).toHaveLength(0);
  });

  it('allows button with aria-label and no text', () => {
    expect(checkMissingAria('<button aria-label="Close menu"></button>')).toHaveLength(0);
  });

  it('detects empty link with href', () => {
    const v = checkMissingAria('<a href="/page"></a>');
    expect(v).toHaveLength(1);
    expect(v[0].element).toBe('a');
  });

  it('allows link with text content', () => {
    expect(checkMissingAria('<a href="/page">Read more</a>')).toHaveLength(0);
  });

  it('skips anchor without href (not focusable)', () => {
    expect(checkMissingAria('<a name="section1"></a>')).toHaveLength(0);
  });

  it('allows textarea with placeholder', () => {
    expect(checkMissingAria('<textarea placeholder="Comment"></textarea>')).toHaveLength(0);
  });

  it('detects textarea without accessible name', () => {
    const v = checkMissingAria('<textarea></textarea>');
    expect(v).toHaveLength(1);
    expect(v[0].element).toBe('textarea');
  });

  it('returns empty for HTML without interactive elements', () => {
    expect(checkMissingAria('<div><p>text</p></div>')).toHaveLength(0);
  });
});

describe('checkHeadingOrder', () => {
  it('returns empty for valid heading order', () => {
    const html = '<h1>Title</h1><h2>Section</h2><h3>Subsection</h3>';
    expect(checkHeadingOrder(html)).toHaveLength(0);
  });

  it('detects heading level skip (h1 to h3)', () => {
    const v = checkHeadingOrder('<h1>Title</h1><h3>Skipped h2</h3>');
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe('heading-order');
    expect(v[0].severity).toBe('warning');
    expect(v[0].detail).toContain('h1');
    expect(v[0].detail).toContain('h3');
  });

  it('detects multiple h1 elements', () => {
    const html = '<h1>First</h1><h1>Second</h1>';
    const v = checkHeadingOrder(html);
    expect(v).toHaveLength(1);
    expect(v[0].detail).toContain('Multiple');
  });

  it('detects multiple level skips', () => {
    const html = '<h1>Title</h1><h3>Skip</h3><h5>Skip again</h5>';
    const v = checkHeadingOrder(html);
    expect(v.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for HTML without headings', () => {
    expect(checkHeadingOrder('<div><p>text</p></div>')).toHaveLength(0);
  });
});

describe('checkFocusManagement', () => {
  it('detects positive tabindex', () => {
    const v = checkFocusManagement('<a href="/x" tabindex="5">Link</a>');
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe('focus-management');
    expect(v[0].severity).toBe('warning');
    expect(v[0].detail).toContain('tabindex="5"');
  });

  it('allows tabindex=0', () => {
    expect(checkFocusManagement('<div tabindex="0">Focusable</div>')).toHaveLength(0);
  });

  it('allows tabindex=-1', () => {
    expect(checkFocusManagement('<div tabindex="-1">Programmatic</div>')).toHaveLength(0);
  });

  it('detects multiple positive tabindex values', () => {
    const html = '<a href="/a" tabindex="3">A</a>\n<button tabindex="10">B</button>';
    expect(checkFocusManagement(html)).toHaveLength(2);
  });

  it('returns empty for HTML without tabindex', () => {
    expect(checkFocusManagement('<div><a href="/x">Link</a></div>')).toHaveLength(0);
  });
});

describe('certifySecurity', () => {
  it('certifies clean HTML', () => {
    const html = '<div class="safe"><p>Hello</p></div>';
    const cert = certifySecurity(html);
    expect(cert.certified).toBe(true);
    expect(cert.violations).toHaveLength(0);
  });

  it('fails certification on critical violations', () => {
    const html = '<form style="display:none"><input onclick="steal()">';
    const cert = certifySecurity(html);
    expect(cert.certified).toBe(false);
    expect(cert.summary.inlineStyleCount).toBe(1);
    expect(cert.summary.eventHandlerCount).toBe(1);
  });

  it('certifies with warnings only (token overrides)', () => {
    const html = '<style>.card { --custom: red; }</style><div>ok</div>';
    const cert = certifySecurity(html);
    expect(cert.certified).toBe(true);
    expect(cert.summary.tokenOverrideCount).toBe(1);
  });

  it('detects violations across style tags and inline', () => {
    const html = '<style>.x { --bad: 1; }</style><button style="color:red">';
    const cert = certifySecurity(html);
    expect(cert.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('fails certification on missing alt (a11y critical)', () => {
    const cert = certifySecurity('<div><img src="logo.png"></div>');
    expect(cert.certified).toBe(false);
    expect(cert.summary.missingAltCount).toBe(1);
  });

  it('fails certification on missing aria (a11y critical)', () => {
    const cert = certifySecurity('<input type="text" name="q">');
    expect(cert.certified).toBe(false);
    expect(cert.summary.missingAriaCount).toBe(1);
  });

  it('includes a11y warnings (heading order) without failing certification', () => {
    const cert = certifySecurity('<h1>Title</h1><h3>Skip</h3>');
    expect(cert.certified).toBe(true);
    expect(cert.summary.headingOrderCount).toBe(1);
  });

  it('reports all a11y summary fields', () => {
    const html = '<img src="a.png"><input type="text"><h1>A</h1><h3>B</h3><a href="/x" tabindex="2">x</a>';
    const cert = certifySecurity(html);
    expect(cert.summary.missingAltCount).toBe(1);
    expect(cert.summary.missingAriaCount).toBe(1);
    expect(cert.summary.headingOrderCount).toBe(1);
    expect(cert.summary.focusManagementCount).toBe(1);
  });
});

describe('certifySecurityCss', () => {
  it('certifies clean CSS', () => {
    const css = ':root { --primary: blue; }\n.btn { color: var(--primary); }';
    const cert = certifySecurityCss(css);
    expect(cert.certified).toBe(true);
  });

  it('detects token overrides in CSS', () => {
    const css = '.theme-dark { --primary: #000; }';
    const cert = certifySecurityCss(css);
    expect(cert.violations).toHaveLength(1);
  });
});

describe('formatCertification', () => {
  it('shows CERTIFIED for clean file', () => {
    const cert = certifySecurity('<div>safe</div>');
    const output = formatCertification(cert, 'page.html');
    expect(output).toContain('CERTIFIED');
  });

  it('shows NOT CERTIFIED for critical violations', () => {
    const cert = certifySecurity('<form style="x:y">');
    const output = formatCertification(cert, 'page.html');
    expect(output).toContain('NOT CERTIFIED');
    expect(output).toContain('CRITICAL');
  });

  it('shows WARNING section for non-critical issues', () => {
    const html = '<style>.x { --tok: 1; }</style>';
    const cert = certifySecurity(html);
    const output = formatCertification(cert, 'page.html');
    expect(output).toContain('WARNING');
  });
});

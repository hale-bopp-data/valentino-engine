import { describe, it, expect } from 'vitest';
import {
  checkInlineStyles, checkEventHandlers, checkTokenOverrides,
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

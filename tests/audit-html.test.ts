import { describe, it, expect } from 'vitest';
import { auditHtml, extractStyleTagCss, extractInlineStyles } from '../src/core/audit-html.js';

describe('audit-html', () => {
  describe('extractStyleTagCss', () => {
    it('extracts CSS from <style> tags', () => {
      const html = '<html><head><style>body { color: red; }</style></head></html>';
      const result = extractStyleTagCss(html);
      expect(result).toHaveLength(1);
      expect(result[0].css).toBe('body { color: red; }');
    });

    it('extracts multiple <style> blocks', () => {
      const html = '<style>a{}</style><style>b{}</style>';
      expect(extractStyleTagCss(html)).toHaveLength(2);
    });

    it('returns empty for no style tags', () => {
      expect(extractStyleTagCss('<div>hello</div>')).toHaveLength(0);
    });
  });

  describe('extractInlineStyles', () => {
    it('extracts style attributes', () => {
      const html = '<div style="color: red;">text</div>';
      const result = extractInlineStyles(html);
      expect(result).toHaveLength(1);
      expect(result[0].element).toBe('div');
      expect(result[0].css).toBe('color: red;');
    });

    it('handles multiple inline styles', () => {
      const html = '<p style="margin: 10px;"></p><span style="padding: 5px;"></span>';
      expect(extractInlineStyles(html)).toHaveLength(2);
    });
  });

  describe('auditHtml', () => {
    it('passes clean HTML', () => {
      const html = '<html><head><style>body { color: var(--text); }</style></head></html>';
      const result = auditHtml(html);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('detects hardcoded px in <style>', () => {
      const html = '<style>body { padding: 10px; }</style>';
      const result = auditHtml(html);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].source).toBe('style-tag');
      expect(result.violations[0].message).toContain('Hardcoded px');
    });

    it('detects hardcoded hex color in <style>', () => {
      const html = '<style>.box { color: #ff0000; }</style>';
      const result = auditHtml(html);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.message.includes('Hardcoded color'))).toBe(true);
    });

    it('detects named CSS color in <style>', () => {
      const html = '<style>h1 { color: red; }</style>';
      const result = auditHtml(html);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.message.includes('Named CSS color'))).toBe(true);
    });

    it('detects hardcoded px in inline style', () => {
      const html = '<div style="padding: 20px;">text</div>';
      const result = auditHtml(html);
      expect(result.valid).toBe(false);
      expect(result.violations[0].source).toBe('inline-style');
      expect(result.violations[0].element).toBe('div');
    });

    it('detects hardcoded color in inline style', () => {
      const html = '<p style="color: #333;">text</p>';
      const result = auditHtml(html);
      expect(result.valid).toBe(false);
      expect(result.violations[0].source).toBe('inline-style');
    });

    it('counts style tags and inline styles', () => {
      const html = '<style>a{}</style><style>b{}</style><div style="x">y</div>';
      const result = auditHtml(html);
      expect(result.styleTagCount).toBe(2);
      expect(result.inlineStyleCount).toBe(1);
    });

    it('handles HTML with no styles', () => {
      const result = auditHtml('<div>plain text</div>');
      expect(result.valid).toBe(true);
      expect(result.styleTagCount).toBe(0);
      expect(result.inlineStyleCount).toBe(0);
    });

    it('handles mixed violations from <style> and inline', () => {
      const html = '<style>.a { margin: 5px; }</style><span style="color: blue;">x</span>';
      const result = auditHtml(html);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.source === 'style-tag')).toBe(true);
      expect(result.violations.some(v => v.source === 'inline-style')).toBe(true);
    });
  });
});

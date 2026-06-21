import { describe, it, expect } from 'vitest';
import { suggestFixes, formatPatch, formatTable, suggestFixToJson } from '../src/core/suggest-fix.js';

describe('suggest-fix', () => {
  describe('suggestFixes — CSS', () => {
    it('suggests 0px → 0', () => {
      const result = suggestFixes('padding: 0px;', 'test.css');
      const s = result.suggestions.find(s => s.rule === '0px-to-zero');
      expect(s).toBeDefined();
      expect(s!.before).toBe('0px');
      expect(s!.after).toBe('0');
    });

    it('suggests px → token when exact match', () => {
      const result = suggestFixes('margin: 16px;', 'test.css');
      const s = result.suggestions.find(s => s.rule === 'px-to-token');
      expect(s).toBeDefined();
      expect(s!.after).toContain('var(--valentino-space');
    });

    it('suggests px → rem when no token match', () => {
      const result = suggestFixes('width: 100px;', 'test.css');
      const s = result.suggestions.find(s => s.rule === 'px-to-rem');
      expect(s).toBeDefined();
      expect(s!.after).toBe('6.25rem');
    });

    it('suggests hardcoded hex color → token', () => {
      const result = suggestFixes('color: #ff0000;', 'test.css');
      const s = result.suggestions.find(s => s.rule === 'color-to-token');
      expect(s).toBeDefined();
      expect(s!.before).toBe('#ff0000');
    });

    it('does not flag token definitions', () => {
      const result = suggestFixes('--my-color: #ff0000;', 'test.css');
      const colorTokens = result.suggestions.filter(s => s.rule === 'color-to-token');
      expect(colorTokens).toHaveLength(0);
    });

    it('suggests named color → token', () => {
      const result = suggestFixes('color: red;', 'test.css');
      const s = result.suggestions.find(s => s.rule === 'named-color-to-token');
      expect(s).toBeDefined();
      expect(s!.after).toContain('var(--valentino-color-error)');
    });

    it('returns passed=true when no violations', () => {
      const result = suggestFixes('color: var(--my-color);', 'test.css');
      expect(result.passed).toBe(true);
      expect(result.suggestions).toHaveLength(0);
    });

    it('handles multiple violations on same line', () => {
      const result = suggestFixes('padding: 8px 16px;', 'test.css');
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('suggestFixes — HTML', () => {
    it('suggests extracting inline styles to class', () => {
      const html = '<div style="color: red; padding: 10px;">Hello</div>';
      const result = suggestFixes(html, 'test.html');
      const inline = result.suggestions.find(s => s.rule === 'inline-to-class');
      expect(inline).toBeDefined();
    });
  });

  describe('formatPatch', () => {
    it('generates unified diff format', () => {
      const result = suggestFixes('padding: 0px;', 'test.css');
      const patch = formatPatch(result);
      expect(patch).toContain('--- a/test.css');
      expect(patch).toContain('+++ b/test.css');
      expect(patch).toContain('@@');
    });

    it('returns no changes for clean file', () => {
      const result = suggestFixes('color: var(--c);', 'test.css');
      const patch = formatPatch(result);
      expect(patch).toContain('No changes');
    });
  });

  describe('formatTable', () => {
    it('generates markdown table', () => {
      const result = suggestFixes('padding: 16px;', 'test.css');
      const table = formatTable(result);
      expect(table).toContain('| Line |');
      expect(table).toContain('16px');
    });

    it('returns no suggestions for clean file', () => {
      const result = suggestFixes('color: var(--c);', 'test.css');
      const table = formatTable(result);
      expect(table).toContain('No suggestions');
    });
  });

  describe('suggestFixToJson', () => {
    it('creates JSON output with sections by rule', () => {
      const result = suggestFixes('padding: 0px; color: red;', 'test.css');
      const json = suggestFixToJson(result);
      expect(json.tool).toBe('suggest-fix');
      expect(json.sections.length).toBeGreaterThan(0);
      expect(json.schemaVersion).toBe(1);
    });

    it('returns passed=true for clean file', () => {
      const result = suggestFixes('color: var(--c);', 'test.css');
      const json = suggestFixToJson(result);
      expect(json.passed).toBe(true);
      expect(json.exitCode).toBe(0);
    });
  });
});

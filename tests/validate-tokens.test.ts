import { describe, it, expect } from 'vitest';
import { validateTokens, parseTokenDeclarations, extractVarReferences } from '../src/core/validate-tokens.js';

describe('validate-tokens', () => {
  describe('parseTokenDeclarations', () => {
    it('parses custom property declarations', () => {
      const css = ':root { --color-primary: #333; --spacing-md: 1rem; }';
      const tokens = parseTokenDeclarations(css);
      expect(tokens.size).toBe(2);
      expect(tokens.get('--color-primary')).toBe('#333');
      expect(tokens.get('--spacing-md')).toBe('1rem');
    });

    it('returns empty map for no custom properties', () => {
      expect(parseTokenDeclarations('body { color: red; }')).toEqual(new Map());
    });
  });

  describe('extractVarReferences', () => {
    it('extracts var() references', () => {
      expect(extractVarReferences('var(--color-primary)')).toEqual(['--color-primary']);
    });

    it('extracts multiple references', () => {
      const refs = extractVarReferences('1px solid var(--border-color) var(--border-width)');
      expect(refs).toContain('--border-color');
      expect(refs).toContain('--border-width');
    });

    it('handles var() with fallback', () => {
      expect(extractVarReferences('var(--missing, red)')).toEqual(['--missing']);
    });

    it('returns empty for no references', () => {
      expect(extractVarReferences('10px')).toEqual([]);
    });
  });

  describe('validateTokens', () => {
    it('passes clean tokens', () => {
      const css = ':root { --a: 10px; --b: var(--a); }';
      const result = validateTokens(css);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.tokenCount).toBe(2);
    });

    it('detects self-reference', () => {
      const css = ':root { --vr-1: var(--vr-1); }';
      const result = validateTokens(css);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('self-reference');
      expect(result.violations[0].token).toBe('--vr-1');
    });

    it('detects two-node cycle', () => {
      const css = ':root { --a: var(--b); --b: var(--a); }';
      const result = validateTokens(css);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.type === 'cycle')).toBe(true);
    });

    it('detects three-node cycle', () => {
      const css = ':root { --a: var(--b); --b: var(--c); --c: var(--a); }';
      const result = validateTokens(css);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.type === 'cycle')).toBe(true);
    });

    it('detects unresolved reference', () => {
      const css = ':root { --a: var(--nonexistent); }';
      const result = validateTokens(css);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('unresolved');
      expect(result.violations[0].detail).toContain('--nonexistent');
    });

    it('detects multiple violations', () => {
      const css = ':root { --a: var(--a); --b: var(--missing); --c: 10px; }';
      const result = validateTokens(css);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.tokenCount).toBe(3);
    });

    it('handles empty CSS', () => {
      const result = validateTokens('');
      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBe(0);
    });

    it('handles tokens with no var references', () => {
      const css = ':root { --a: 10px; --b: red; --c: 1rem; }';
      const result = validateTokens(css);
      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBe(3);
    });

    it('allows valid chains without cycles', () => {
      const css = ':root { --a: 10px; --b: var(--a); --c: var(--b); }';
      const result = validateTokens(css);
      expect(result.valid).toBe(true);
    });
  });
});

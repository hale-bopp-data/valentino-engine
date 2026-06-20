/**
 * Core Guardrails — the 10 Sovereign Laws of Valentino Engine.
 * Each law is a programmatic check, not just documentation.
 */

import { CSS_NAMED_COLORS } from './css-named-colors.js';

export interface GuardrailOptions {
  allowTokenDefinitions?: boolean;
  allowedTokenPrefixes?: string[];
}

export const GUARDRAILS = {
  /** G1: No hardcoded px values in component overrides */
  NO_HARDCODED_PX: /(?<!\d)(\d+)px(?!\s*[/*])/,

  /** G2: No RGBA or HEX hardcoded colors */
  NO_HARDCODED_COLOR: /#[0-9a-fA-F]{3,8}|rgba?\(/,

  /** G3: No direct DOM style manipulation */
  NO_INLINE_STYLE: /\.style\.(padding|margin|color|background)\s*=/,
} as const;

const TOKEN_DEFINITION_RE = /^\s*--[\w-]+\s*:/;
const TOKEN_NAME_RE = /^\s*(--[\w-]+)\s*:/;

function isTokenDefinition(line: string, prefixes?: string[]): boolean {
  if (!TOKEN_DEFINITION_RE.test(line)) return false;
  if (!prefixes || prefixes.length === 0) return true;
  const match = line.match(TOKEN_NAME_RE);
  if (!match) return false;
  return prefixes.some(p => match[1].startsWith(p));
}

export function checkNoHardcodedPx(css: string, options?: GuardrailOptions): string[] {
  const violations: string[] = [];
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    if (options?.allowTokenDefinitions && isTokenDefinition(line, options.allowedTokenPrefixes)) return;
    if (GUARDRAILS.NO_HARDCODED_PX.test(line)) {
      violations.push(`Line ${i + 1}: Hardcoded px detected — use --valentino-rhythm-* variables. "${line.trim()}"`);
    }
  });
  return violations;
}

export function checkNoHardcodedColor(css: string, options?: GuardrailOptions): string[] {
  const violations: string[] = [];
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    if (options?.allowTokenDefinitions && isTokenDefinition(line, options.allowedTokenPrefixes)) return;
    if (GUARDRAILS.NO_HARDCODED_COLOR.test(line)) {
      violations.push(`Line ${i + 1}: Hardcoded color detected — use CSS root variables. "${line.trim()}"`);
    }
  });
  return violations;
}

/**
 * Detect CSS named colors (red, blue, navy, etc.) used as property values.
 * Matches after a colon in CSS declarations to avoid false positives in
 * selectors, comments, or class names.
 */
const CSS_VALUE_WORD_RE = /:\s*([a-z]+)\s*[;!}]/gi;

export function checkNoNamedColor(css: string, options?: GuardrailOptions): string[] {
  const violations: string[] = [];
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    if (options?.allowTokenDefinitions && isTokenDefinition(line, options.allowedTokenPrefixes)) return;
    CSS_VALUE_WORD_RE.lastIndex = 0;
    let match;
    while ((match = CSS_VALUE_WORD_RE.exec(line)) !== null) {
      const word = match[1].toLowerCase();
      if (CSS_NAMED_COLORS.has(word)) {
        violations.push(`Line ${i + 1}: Named CSS color "${word}" detected — use CSS root variables. "${line.trim()}"`);
      }
    }
  });
  return violations;
}

const NAMED_COLOR_REPLACE_RE = /:\s*([a-z]+)\s*([;!}])/gi;

export function fixNamedColors(css: string): string {
  const lines = css.split('\n');
  return lines.map(line => {
    NAMED_COLOR_REPLACE_RE.lastIndex = 0;
    return line.replace(NAMED_COLOR_REPLACE_RE, (full, word, terminator) => {
      if (CSS_NAMED_COLORS.has(word.toLowerCase())) {
        return `: var(--valentino-color-${word.toLowerCase()})${terminator}`;
      }
      return full;
    });
  }).join('\n');
}

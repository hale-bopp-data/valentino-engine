import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor, fixNamedColors } from './guardrails.js';
import type { GuardrailOptions } from './guardrails.js';

export interface HtmlAuditViolation {
  source: 'style-tag' | 'inline-style';
  line: number;
  element?: string;
  message: string;
}

export interface HtmlAuditResult {
  valid: boolean;
  violations: HtmlAuditViolation[];
  styleTagCount: number;
  inlineStyleCount: number;
}

const STYLE_TAG_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const INLINE_STYLE_RE = /<(\w[\w-]*)[^>]+\bstyle\s*=\s*"([^"]*)"/gi;

function lineNumber(html: string, index: number): number {
  return html.substring(0, index).split('\n').length;
}

export function extractStyleTagCss(html: string): { css: string; line: number }[] {
  const results: { css: string; line: number }[] = [];
  let match;
  STYLE_TAG_RE.lastIndex = 0;
  while ((match = STYLE_TAG_RE.exec(html)) !== null) {
    results.push({ css: match[1], line: lineNumber(html, match.index) });
  }
  return results;
}

export function extractInlineStyles(html: string): { element: string; css: string; line: number }[] {
  const results: { element: string; css: string; line: number }[] = [];
  let match;
  INLINE_STYLE_RE.lastIndex = 0;
  while ((match = INLINE_STYLE_RE.exec(html)) !== null) {
    results.push({ element: match[1], css: match[2], line: lineNumber(html, match.index) });
  }
  return results;
}

function auditCssBlock(css: string, options?: GuardrailOptions): string[] {
  return [
    ...checkNoHardcodedPx(css, options),
    ...checkNoHardcodedColor(css, options),
    ...checkNoNamedColor(css, options),
  ];
}

export function auditHtml(html: string, options?: GuardrailOptions): HtmlAuditResult {
  const violations: HtmlAuditViolation[] = [];
  const styleTags = extractStyleTagCss(html);
  const inlineStyles = extractInlineStyles(html);

  for (const block of styleTags) {
    const cssViolations = auditCssBlock(block.css, options);
    for (const msg of cssViolations) {
      const relLine = parseInt(msg.match(/Line (\d+)/)?.[1] || '0', 10);
      violations.push({
        source: 'style-tag',
        line: block.line + relLine - 1,
        message: msg,
      });
    }
  }

  for (const inline of inlineStyles) {
    const cssViolations = auditCssBlock(inline.css, options);
    for (const msg of cssViolations) {
      violations.push({
        source: 'inline-style',
        line: inline.line,
        element: inline.element,
        message: msg,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    styleTagCount: styleTags.length,
    inlineStyleCount: inlineStyles.length,
  };
}

export function fixHtml(html: string): string {
  let result = html;

  STYLE_TAG_RE.lastIndex = 0;
  result = result.replace(STYLE_TAG_RE, (full, css) => {
    const fixed = fixNamedColors(css);
    return full.replace(css, fixed);
  });

  INLINE_STYLE_RE.lastIndex = 0;
  result = result.replace(INLINE_STYLE_RE, (full, element, css) => {
    const fixed = fixNamedColors(css);
    return full.replace(`style="${css}"`, `style="${fixed}"`);
  });

  return result;
}

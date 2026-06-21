import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from './guardrails.js';
import { extractStyleTagCss, extractInlineStyles } from './audit-html.js';
import { createJsonOutput, type JsonOutput } from './json-output.js';

export interface Suggestion {
  line: number;
  column?: number;
  before: string;
  after: string;
  rule: string;
  message: string;
}

export interface SuggestFixResult {
  file: string;
  suggestions: Suggestion[];
  passed: boolean;
  summary: string;
}

const PX_TO_REM_BASE = 16;

const COLOR_TOKEN_MAP: Record<string, string> = {
  'red': 'var(--valentino-color-error)',
  'green': 'var(--valentino-color-success)',
  'blue': 'var(--valentino-color-primary)',
  'white': 'var(--valentino-color-surface)',
  'black': 'var(--valentino-color-text)',
  'gray': 'var(--valentino-color-muted)',
  'grey': 'var(--valentino-color-muted)',
  'orange': 'var(--valentino-color-warning)',
  'yellow': 'var(--valentino-color-warning)',
};

const SPACING_TOKEN_MAP: Record<number, string> = {
  0: '0',
  4: 'var(--valentino-space-xs)',
  8: 'var(--valentino-space-sm)',
  12: 'var(--valentino-space-md)',
  16: 'var(--valentino-space)',
  20: 'var(--valentino-space-lg)',
  24: 'var(--valentino-space-xl)',
  32: 'var(--valentino-space-2xl)',
  40: 'var(--valentino-space-3xl)',
  48: 'var(--valentino-space-4xl)',
  64: 'var(--valentino-space-5xl)',
};

function suggestPxToRem(value: string): string {
  const px = parseInt(value);
  if (isNaN(px)) return value;
  if (px === 0) return '0';
  const rem = px / PX_TO_REM_BASE;
  return `${rem}rem`;
}

function suggestPxToToken(value: string): string | undefined {
  const px = parseInt(value);
  if (isNaN(px)) return undefined;
  return SPACING_TOKEN_MAP[px];
}

function suggestColorToken(color: string): string | undefined {
  const lower = color.toLowerCase().trim();
  return COLOR_TOKEN_MAP[lower];
}

export function suggestFixes(content: string, filePath: string): SuggestFixResult {
  const lines = content.split('\n');
  const suggestions: Suggestion[] = [];
  const isHtml = filePath.toLowerCase().endsWith('.html') || filePath.toLowerCase().endsWith('.htm');

  if (isHtml) {
    const inlineStyles = extractInlineStyles(content);
    for (const inline of inlineStyles) {
      const cssText = inline.css;
      const parts = cssText.split(';').filter(Boolean);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const [prop, val] = trimmed.split(':').map(s => s.trim());
        if (!prop || !val) continue;

        suggestions.push({
          line: inline.line,
          before: `style="${cssText}"`,
          after: `class="/* extract: ${prop}: ${val} */"`,
          rule: 'inline-to-class',
          message: `Extract inline style to CSS class: ${prop}: ${val}`,
        });
        break;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const pxMatches = line.matchAll(/(?<!\w)(\d+)px/g);
    for (const match of pxMatches) {
      const px = parseInt(match[1]);
      if (px === 0) {
        suggestions.push({
          line: lineNum,
          column: match.index,
          before: '0px',
          after: '0',
          rule: '0px-to-zero',
          message: 'Replace 0px with 0 (no unit needed)',
        });
      } else {
        const token = suggestPxToToken(match[1]);
        const rem = suggestPxToRem(match[1]);
        suggestions.push({
          line: lineNum,
          column: match.index,
          before: `${px}px`,
          after: token || rem,
          rule: token ? 'px-to-token' : 'px-to-rem',
          message: token
            ? `Replace ${px}px with spacing token ${token}`
            : `Convert ${px}px to ${rem}`,
        });
      }
    }

    const hexMatches = line.matchAll(/#([0-9a-fA-F]{3,8})\b/g);
    for (const match of hexMatches) {
      if (/--[\w-]+\s*:\s*$/.test(line.substring(0, match.index))) continue;
      suggestions.push({
        line: lineNum,
        column: match.index,
        before: match[0],
        after: 'var(--valentino-color-*)',
        rule: 'color-to-token',
        message: `Replace hardcoded color ${match[0]} with a design token`,
      });
    }

    const namedColorRe = /\b(color|background|background-color|border-color|outline-color|fill|stroke)\s*:\s*([a-zA-Z]+)\s*[;}\n]/g;
    const namedMatches = line.matchAll(namedColorRe);
    for (const match of namedMatches) {
      const colorName = match[2].toLowerCase();
      const token = suggestColorToken(colorName);
      if (token) {
        suggestions.push({
          line: lineNum,
          column: match.index,
          before: colorName,
          after: token,
          rule: 'named-color-to-token',
          message: `Replace named color '${colorName}' with ${token}`,
        });
      }
    }
  }

  return {
    file: filePath,
    suggestions,
    passed: suggestions.length === 0,
    summary: suggestions.length === 0
      ? 'No suggestions — code follows design token conventions.'
      : `${suggestions.length} suggestion(s) found.`,
  };
}

export function formatPatch(result: SuggestFixResult): string {
  if (result.suggestions.length === 0) return '# No changes suggested\n';

  const lines: string[] = [];
  lines.push(`--- a/${result.file}`);
  lines.push(`+++ b/${result.file}`);

  const grouped = new Map<number, Suggestion[]>();
  for (const s of result.suggestions) {
    const arr = grouped.get(s.line) || [];
    arr.push(s);
    grouped.set(s.line, arr);
  }

  for (const [lineNum, items] of grouped) {
    lines.push(`@@ -${lineNum},1 +${lineNum},1 @@`);
    for (const item of items) {
      lines.push(`-  ${item.before}`);
      lines.push(`+  ${item.after}`);
    }
  }

  return lines.join('\n') + '\n';
}

export function formatTable(result: SuggestFixResult): string {
  if (result.suggestions.length === 0) return 'No suggestions.\n';

  const lines: string[] = [];
  lines.push('| Line | Rule | Before | After |');
  lines.push('|------|------|--------|-------|');
  for (const s of result.suggestions) {
    lines.push(`| ${s.line} | ${s.rule} | \`${s.before}\` | \`${s.after}\` |`);
  }
  lines.push('');
  lines.push(`${result.suggestions.length} suggestion(s) total.`);
  return lines.join('\n') + '\n';
}

export function suggestFixToJson(result: SuggestFixResult): JsonOutput {
  const byRule = new Map<string, Suggestion[]>();
  for (const s of result.suggestions) {
    const arr = byRule.get(s.rule) || [];
    arr.push(s);
    byRule.set(s.rule, arr);
  }

  const sections = Array.from(byRule.entries()).map(([rule, items]) => ({
    name: rule,
    status: items.length === 0 ? 'pass' as const : 'warn' as const,
    violations: items,
    warnings: [],
  }));

  return createJsonOutput({
    tool: 'suggest-fix',
    file: result.file,
    passed: result.passed,
    exitCode: result.passed ? 0 : 1,
    sections,
    summary: result.summary,
  });
}

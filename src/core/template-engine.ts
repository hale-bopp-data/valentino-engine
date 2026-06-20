export type TemplateEngine = 'jinja2' | 'twig' | 'ejs';

export interface TemplateWarning {
  engine: TemplateEngine;
  line: number;
  match: string;
  context: 'css-value' | 'css-selector' | 'html-attribute';
  detail: string;
  suggestion: string;
}

export interface TemplateAuditResult {
  engine: TemplateEngine;
  warnings: TemplateWarning[];
  templateExpressionCount: number;
}

const PATTERNS: Record<TemplateEngine, RegExp[]> = {
  jinja2: [
    /\{\{[^}]*\}\}/g,
    /\{%[^%]*%\}/g,
    /\{#[^#]*#\}/g,
  ],
  twig: [
    /\{\{[^}]*\}\}/g,
    /\{%[^%]*%\}/g,
    /\{#[^#]*#\}/g,
  ],
  ejs: [
    /<%[=-]?[^%]*%>/g,
  ],
};

const RAW_WRAPPERS: Record<TemplateEngine, { open: string; close: string }> = {
  jinja2: { open: '{% raw %}', close: '{% endraw %}' },
  twig: { open: '{% verbatim %}', close: '{% endverbatim %}' },
  ejs: { open: '<%# valentino-safe %>', close: '<%# /valentino-safe %>' },
};

const CSS_VALUE_CONTEXT_RE = /:\s*[^;{]*$/;
const CSS_SELECTOR_CONTEXT_RE = /^[^{:]*\{?\s*$/;

function lineAt(text: string, index: number): number {
  return text.substring(0, index).split('\n').length;
}

function classifyContext(line: string, matchIndex: number): TemplateWarning['context'] {
  const before = line.substring(0, matchIndex);
  if (/\bstyle\s*=\s*["'][^"']*$/.test(before)) return 'html-attribute';
  if (CSS_VALUE_CONTEXT_RE.test(before)) return 'css-value';
  return 'css-selector';
}

export function detectTemplateEngine(content: string): TemplateEngine | null {
  if (/<%[=-]?\s/.test(content)) return 'ejs';
  if (/\{%\s/.test(content) || /\{\{\s/.test(content)) {
    if (/\{%\s*verbatim\s*%\}/.test(content)) return 'twig';
    return 'jinja2';
  }
  return null;
}

export function findTemplateExpressions(
  content: string,
  engine: TemplateEngine,
): Array<{ match: string; index: number; line: number }> {
  const results: Array<{ match: string; index: number; line: number }> = [];
  for (const pattern of PATTERNS[engine]) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = re.exec(content)) !== null) {
      results.push({
        match: m[0],
        index: m.index,
        line: lineAt(content, m.index),
      });
    }
  }
  return results.sort((a, b) => a.index - b.index);
}

export function auditTemplateExpressions(
  content: string,
  engine: TemplateEngine,
): TemplateAuditResult {
  const expressions = findTemplateExpressions(content, engine);
  const warnings: TemplateWarning[] = [];
  const lines = content.split('\n');
  const wrapper = RAW_WRAPPERS[engine];

  for (const expr of expressions) {
    const lineContent = lines[expr.line - 1] || '';
    const lineStart = content.lastIndexOf('\n', expr.index - 1) + 1;
    const matchInLine = expr.index - lineStart;
    const ctx = classifyContext(lineContent, matchInLine);

    if (ctx === 'css-value' || ctx === 'html-attribute') {
      warnings.push({
        engine,
        line: expr.line,
        match: expr.match,
        context: ctx,
        detail: `Template expression in ${ctx}: ${expr.match} may be processed by ${engine} before CSS evaluation`,
        suggestion: `Wrap CSS block with ${wrapper.open} ... ${wrapper.close}`,
      });
    }
  }

  return {
    engine,
    warnings,
    templateExpressionCount: expressions.length,
  };
}

export function stripTemplateExpressions(
  content: string,
  engine: TemplateEngine,
): string {
  let result = content;
  for (const pattern of PATTERNS[engine]) {
    const re = new RegExp(pattern.source, pattern.flags);
    result = result.replace(re, match => {
      return '_'.repeat(match.length);
    });
  }
  return result;
}

export function formatTemplateAudit(result: TemplateAuditResult, filePath: string): string {
  const lines: string[] = [];
  lines.push(`Template audit: ${filePath} (${result.engine})`);
  lines.push(`  Expressions found: ${result.templateExpressionCount}`);
  lines.push(`  Warnings: ${result.warnings.length}`);

  if (result.warnings.length === 0) {
    lines.push('');
    lines.push('No template/CSS conflicts detected.');
    return lines.join('\n');
  }

  lines.push('');
  const wrapper = RAW_WRAPPERS[result.engine];
  for (const w of result.warnings) {
    lines.push(`  line ${w.line}: [${w.context}] ${w.match}`);
    lines.push(`    ${w.detail}`);
  }

  lines.push('');
  lines.push(`Suggestion: wrap CSS blocks with ${wrapper.open} ... ${wrapper.close}`);

  return lines.join('\n');
}

export const SUPPORTED_ENGINES: TemplateEngine[] = ['jinja2', 'twig', 'ejs'];

import { describe, it, expect } from 'vitest';
import {
  detectTemplateEngine, findTemplateExpressions,
  auditTemplateExpressions, stripTemplateExpressions,
  formatTemplateAudit, SUPPORTED_ENGINES,
} from './template-engine.js';

describe('detectTemplateEngine', () => {
  it('detects jinja2 expressions', () => {
    expect(detectTemplateEngine('color: {{ theme.primary }};')).toBe('jinja2');
  });

  it('detects jinja2 blocks', () => {
    expect(detectTemplateEngine('{% if dark_mode %}')).toBe('jinja2');
  });

  it('detects twig via verbatim', () => {
    expect(detectTemplateEngine('{% verbatim %}{{ x }}{% endverbatim %}')).toBe('twig');
  });

  it('detects ejs', () => {
    expect(detectTemplateEngine('<%= theme.color %>')).toBe('ejs');
  });

  it('returns null for plain CSS', () => {
    expect(detectTemplateEngine('body { color: red; }')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectTemplateEngine('')).toBeNull();
  });
});

describe('findTemplateExpressions', () => {
  it('finds jinja2 variable expressions', () => {
    const result = findTemplateExpressions('--c: {{ primary }};', 'jinja2');
    expect(result).toHaveLength(1);
    expect(result[0].match).toBe('{{ primary }}');
    expect(result[0].line).toBe(1);
  });

  it('finds multiple expressions', () => {
    const content = '{{ a }}\n{% if x %}{{ b }}{% endif %}';
    const result = findTemplateExpressions(content, 'jinja2');
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('finds ejs expressions', () => {
    const result = findTemplateExpressions('color: <%= c %>;', 'ejs');
    expect(result).toHaveLength(1);
    expect(result[0].match).toBe('<%= c %>');
  });

  it('returns empty for no matches', () => {
    expect(findTemplateExpressions('body { color: red; }', 'jinja2')).toHaveLength(0);
  });
});

describe('auditTemplateExpressions', () => {
  it('warns on template expression in CSS value', () => {
    const result = auditTemplateExpressions('  --primary: {{ color }};', 'jinja2');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].context).toBe('css-value');
    expect(result.warnings[0].match).toBe('{{ color }}');
  });

  it('warns on template in inline style', () => {
    const result = auditTemplateExpressions('<div style="color: {{ c }}">', 'jinja2');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].context).toBe('html-attribute');
  });

  it('does not warn on template in selector context', () => {
    const result = auditTemplateExpressions('{% if dark %}\n.dark { }\n{% endif %}', 'jinja2');
    const cssValueWarnings = result.warnings.filter(w => w.context === 'css-value');
    expect(cssValueWarnings).toHaveLength(0);
  });

  it('counts all expressions', () => {
    const content = '{{ a }} {% if x %} {{ b }} {% endif %}';
    const result = auditTemplateExpressions(content, 'jinja2');
    expect(result.templateExpressionCount).toBe(4);
  });

  it('includes suggestion with raw wrapper', () => {
    const result = auditTemplateExpressions('  color: {{ c }};', 'jinja2');
    expect(result.warnings[0].suggestion).toContain('{% raw %}');
  });

  it('uses verbatim for twig', () => {
    const result = auditTemplateExpressions('  color: {{ c }};', 'twig');
    expect(result.warnings[0].suggestion).toContain('{% verbatim %}');
  });
});

describe('stripTemplateExpressions', () => {
  it('replaces jinja2 expressions with underscores', () => {
    const result = stripTemplateExpressions('color: {{ primary }};', 'jinja2');
    expect(result).not.toContain('{{');
    expect(result).toContain('color:');
    expect(result.length).toBe('color: {{ primary }};'.length);
  });

  it('replaces ejs expressions', () => {
    const result = stripTemplateExpressions('color: <%= c %>;', 'ejs');
    expect(result).not.toContain('<%');
    expect(result.length).toBe('color: <%= c %>;'.length);
  });

  it('preserves line structure', () => {
    const input = 'a: {{ x }};\nb: {{ y }};';
    const result = stripTemplateExpressions(input, 'jinja2');
    expect(result.split('\n').length).toBe(2);
  });
});

describe('formatTemplateAudit', () => {
  it('formats clean result', () => {
    const result = auditTemplateExpressions('.btn { display: flex; }', 'jinja2');
    const output = formatTemplateAudit(result, 'style.css');
    expect(output).toContain('No template/CSS conflicts');
  });

  it('formats result with warnings', () => {
    const result = auditTemplateExpressions('  --c: {{ x }};', 'jinja2');
    const output = formatTemplateAudit(result, 'style.css');
    expect(output).toContain('css-value');
    expect(output).toContain('{% raw %}');
  });

  it('shows engine name', () => {
    const result = auditTemplateExpressions('', 'ejs');
    const output = formatTemplateAudit(result, 'file.html');
    expect(output).toContain('ejs');
  });
});

describe('SUPPORTED_ENGINES', () => {
  it('includes all three engines', () => {
    expect(SUPPORTED_ENGINES).toContain('jinja2');
    expect(SUPPORTED_ENGINES).toContain('twig');
    expect(SUPPORTED_ENGINES).toContain('ejs');
    expect(SUPPORTED_ENGINES).toHaveLength(3);
  });
});

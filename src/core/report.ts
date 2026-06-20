import { readFileSync } from 'fs';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from './guardrails.js';
import type { GuardrailOptions } from './guardrails.js';
import { auditHtml } from './audit-html.js';
import { validateTokens } from './validate-tokens.js';
import { certifySecurity, certifySecurityCss } from './certify-security.js';
import type { SecurityCertification } from './certify-security.js';
import type { ValidateTokensResult } from './validate-tokens.js';
import type { HtmlAuditResult } from './audit-html.js';

export interface ReportSection {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  violations: number;
  warnings: number;
  details: string[];
}

export interface UnifiedReport {
  file: string;
  fileType: 'css' | 'html';
  sections: ReportSection[];
  totalViolations: number;
  totalWarnings: number;
  passed: boolean;
}

export interface ReportOptions {
  allowTokenDefinitions?: boolean;
}

function detectType(filePath: string): 'css' | 'html' {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'css';
}

function auditCssSection(css: string, guardrailOpts?: GuardrailOptions): ReportSection {
  const px = checkNoHardcodedPx(css, guardrailOpts);
  const color = checkNoHardcodedColor(css, guardrailOpts);
  const named = checkNoNamedColor(css, guardrailOpts);
  const all = [...px, ...color, ...named];
  return {
    name: 'CSS Guardrails',
    status: all.length === 0 ? 'pass' : 'fail',
    violations: all.length,
    warnings: 0,
    details: all,
  };
}

function auditHtmlSection(html: string, options?: GuardrailOptions): ReportSection {
  const result: HtmlAuditResult = auditHtml(html, options);
  return {
    name: 'HTML Audit',
    status: result.valid ? 'pass' : 'fail',
    violations: result.violations.length,
    warnings: 0,
    details: result.violations.map(v => {
      const src = v.source === 'inline-style' ? `<${v.element}> inline` : '<style>';
      return `[${src}, line ${v.line}] ${v.message}`;
    }),
  };
}

function tokenSection(css: string): ReportSection {
  const result: ValidateTokensResult = validateTokens(css);
  return {
    name: 'Token Validation',
    status: result.valid ? 'pass' : 'fail',
    violations: result.violations.length,
    warnings: 0,
    details: result.violations.map(v => `[${v.type}] ${v.token}: ${v.detail}`),
  };
}

function securitySection(content: string, fileType: 'css' | 'html'): ReportSection {
  const cert: SecurityCertification = fileType === 'html'
    ? certifySecurity(content)
    : certifySecurityCss(content);
  const critical = cert.violations.filter(v => v.severity === 'critical');
  const warnings = cert.violations.filter(v => v.severity === 'warning');
  return {
    name: 'Security Certification',
    status: cert.certified ? (warnings.length > 0 ? 'warn' : 'pass') : 'fail',
    violations: critical.length,
    warnings: warnings.length,
    details: cert.violations.map(v => `[${v.severity}] line ${v.line}: ${v.detail}`),
  };
}

function extractCss(html: string): string {
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const blocks: string[] = [];
  let m;
  styleRe.lastIndex = 0;
  while ((m = styleRe.exec(html)) !== null) blocks.push(m[1]);
  return blocks.join('\n');
}

export function generateReport(filePath: string, options?: ReportOptions): UnifiedReport {
  const content = readFileSync(filePath, 'utf-8');
  const fileType = detectType(filePath);
  const sections: ReportSection[] = [];
  const guardrailOpts: GuardrailOptions | undefined = options?.allowTokenDefinitions
    ? { allowTokenDefinitions: true }
    : undefined;

  if (fileType === 'html') {
    sections.push(auditHtmlSection(content, guardrailOpts));
    const css = extractCss(content);
    if (css.trim()) {
      sections.push(auditCssSection(css, guardrailOpts));
      sections.push(tokenSection(css));
    }
    sections.push(securitySection(content, 'html'));
  } else {
    sections.push(auditCssSection(content, guardrailOpts));
    sections.push(tokenSection(content));
    sections.push(securitySection(content, 'css'));
  }

  const totalViolations = sections.reduce((s, sec) => s + sec.violations, 0);
  const totalWarnings = sections.reduce((s, sec) => s + sec.warnings, 0);

  return {
    file: filePath,
    fileType,
    sections,
    totalViolations,
    totalWarnings,
    passed: totalViolations === 0,
  };
}

export function formatReport(report: UnifiedReport): string {
  const lines: string[] = [];
  const icon = (s: ReportSection['status']) =>
    s === 'pass' ? 'PASS' : s === 'warn' ? 'WARN' : s === 'fail' ? 'FAIL' : 'SKIP';

  lines.push(`Unified Report: ${report.file} (${report.fileType})`);
  lines.push('='.repeat(60));

  for (const sec of report.sections) {
    lines.push(`\n[${icon(sec.status)}] ${sec.name} — ${sec.violations} violation(s), ${sec.warnings} warning(s)`);
    if (sec.details.length > 0) {
      for (const d of sec.details.slice(0, 20)) {
        lines.push(`  ${d}`);
      }
      if (sec.details.length > 20) {
        lines.push(`  ... and ${sec.details.length - 20} more`);
      }
    }
  }

  lines.push('\n' + '='.repeat(60));
  lines.push(`Total: ${report.totalViolations} violation(s), ${report.totalWarnings} warning(s)`);
  lines.push(report.passed ? 'RESULT: PASS' : 'RESULT: FAIL');

  return lines.join('\n');
}

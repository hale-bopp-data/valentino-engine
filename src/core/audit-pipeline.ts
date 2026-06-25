/**
 * Unified Audit Pipeline (SSoT) — Bug #3149.
 *
 * Single source of truth for file audits. Consumed by `report.ts`,
 * `watch.ts`, the CLI and the MCP server so that the SAME input always
 * yields the SAME findings and counts (no report/watch drift).
 *
 * Substrate for PRD-20260308 (valentino-audit-pipeline-v1):
 * FR-002 "output contract unico" and NFR-003 "stessa pipeline senza fork logici".
 */

import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from './guardrails.js';
import type { GuardrailOptions } from './guardrails.js';
import { auditHtml } from './audit-html.js';
import type { HtmlAuditResult } from './audit-html.js';
import { validateTokens } from './validate-tokens.js';
import type { ValidateTokensResult } from './validate-tokens.js';
import { certifySecurity, certifySecurityCss } from './certify-security.js';
import type { SecurityCertification } from './certify-security.js';

export type AuditFileType = 'css' | 'html';

export interface AuditSection {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  violations: number;
  warnings: number;
  details: string[];
}

export interface AuditResult {
  fileType: AuditFileType;
  sections: AuditSection[];
  totalViolations: number;
  totalWarnings: number;
  passed: boolean;
}

export interface AuditOptions {
  allowTokenDefinitions?: boolean;
  allowedTokenPrefixes?: string[];
}

export function detectFileType(filePath: string): AuditFileType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'css';
}

export function extractStyleCss(html: string): string {
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const blocks: string[] = [];
  let m;
  styleRe.lastIndex = 0;
  while ((m = styleRe.exec(html)) !== null) blocks.push(m[1]);
  return blocks.join('\n');
}

function toGuardrailOpts(options?: AuditOptions): GuardrailOptions | undefined {
  return options?.allowTokenDefinitions
    ? { allowTokenDefinitions: true, allowedTokenPrefixes: options.allowedTokenPrefixes }
    : undefined;
}

function cssGuardrailSection(css: string, guardrailOpts?: GuardrailOptions): AuditSection {
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

function htmlAuditSection(html: string, guardrailOpts?: GuardrailOptions): AuditSection {
  const result: HtmlAuditResult = auditHtml(html, guardrailOpts);
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

function tokenSection(css: string): AuditSection {
  const result: ValidateTokensResult = validateTokens(css);
  return {
    name: 'Token Validation',
    status: result.valid ? 'pass' : 'fail',
    violations: result.violations.length,
    warnings: 0,
    details: result.violations.map(v => `[${v.type}] ${v.token}: ${v.detail}`),
  };
}

function securitySection(content: string, fileType: AuditFileType): AuditSection {
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

/**
 * Run the full audit pipeline on raw content.
 *
 * HTML: HTML Audit + (CSS Guardrails + Token Validation over extracted
 * `<style>` CSS) + Security Certification.
 * CSS: CSS Guardrails + Token Validation + Security Certification.
 *
 * Security severities are split consistently: `critical` -> violations,
 * `warning` -> warnings (no matter the file type).
 */
export function runAudit(content: string, fileType: AuditFileType, options?: AuditOptions): AuditResult {
  const sections: AuditSection[] = [];
  const guardrailOpts = toGuardrailOpts(options);

  if (fileType === 'html') {
    sections.push(htmlAuditSection(content, guardrailOpts));
    const css = extractStyleCss(content);
    if (css.trim()) {
      sections.push(cssGuardrailSection(css, guardrailOpts));
      sections.push(tokenSection(css));
    }
    sections.push(securitySection(content, 'html'));
  } else {
    sections.push(cssGuardrailSection(content, guardrailOpts));
    sections.push(tokenSection(content));
    sections.push(securitySection(content, 'css'));
  }

  const totalViolations = sections.reduce((s, sec) => s + sec.violations, 0);
  const totalWarnings = sections.reduce((s, sec) => s + sec.warnings, 0);

  return {
    fileType,
    sections,
    totalViolations,
    totalWarnings,
    passed: totalViolations === 0,
  };
}

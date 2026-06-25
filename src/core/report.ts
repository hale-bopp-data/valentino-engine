import { readFileSync } from 'fs';
import { runAudit, detectFileType } from './audit-pipeline.js';
import type { AuditSection, AuditOptions } from './audit-pipeline.js';

export type ReportSection = AuditSection;

export interface UnifiedReport {
  file: string;
  fileType: 'css' | 'html';
  sections: ReportSection[];
  totalViolations: number;
  totalWarnings: number;
  passed: boolean;
}

export type ReportOptions = AuditOptions;

export function generateReport(filePath: string, options?: ReportOptions): UnifiedReport {
  const content = readFileSync(filePath, 'utf-8');
  const fileType = detectFileType(filePath);
  const result = runAudit(content, fileType, options);
  return {
    file: filePath,
    fileType: result.fileType,
    sections: result.sections,
    totalViolations: result.totalViolations,
    totalWarnings: result.totalWarnings,
    passed: result.passed,
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

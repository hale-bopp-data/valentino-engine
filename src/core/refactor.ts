import { fixNamedColors } from './guardrails.js';
import { fixHtml } from './audit-html.js';
import { parseTokenDeclarations, extractVarReferences, validateTokens } from './validate-tokens.js';
import { computeDiff, formatDiff } from './backup.js';
import type { DiffHunk } from './backup.js';

export interface SelfRefWarning {
  token: string;
  line: number;
  detail: string;
}

export interface RefactorProposal {
  original: string;
  proposed: string;
  fileType: 'css' | 'html';
  fixCount: number;
  newTokenCount: number;
  selfRefWarnings: SelfRefWarning[];
  hunks: DiffHunk[];
  safe: boolean;
}

export function detectFileType(filePath: string): 'css' | 'html' {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'css';
}

export function applyFixes(content: string, fileType: 'css' | 'html'): string {
  if (fileType === 'html') return fixHtml(content);
  return fixNamedColors(content);
}

export function detectNewSelfReferences(original: string, proposed: string): SelfRefWarning[] {
  const origTokens = parseTokenDeclarations(original);
  const propTokens = parseTokenDeclarations(proposed);
  const warnings: SelfRefWarning[] = [];

  const origSelfRefs = new Set<string>();
  for (const [name, value] of origTokens) {
    const refs = extractVarReferences(value);
    if (refs.includes(name)) origSelfRefs.add(name);
  }

  const propLines = proposed.split('\n');
  for (const [name, value] of propTokens) {
    const refs = extractVarReferences(value);
    if (refs.includes(name) && !origSelfRefs.has(name)) {
      const line = propLines.findIndex(l => l.includes(name) && l.includes(value)) + 1;
      warnings.push({
        token: name,
        line,
        detail: `Fix would create self-reference: ${name}: ${value}`,
      });
    }
  }

  return warnings;
}

export function countNewTokenReferences(original: string, proposed: string): number {
  const origRefs = new Set<string>();
  const origLines = original.split('\n');
  const varRe = /var\(\s*(--[\w-]+)\s*\)/g;

  for (const line of origLines) {
    varRe.lastIndex = 0;
    let m;
    while ((m = varRe.exec(line)) !== null) origRefs.add(`${line}:${m[1]}`);
  }

  let count = 0;
  const propLines = proposed.split('\n');
  for (const line of propLines) {
    varRe.lastIndex = 0;
    let m;
    while ((m = varRe.exec(line)) !== null) {
      if (!origRefs.has(`${line}:${m[1]}`)) count++;
    }
  }

  return count;
}

export function previewRefactor(content: string, filePath: string): RefactorProposal {
  const fileType = detectFileType(filePath);
  const proposed = applyFixes(content, fileType);
  const hunks = computeDiff(content, proposed);

  const fixCount = hunks.reduce(
    (sum, h) => sum + h.lines.filter(l => l.type === 'removed').length,
    0,
  );

  const cssContent = fileType === 'html' ? extractCssFromHtml(proposed) : proposed;
  const origCss = fileType === 'html' ? extractCssFromHtml(content) : content;

  const selfRefWarnings = detectNewSelfReferences(origCss, cssContent);
  const newTokenCount = countNewTokenReferences(origCss, cssContent);

  return {
    original: content,
    proposed,
    fileType,
    fixCount,
    newTokenCount,
    selfRefWarnings,
    hunks,
    safe: selfRefWarnings.length === 0,
  };
}

function extractCssFromHtml(html: string): string {
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const blocks: string[] = [];
  let m;
  styleRe.lastIndex = 0;
  while ((m = styleRe.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

export function formatProposal(proposal: RefactorProposal, filePath: string): string {
  const lines: string[] = [];

  if (proposal.hunks.length === 0) {
    lines.push('No refactoring needed — file is clean.');
    return lines.join('\n');
  }

  lines.push(`Refactor preview for ${filePath} (${proposal.fileType})`);
  lines.push(`  Lines changed: ${proposal.fixCount}`);
  lines.push(`  New token refs: ${proposal.newTokenCount}`);
  lines.push('');

  if (proposal.selfRefWarnings.length > 0) {
    lines.push(`WARNING: ${proposal.selfRefWarnings.length} self-referential token(s) would be created:`);
    for (const w of proposal.selfRefWarnings) {
      lines.push(`  line ${w.line}: ${w.detail}`);
    }
    lines.push('');
  }

  lines.push(formatDiff(proposal.hunks, filePath));

  return lines.join('\n');
}

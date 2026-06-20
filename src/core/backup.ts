import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';

export interface BackupResult {
  backupPath: string;
  originalContent: string;
}

export interface DiffLine {
  type: 'context' | 'removed' | 'added';
  lineNumber: number;
  content: string;
}

export interface DiffHunk {
  startLine: number;
  lines: DiffLine[];
}

export function createBackup(filePath: string): BackupResult {
  const backupPath = `${filePath}.valentino-backup`;
  const originalContent = readFileSync(filePath, 'utf-8');
  copyFileSync(filePath, backupPath);
  return { backupPath, originalContent };
}

export function restoreBackup(filePath: string): boolean {
  const backupPath = `${filePath}.valentino-backup`;
  if (!existsSync(backupPath)) return false;
  copyFileSync(backupPath, filePath);
  return true;
}

export function backupExists(filePath: string): boolean {
  return existsSync(`${filePath}.valentino-backup`);
}

export function computeDiff(original: string, modified: string, contextLines = 3): DiffHunk[] {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const maxLen = Math.max(origLines.length, modLines.length);

  const changed: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    if (origLines[i] !== modLines[i]) changed.push(i);
  }

  if (changed.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let hunkStart = -1;
  let hunkEnd = -1;

  for (const idx of changed) {
    const rangeStart = Math.max(0, idx - contextLines);
    const rangeEnd = Math.min(maxLen - 1, idx + contextLines);

    if (hunkStart === -1) {
      hunkStart = rangeStart;
      hunkEnd = rangeEnd;
    } else if (rangeStart <= hunkEnd + 1) {
      hunkEnd = rangeEnd;
    } else {
      hunks.push(buildHunk(origLines, modLines, hunkStart, hunkEnd));
      hunkStart = rangeStart;
      hunkEnd = rangeEnd;
    }
  }

  if (hunkStart !== -1) {
    hunks.push(buildHunk(origLines, modLines, hunkStart, hunkEnd));
  }

  return hunks;
}

function buildHunk(origLines: string[], modLines: string[], start: number, end: number): DiffHunk {
  const lines: DiffLine[] = [];

  for (let i = start; i <= end; i++) {
    const orig = origLines[i];
    const mod = modLines[i];

    if (orig === mod) {
      if (orig !== undefined) {
        lines.push({ type: 'context', lineNumber: i + 1, content: orig });
      }
    } else {
      if (orig !== undefined) {
        lines.push({ type: 'removed', lineNumber: i + 1, content: orig });
      }
      if (mod !== undefined) {
        lines.push({ type: 'added', lineNumber: i + 1, content: mod });
      }
    }
  }

  return { startLine: start + 1, lines };
}

export function formatDiff(hunks: DiffHunk[], filePath: string): string {
  if (hunks.length === 0) return `No changes made to ${filePath}`;

  const out: string[] = [
    `--- ${filePath}.valentino-backup`,
    `+++ ${filePath}`,
  ];

  for (const hunk of hunks) {
    out.push(`@@ line ${hunk.startLine} @@`);
    for (const line of hunk.lines) {
      const prefix = line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' ';
      out.push(`${prefix} ${line.content}`);
    }
  }

  return out.join('\n');
}

export function writeFixed(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8');
}

export function parseFixArgs(args: string[]): { fix: boolean; noBackup: boolean; file: string | undefined } {
  let fix = false;
  let noBackup = false;
  let file: string | undefined;

  for (const arg of args) {
    if (arg === '--fix') fix = true;
    else if (arg === '--no-backup') noBackup = true;
    else if (!arg.startsWith('-')) file = file ?? arg;
  }

  return { fix, noBackup, file };
}

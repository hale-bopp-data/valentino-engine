import { watch as fsWatch, readFileSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { runAudit, detectFileType } from './audit-pipeline.js';

export interface WatchEvent {
  file: string;
  timestamp: string;
  violations: number;
  warnings: number;
  details: string[];
}

export interface WatchOptions {
  debounceMs?: number;
  onEvent?: (event: WatchEvent) => void;
}

function auditFile(filePath: string): WatchEvent {
  const content = readFileSync(filePath, 'utf-8');
  const fileType = detectFileType(filePath);
  const result = runAudit(content, fileType);

  return {
    file: filePath,
    timestamp: new Date().toISOString(),
    violations: result.totalViolations,
    warnings: result.totalWarnings,
    details: result.sections.flatMap(s => s.details),
  };
}

export function formatWatchEvent(event: WatchEvent): string {
  const lines: string[] = [];
  const status = event.violations === 0 ? 'CLEAN' : 'DIRTY';
  lines.push(`[${event.timestamp}] ${status} ${event.file} — ${event.violations} violation(s), ${event.warnings} warning(s)`);
  if (event.details.length > 0) {
    for (const d of event.details.slice(0, 10)) {
      lines.push(`  ${d}`);
    }
    if (event.details.length > 10) {
      lines.push(`  ... and ${event.details.length - 10} more`);
    }
  }
  return lines.join('\n');
}

export function watchFile(
  filePath: string,
  options: WatchOptions = {},
): { close: () => void } {
  const resolved = resolve(filePath);
  const debounceMs = options.debounceMs ?? 300;
  const onEvent = options.onEvent ?? ((e: WatchEvent) => {
    console.log(formatWatchEvent(e));
  });

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const stat = statSync(resolved);
  const target = stat.isDirectory() ? resolved : resolve(resolved, '..');
  const filterFile = stat.isDirectory() ? undefined : resolved;

  const watcher = fsWatch(target, { recursive: stat.isDirectory() }, (_eventType, filename) => {
    if (!filename) return;
    const fullPath = stat.isDirectory() ? resolve(target, filename) : resolved;

    if (filterFile && fullPath !== filterFile) return;

    const ext = extname(fullPath).toLowerCase();
    if (ext !== '.css' && ext !== '.html' && ext !== '.htm') return;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      try {
        const event = auditFile(fullPath);
        onEvent(event);
      } catch {
        // file may have been deleted during watch
      }
    }, debounceMs);
  });

  return {
    close: () => {
      if (timeout) clearTimeout(timeout);
      watcher.close();
    },
  };
}

export { auditFile as auditFileForWatch };

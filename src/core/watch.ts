import { watch as fsWatch, readFileSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from './guardrails.js';
import { auditHtml } from './audit-html.js';
import { validateTokens } from './validate-tokens.js';
import { certifySecurity, certifySecurityCss } from './certify-security.js';

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

function detectType(filePath: string): 'css' | 'html' {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'html';
  return 'css';
}

function extractCss(html: string): string {
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const blocks: string[] = [];
  let m;
  styleRe.lastIndex = 0;
  while ((m = styleRe.exec(html)) !== null) blocks.push(m[1]);
  return blocks.join('\n');
}

function auditFile(filePath: string): WatchEvent {
  const content = readFileSync(filePath, 'utf-8');
  const fileType = detectType(filePath);
  const details: string[] = [];
  let violations = 0;
  let warnings = 0;

  if (fileType === 'html') {
    const htmlResult = auditHtml(content);
    violations += htmlResult.violations.length;
    for (const v of htmlResult.violations) {
      details.push(`[html] line ${v.line}: ${v.message}`);
    }

    const css = extractCss(content);
    if (css.trim()) {
      const tokenResult = validateTokens(css);
      violations += tokenResult.violations.length;
      for (const v of tokenResult.violations) {
        details.push(`[token] ${v.token}: ${v.detail}`);
      }
    }

    const cert = certifySecurity(content);
    const critical = cert.violations.filter(v => v.severity === 'critical');
    const warns = cert.violations.filter(v => v.severity === 'warning');
    violations += critical.length;
    warnings += warns.length;
    for (const v of critical) details.push(`[security] ${v.detail}`);
    for (const v of warns) details.push(`[security-warn] ${v.detail}`);
  } else {
    const px = checkNoHardcodedPx(content);
    const color = checkNoHardcodedColor(content);
    const named = checkNoNamedColor(content);
    violations += px.length + color.length + named.length;
    details.push(...px, ...color, ...named);

    const tokenResult = validateTokens(content);
    violations += tokenResult.violations.length;
    for (const v of tokenResult.violations) {
      details.push(`[token] ${v.token}: ${v.detail}`);
    }

    const cert = certifySecurityCss(content);
    warnings += cert.violations.length;
    for (const v of cert.violations) {
      details.push(`[security-warn] ${v.detail}`);
    }
  }

  return {
    file: filePath,
    timestamp: new Date().toISOString(),
    violations,
    warnings,
    details,
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

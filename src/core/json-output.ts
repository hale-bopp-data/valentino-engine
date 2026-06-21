import { readFileSync } from 'fs';
import { resolve } from 'path';

// v2 (#3081): added optional `screenshot` field (path to the captured PNG
// artifact, or null when unavailable). Additive/backward-compatible.
export const SCHEMA_VERSION = 2;

export interface JsonSection {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  violations: unknown[];
  warnings: unknown[];
}

export interface JsonOutput {
  tool: string;
  version: string;
  schemaVersion: number;
  timestamp: string;
  file?: string;
  passed: boolean;
  exitCode: number;
  sections: JsonSection[];
  summary: string;
  /** Path to the captured screenshot artifact, or null when unavailable (#3081). */
  screenshot?: string | null;
}

let cachedVersion: string | undefined;

function getVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
    cachedVersion = pkg.version ?? 'unknown';
  } catch {
    cachedVersion = 'unknown';
  }
  return cachedVersion!;
}

export function createJsonOutput(opts: {
  tool: string;
  file?: string;
  passed: boolean;
  exitCode: number;
  sections: JsonSection[];
  summary: string;
  screenshot?: string | null;
}): JsonOutput {
  return {
    tool: opts.tool,
    version: getVersion(),
    schemaVersion: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    file: opts.file,
    passed: opts.passed,
    exitCode: opts.exitCode,
    sections: opts.sections,
    summary: opts.summary,
    screenshot: opts.screenshot,
  };
}

export function printJson(output: JsonOutput): void {
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

/**
 * Tests for scripts/postinstall.mjs — MCP registration safety (#3074).
 *
 * A postinstall MUST NOT mutate the consumer's .mcp.json (its MCP SSoT) outside
 * this package's own directory without explicit opt-in. These tests spawn the
 * real script in an isolated temp dir and assert the no-side-effect default.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'postinstall.mjs');

function runPostinstall(cwd: string, env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, [scriptPath], {
    env: { ...process.env, INIT_CWD: cwd, ...env },
    encoding: 'utf-8',
  });
}

describe('postinstall MCP registration safety (#3074)', () => {
  let dir: string;
  let mcpPath: string;
  const original =
    JSON.stringify({ mcpServers: { existing: { command: 'x' } }, custom: true }, null, 2) + '\n';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'valentino-postinstall-'));
    mcpPath = join(dir, '.mcp.json');
    writeFileSync(mcpPath, original, 'utf-8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('does NOT modify the consumer .mcp.json by default (no opt-in)', () => {
    const out = runPostinstall(dir);
    expect(readFileSync(mcpPath, 'utf-8')).toBe(original);
    expect(out).toContain('auto-registration is OFF');
  });

  it('does NOT create a .mcp.json when none exists and not opted in', () => {
    rmSync(mcpPath, { force: true });
    runPostinstall(dir);
    expect(existsSync(mcpPath)).toBe(false);
  });

  it('registers the entry only when VALENTINO_MCP_AUTOREGISTER=1, preserving other keys', () => {
    runPostinstall(dir, { VALENTINO_MCP_AUTOREGISTER: '1' });
    const cfg = JSON.parse(readFileSync(mcpPath, 'utf-8'));
    expect(cfg.mcpServers['valentino-engine']).toBeDefined();
    expect(cfg.mcpServers.existing).toBeDefined();
    expect(cfg.custom).toBe(true);
  });

  it('is idempotent when already registered (opt-in)', () => {
    runPostinstall(dir, { VALENTINO_MCP_AUTOREGISTER: '1' });
    const out = runPostinstall(dir, { VALENTINO_MCP_AUTOREGISTER: '1' });
    expect(out).toContain('already registered');
  });
});

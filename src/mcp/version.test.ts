import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VALENTINO_MCP_VERSION } from './version.js';

describe('MCP server version', () => {
  const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

  it('matches package.json version (no drift)', () => {
    expect(VALENTINO_MCP_VERSION).toBe(pkg.version);
  });

  it('is a valid semver', () => {
    expect(VALENTINO_MCP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

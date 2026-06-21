import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const FALLBACK_VERSION = '0.0.0-dev';

function resolveVersion(): string {
  try {
    const here = fileURLToPath(import.meta.url);
    const pkgPath = resolve(dirname(here), '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return typeof pkg.version === 'string' && pkg.version.length > 0
      ? pkg.version
      : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

export const VALENTINO_MCP_VERSION = resolveVersion();

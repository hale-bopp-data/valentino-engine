import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface ValentinoTokenConfig {
  allowedTokenPrefixes?: string[];
  tokenDefinitionSelectors?: string[];
}

const CONFIG_FILENAMES = ['.valentino.json', 'valentino.config.json'];
const MAX_WALK_DEPTH = 10;

export function findConfigFile(startDir: string): string | undefined {
  let dir = resolve(startDir);
  for (let i = 0; i < MAX_WALK_DEPTH; i++) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function loadTokenConfig(startDir: string): ValentinoTokenConfig | undefined {
  const configPath = findConfigFile(startDir);
  if (!configPath) return undefined;
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const json = JSON.parse(raw);
    const result: ValentinoTokenConfig = {};
    if (Array.isArray(json.allowedTokenPrefixes)) {
      result.allowedTokenPrefixes = json.allowedTokenPrefixes.filter(
        (p: unknown) => typeof p === 'string'
      );
    }
    if (Array.isArray(json.tokenDefinitionSelectors)) {
      result.tokenDefinitionSelectors = json.tokenDefinitionSelectors.filter(
        (s: unknown) => typeof s === 'string'
      );
    }
    return result;
  } catch {
    return undefined;
  }
}

export function resolveGuardrailOptions(
  cliAllowTokenDefs: boolean,
  configDir: string,
): { allowTokenDefinitions: boolean; allowedTokenPrefixes?: string[] } | undefined {
  if (!cliAllowTokenDefs) return undefined;
  const config = loadTokenConfig(configDir);
  return {
    allowTokenDefinitions: true,
    allowedTokenPrefixes: config?.allowedTokenPrefixes,
  };
}

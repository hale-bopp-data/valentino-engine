#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENTRY_KEY = 'valentino-engine';
const MCP_CONFIG = {
  command: 'npx',
  args: ['@hale-bopp/valentino-engine', 'mcp'],
};

// Opt-in only (#3074): a postinstall MUST NOT mutate the consumer's .mcp.json
// (its MCP single-source-of-truth) outside this package's own directory without
// explicit consent. Silently rewriting/reformatting a consumer config is a
// surprising side effect (noisy diffs, G16/SSoT violations in other workspaces).
// Set VALENTINO_MCP_AUTOREGISTER=1 (or true/yes) to enable automatic registration.
const AUTOREGISTER = /^(1|true|yes)$/i.test(process.env.VALENTINO_MCP_AUTOREGISTER || '');

const projectRoot = process.env.INIT_CWD || process.cwd();
const mcpPath = join(projectRoot, '.mcp.json');

const manualSnippet = JSON.stringify({ mcpServers: { [ENTRY_KEY]: MCP_CONFIG } }, null, 2);

if (!AUTOREGISTER) {
  console.log('[valentino-engine] MCP auto-registration is OFF (default).');
  console.log('[valentino-engine] This postinstall will NOT modify your .mcp.json.');
  console.log(`[valentino-engine] To register manually, merge into ${mcpPath}:`);
  console.log(manualSnippet);
  console.log('[valentino-engine] Or set VALENTINO_MCP_AUTOREGISTER=1 before install to auto-register.');
  process.exit(0);
}

try {
  let config = {};
  let serversKey = 'mcpServers';

  if (existsSync(mcpPath)) {
    const raw = readFileSync(mcpPath, 'utf-8');
    config = JSON.parse(raw);

    if (config.mcp_servers && !config.mcpServers) {
      serversKey = 'mcp_servers';
    }
  }

  if (!config[serversKey]) {
    config[serversKey] = {};
  }

  if (config[serversKey][ENTRY_KEY]) {
    console.log('[valentino-engine] MCP server already registered in .mcp.json');
    process.exit(0);
  }

  config[serversKey][ENTRY_KEY] = MCP_CONFIG;
  writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`[valentino-engine] MCP server registered in ${mcpPath} (opt-in via VALENTINO_MCP_AUTOREGISTER).`);
  console.log('[valentino-engine] Restart your agent session to load the new tools.');
} catch (err) {
  console.log(`[valentino-engine] Could not auto-register MCP server: ${err.message}`);
  console.log('[valentino-engine] Add manually — see AGENTS.md for configuration.');
}

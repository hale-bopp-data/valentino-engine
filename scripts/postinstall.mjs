#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENTRY_KEY = 'valentino-engine';
const MCP_CONFIG = {
  command: 'npx',
  args: ['@hale-bopp/valentino-engine', 'mcp']
};

const projectRoot = process.env.INIT_CWD || process.cwd();
const mcpPath = join(projectRoot, '.mcp.json');

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
  console.log('[valentino-engine] MCP server registered in .mcp.json (13 tools available)');
  console.log('[valentino-engine] Restart your agent session to load the new tools.');
} catch (err) {
  console.log(`[valentino-engine] Could not auto-register MCP server: ${err.message}`);
  console.log('[valentino-engine] Add manually — see AGENTS.md for configuration.');
}

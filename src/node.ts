/**
 * Valentino Engine — Node Entry Point
 *
 * Re-exports everything from the browser entry plus Node-only modules
 * (cockpit-server, cockpit-repl, project-adapter).
 *
 * Usage: import { startCockpitServer, importFromProject } from '@hale-bopp/valentino-engine/node';
 */

// Everything from browser entry
export * from './browser.js';

// Node-only: URL Import (requires playwright)
export { importFromUrl } from './core/url-import.js';

// Node-only: REPL (requires readline)
export { processReplInput, createReplSession, startRepl } from './core/cockpit-repl.js';
export type { ReplOptions, ReplSession } from './core/cockpit-repl.js';

// Node-only: Project Adapter (requires fs, path)
export { importFromProject, scanProjectDirectory, analyzeHtmlStructure } from './core/project-adapter.js';
export type { ProjectScanResult, ProjectPageResult, ProjectAdapterResult, ProjectAdapterOptions } from './core/project-adapter.js';

// Node-only: Cockpit Server (requires http, fs, path)
export { startCockpitServer } from './cockpit-server.js';
export type { CockpitServerOptions } from './cockpit-server.js';

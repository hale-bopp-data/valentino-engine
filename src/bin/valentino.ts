#!/usr/bin/env node
/**
 * Valentino CLI — `npx @hale-bopp/valentino generate|audit|guardrails`
 *
 * VE-003: Full CLI implementation
 */

import { readFileSync } from 'fs';
import { checkNoHardcodedPx, checkNoHardcodedColor } from '../core/guardrails.js';
import { validatePageSpec } from '../core/page-spec.js';

const [,, command, ...args] = process.argv;

switch (command) {
  case 'audit': {
    const file = args[0];
    if (!file) {
      console.error('Usage: valentino audit <path-to-css-file>');
      process.exit(1);
    }
    const css = readFileSync(file, 'utf-8');
    const pxViolations = checkNoHardcodedPx(css);
    const colorViolations = checkNoHardcodedColor(css);
    const all = [...pxViolations, ...colorViolations];
    if (all.length === 0) {
      console.log('✅ No guardrail violations found.');
    } else {
      console.log(`❌ ${all.length} violation(s) found:\n`);
      all.forEach(v => console.log('  •', v));
      process.exit(1);
    }
    break;
  }

  case 'validate': {
    const file = args[0];
    if (!file) {
      console.error('Usage: valentino validate <path-to-pagespec.json>');
      process.exit(1);
    }
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    const valid = validatePageSpec(json);
    if (valid) {
      console.log('✅ PageSpec is valid.');
    } else {
      console.error('❌ PageSpec is missing required fields (id, version, components).');
      process.exit(1);
    }
    break;
  }

  case 'guardrails': {
    const guardrails = [
      '1. WhatIf di Layout — Wireframe first, code second',
      '2. Component Boundary & Fallbacks — Error Boundaries on all API bridges',
      '3. Design Token System — No hardcoded colors or px values',
      '4. L3 Audit before Commit — ARIA, performance, and dependency check',
      '5. Escalation to GEDI — Consult GEDI on architectural trade-offs',
      '6. Zero UI-Debt — Reuse before creating',
      '7. Electrical Socket Pattern — CSS root variables for all colors',
      '8. Testudo Formation — No inline padding/margin overrides on containers',
      '9. Tangible Legacy — No redundant CSS blocks',
      '10. Visual Live Audit — Use MCP browser_screenshot or npm run test:e2e:valentino',
    ];
    console.log('\n🛡️  Valentino Engine — 10 Sovereign Guardrails\n');
    guardrails.forEach(g => console.log(' ', g));
    console.log();
    break;
  }

  default:
    console.log(`
🎨 Valentino Engine v0.1.0 — Antifragile Open Source UI Design Engine

Usage:
  valentino audit <file.css>        Audit CSS for guardrail violations
  valentino validate <spec.json>    Validate a Runtime PageSpec JSON
  valentino guardrails              List all 10 Sovereign Guardrails

Epic: https://dev.azure.com/EasyWayData/EasyWay-DataPortal/_workitems/edit/480
`);
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from '../core/guardrails.js';
import { validatePageSpec } from '../core/page-spec.js';
import { premiumDesignSkill, webGuardrailsSkill, designGuidelinesSkill } from '../skills/index.js';
import { checkWcagContrast } from '../core/contrast.js';
import { probeRhythm } from '../core/rhythm.js';
import { probeHeroContract } from '../core/hero-contract.js';
import { probeSectionIntegrity } from '../core/section-integrity.js';
import { resolvePageSpecWithCatalog } from '../core/catalog.js';
import { resolvePageIdByRoute } from '../core/manifest.js';
import { auditThemePack, validateThemePackAgainstRegistry, VALENTINO_SURFACES, type ThemePackTokens, type SurfaceDefinition } from '../core/theme-audit.js';
import { probeContrastUsage } from '../core/contrast-usage-probe.js';
import type { ContrastLevel } from '../core/contrast.js';
import type { PageSpecV1, HeroSection, ValentinoCatalogV1, PagesManifestV1 } from '../core/types.js';

const server = new McpServer({
  name: 'valentino-engine',
  version: '0.2.0',
});

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function parseSpec(spec: string): PageSpecV1 {
  const parsed = JSON.parse(spec);
  if (!validatePageSpec(parsed)) throw new Error('Invalid PageSpecV1: requires version "1", id, sections[]');
  return parsed;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

server.tool(
  'valentino_audit_css',
  'Audit a CSS string for hardcoded px values, hex/rgba colors, and named CSS colors.',
  { css: z.string().describe('CSS content to audit') },
  async ({ css }) => {
    const violations = [
      ...checkNoHardcodedPx(css),
      ...checkNoHardcodedColor(css),
      ...checkNoNamedColor(css),
    ];
    return jsonResult(violations.length === 0
      ? { valid: true, message: 'No guardrail violations found.' }
      : { valid: false, violations });
  },
);

// ─── Validate ─────────────────────────────────────────────────────────────────

server.tool(
  'valentino_validate_pagespec',
  'Validate a Runtime PageSpec JSON against PageSpecV1 contract (version "1", id, sections[]).',
  { spec: z.string().describe('PageSpec JSON string') },
  async ({ spec }) => {
    try {
      const parsed = JSON.parse(spec);
      const valid = validatePageSpec(parsed);
      return jsonResult({ valid, message: valid ? 'PageSpec is valid (V1).' : 'Invalid: requires version "1", id (string), sections (array).' });
    } catch (e) {
      return jsonResult({ valid: false, message: `Invalid JSON: ${String(e)}` });
    }
  },
);

// ─── Contrast ─────────────────────────────────────────────────────────────────

server.tool(
  'valentino_check_contrast',
  'Check WCAG 2.1 contrast ratio between two colors. Returns ratio and pass/fail.',
  {
    foreground: z.string().describe('Foreground color (#hex or rgb())'),
    background: z.string().describe('Background color (#hex or rgb())'),
    level: z.enum(['AA', 'AAA']).optional().describe('WCAG level (default: AA)'),
  },
  async ({ foreground, background, level }) => {
    return jsonResult(checkWcagContrast(foreground, background, level || 'AA'));
  },
);

// ─── Theme Audit ─────────────────────────────────────────────────────────────

server.tool(
  'valentino_theme_audit',
  'Audit a theme-pack for WCAG contrast violations across all Valentino surfaces. Crosses every text/accent token with every surface background.',
  {
    themePack: z.string().describe('Theme-pack JSON string (with id and cssVars)'),
    level: z.enum(['AA', 'AAA']).optional().describe('WCAG level (default: AA)'),
    surfaces: z.string().optional().describe('Optional surfaces JSON array. Uses Valentino defaults if omitted.'),
    registry: z.string().optional().describe('Optional palette registry JSON for mutableTokens validation'),
  },
  async ({ themePack, level, surfaces, registry }) => {
    const tp: ThemePackTokens = (() => {
      const raw = JSON.parse(themePack);
      return { id: raw.id ?? 'unknown', cssVars: raw.cssVars ?? {} };
    })();

    const surfaceDefs: SurfaceDefinition[] = surfaces
      ? JSON.parse(surfaces)
      : VALENTINO_SURFACES;

    const contrastResult = auditThemePack(tp, {
      surfaces: surfaceDefs,
      level: (level as ContrastLevel) || 'AA',
    });

    const registryViolations = registry
      ? validateThemePackAgainstRegistry(tp, (JSON.parse(registry) as { themePacks: { mutableTokens: string[] } }).themePacks)
      : [];

    return jsonResult({ ...contrastResult, registryViolations });
  },
);

// ─── Contrast Usage Probe ────────────────────────────────────────────────────

server.tool(
  'valentino_probe_contrast_usage',
  'Probe CSS for text/accent variables used without surface-aware remapping. Finds tokens that will be invisible on light surfaces.',
  {
    css: z.string().describe('Full CSS content (e.g., framework.css)'),
  },
  async ({ css }) => {
    const result = probeContrastUsage(css);
    return jsonResult(result);
  },
);

// ─── Probes ───────────────────────────────────────────────────────────────────

server.tool(
  'valentino_probe_rhythm',
  'Validate section sequence rhythm: hero-first, no consecutive same rhythm, spacer rules.',
  { spec: z.string().describe('PageSpec JSON string') },
  async ({ spec }) => jsonResult(probeRhythm(parseSpec(spec))),
);

server.tool(
  'valentino_probe_hero',
  'Validate hero section contract: CTA discipline, single decorative source, copy density.',
  { spec: z.string().describe('PageSpec JSON string') },
  async ({ spec }) => {
    const pageSpec = parseSpec(spec);
    const heroes = pageSpec.sections.filter((s): s is HeroSection => s.type === 'hero');
    if (heroes.length === 0) return jsonResult({ valid: true, message: 'No hero sections found.' });
    return jsonResult(heroes.map(h => ({ titleKey: h.titleKey, ...probeHeroContract(h) })));
  },
);

server.tool(
  'valentino_probe_integrity',
  'Validate structural integrity of all sections (cards items, form fields, etc.).',
  { spec: z.string().describe('PageSpec JSON string') },
  async ({ spec }) => jsonResult(probeSectionIntegrity(parseSpec(spec).sections)),
);

server.tool(
  'valentino_probe_all',
  'Run all validation probes (rhythm + hero + integrity) on a PageSpec.',
  { spec: z.string().describe('PageSpec JSON string') },
  async ({ spec }) => {
    const pageSpec = parseSpec(spec);
    const heroes = pageSpec.sections.filter((s): s is HeroSection => s.type === 'hero');
    return jsonResult({
      rhythm: probeRhythm(pageSpec),
      hero: heroes.map(h => ({ titleKey: h.titleKey, ...probeHeroContract(h) })),
      integrity: probeSectionIntegrity(pageSpec.sections),
    });
  },
);

// ─── Catalog ──────────────────────────────────────────────────────────────────

server.tool(
  'valentino_resolve_catalog',
  'Resolve a PageSpec against a Valentino catalog (blueprints, presets, templates).',
  {
    spec: z.string().describe('PageSpec JSON string'),
    catalog: z.string().describe('ValentinoCatalogV1 JSON string'),
  },
  async ({ spec, catalog }) => {
    const pageSpec = parseSpec(spec);
    const cat: ValentinoCatalogV1 = JSON.parse(catalog);
    return jsonResult(resolvePageSpecWithCatalog(pageSpec, cat));
  },
);

// ─── Manifest ─────────────────────────────────────────────────────────────────

server.tool(
  'valentino_resolve_route',
  'Resolve a URL route to a page ID using a pages manifest.',
  {
    manifest: z.string().describe('PagesManifestV1 JSON string'),
    route: z.string().describe('URL pathname to resolve (e.g., /pricing)'),
  },
  async ({ manifest, route }) => {
    const man: PagesManifestV1 = JSON.parse(manifest);
    const pageId = resolvePageIdByRoute(man, route);
    return jsonResult(pageId
      ? { found: true, pageId }
      : { found: false, message: `No page found for route "${route}"` });
  },
);

// ─── Skills ───────────────────────────────────────────────────────────────────

server.tool(
  'valentino_get_skill',
  'Get the rules for a Valentino Engine design skill.',
  { skill: z.enum(['premium-design', 'web-guardrails', 'design-guidelines']).describe('Skill name') },
  async ({ skill }) => {
    const map = { 'premium-design': premiumDesignSkill, 'web-guardrails': webGuardrailsSkill, 'design-guidelines': designGuidelinesSkill };
    return jsonResult(map[skill]);
  },
);

server.tool(
  'valentino_list_guardrails',
  'List all 10 Sovereign Guardrails of Valentino Engine.',
  {},
  async () => {
    const guardrails = [
      '1. WhatIf di Layout — Never generate code without a conceptual wireframe first',
      '2. Component Boundary & Fallbacks — All API bridges must include Error Boundaries',
      '3. Design Token System — No magic numbers or hardcoded hex/rgba values',
      '4. L3 Audit before Commit — Check for dependency bloat and ARIA compliance',
      '5. Escalation to GEDI — Consult GEDI on architectural trade-offs',
      '6. Zero UI-Debt — Always scan for reusable components before creating new ones',
      '7. Electrical Socket Pattern — Colors via CSS root variables only',
      '8. Testudo Formation — Respect parent container padding, no inline overrides',
      '9. Tangible Legacy — No redundant CSS blocks; use utility classes',
      '10. Visual Live Audit — Use MCP browser_screenshot or npm run test:e2e:valentino',
    ];
    return { content: [{ type: 'text' as const, text: guardrails.join('\n') }] };
  },
);

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('valentino-engine MCP server running on stdio (13 tools)');
  process.stdin.resume();
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});

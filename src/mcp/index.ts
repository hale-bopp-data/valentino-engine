import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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
import { figmaToPageSpec, fetchFigmaFile, type FigmaImportOptions } from '../core/figma-import.js';
import { generateImage, generatePlaceholder, type ImageGenerationRequest, type ImageProviderConfig } from '../core/providers/image.js';
import type { PageSpecV1, HeroSection, ValentinoCatalogV1, PagesManifestV1 } from '../core/types.js';

// ─── Load guardrails.json (SSoT machine-readable) ────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const engineRoot = resolve(dirname(__filename), '..', '..');
const guardrailsPath = resolve(engineRoot, 'guardrails.json');
let guardrailsSSoT: Array<{ id: string; name: string; severity: string; rule: string }> = [];
if (existsSync(guardrailsPath)) {
  try {
    const raw = JSON.parse(readFileSync(guardrailsPath, 'utf-8'));
    guardrailsSSoT = raw.guardrails || [];
  } catch { /* fallback to hardcoded below */ }
}

const server = new McpServer({
  name: 'valentino-engine',
  version: '2.7.0',
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
  'List all Valentino Sovereign Guardrails from the machine-readable SSoT (guardrails.json).',
  {},
  async () => {
    if (guardrailsSSoT.length > 0) {
      const lines = guardrailsSSoT.map(
        (g, i) => `${i + 1}. ${g.name} [${g.severity}] — ${g.rule}`
      );
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
    // Fallback hardcoded (if guardrails.json unreadable)
    const fallback = [
      '1. WhatIf di Layout — Never generate code without a conceptual wireframe first',
      '2. Component Boundary & Fallbacks — All API bridges must include Error Boundaries',
      '3. Design Token System — No magic numbers or hardcoded hex/rgba values',
      '4. L3 Audit before Commit — Check for dependency bloat and ARIA compliance',
      '5. Escalation Architecturale — Resolve OODA loop before proposing code',
      '6. Zero UI-Debt — Always scan for reusable components before creating new ones',
      '7. Electrical Socket Pattern — Colors via CSS root variables only',
      '8. Testudo Formation — Respect parent container padding, no inline overrides',
      '9. Tangible Legacy — No redundant CSS blocks; use utility classes',
      '10. Visual Live Audit — Use MCP browser_screenshot or npm run test:e2e:valentino',
    ];
    return { content: [{ type: 'text' as const, text: fallback.join('\n') }] };
  },
);

// ─── Self-Check ────────────────────────────────────────────────────────────

server.tool(
  'valentino_self_check',
  'Run engine self-diagnostics: guardrails.json integrity, PROMPTS.md presence, core module loadability. Returns PASS/FAIL with breakdown.',
  {},
  async () => {
    const checks: Array<{ name: string; status: string; detail: string }> = [];
    let passed = 0;
    let failed = 0;

    // 1. guardrails.json SSoT integrity
    if (guardrailsSSoT.length >= 10) {
      checks.push({ name: 'guardrails.json', status: 'PASS', detail: `${guardrailsSSoT.length}/10 guardrails loaded` });
      passed++;
    } else {
      checks.push({ name: 'guardrails.json', status: 'FAIL', detail: `Only ${guardrailsSSoT.length}/10 guardrails found` });
      failed++;
    }

    // 2. PROMPTS.md presence
    const promptsPath = resolve(engineRoot, 'PROMPTS.md');
    if (existsSync(promptsPath)) {
      checks.push({ name: 'PROMPTS.md', status: 'PASS', detail: 'System prompt found' });
      passed++;
    } else {
      checks.push({ name: 'PROMPTS.md', status: 'FAIL', detail: `${promptsPath} not found` });
      failed++;
    }

    // 3. Core modules loadable (can import without throwing)
    try {
      const testSpec: PageSpecV1 = { version: '1', id: '_selfcheck', sections: [] };
      if (validatePageSpec(testSpec)) {
        checks.push({ name: 'page-spec', status: 'PASS', detail: 'validatePageSpec functional' });
        passed++;
      } else {
        checks.push({ name: 'page-spec', status: 'FAIL', detail: 'validatePageSpec returned false for valid spec' });
        failed++;
      }
    } catch (e) {
      checks.push({ name: 'page-spec', status: 'FAIL', detail: `Import error: ${String(e)}` });
      failed++;
    }

    // 4. CSS guardrails functional
    try {
      const dummyCss = ':root { --color: #123; }';
      const pxViolations = checkNoHardcodedPx(dummyCss);
      const colorViolations = checkNoHardcodedColor(dummyCss);
      checks.push({ name: 'css-guardrails', status: 'PASS', detail: `px:${pxViolations.length} color:${colorViolations.length} violations (dummy)` });
      passed++;
    } catch (e) {
      checks.push({ name: 'css-guardrails', status: 'FAIL', detail: `Guardrail error: ${String(e)}` });
      failed++;
    }

    // 5. WCAG contrast functional
    try {
      checkWcagContrast('#000000', '#FFFFFF', 'AA');
      checks.push({ name: 'wcag-contrast', status: 'PASS', detail: 'checkWcagContrast functional' });
      passed++;
    } catch (e) {
      checks.push({ name: 'wcag-contrast', status: 'FAIL', detail: `Contrast error: ${String(e)}` });
      failed++;
    }

    return jsonResult({
      outcome: failed === 0 ? 'PASS' : 'FAIL',
      score: `${passed}/${passed + failed}`,
      checks,
    });
  },
);

// ─── Recommend ─────────────────────────────────────────────────────────────

server.tool(
  'valentino_recommend',
  'Get guided design recommendations for a CSS snippet. Instead of listing violations, suggests token replacements and better patterns. The invisible hand: guides, does not punish.',
  { css: z.string().describe('CSS content to analyze for recommendations') },
  async ({ css }) => {
    const suggestions: string[] = [];

    const pxViolations = checkNoHardcodedPx(css);
    for (const v of pxViolations) {
      suggestions.push(`Sostituzione suggerita: ${v}`);
    }

    const colorViolations = [
      ...checkNoHardcodedColor(css),
      ...checkNoNamedColor(css),
    ];
    for (const v of colorViolations) {
      suggestions.push(`Colore da convertire in token: ${v}`);
    }

    if (suggestions.length === 0) {
      suggestions.push('Nessun miglioramento evidente. Il CSS usa design token e non ha valori hardcoded. Ottimo lavoro!');
    }

    return jsonResult({
      recommendation_count: suggestions.length,
      suggestions,
      principle: 'La mano invisibile guida, non giudica. Ogni suggerimento è un invito, non un obbligo.',
    });
  },
);

// ─── Live Check — real-time inline guidance while writing ──────────────────

server.tool(
  'valentino_live_check',
  'Real-time CSS check while writing. Pass a CSS fragment (even incomplete) and get gentle, inline guidance: token suggestions, rhythm hints, accessibility reminders. Non-blocking — always returns suggestions, never errors.',
  { css: z.string().describe('CSS fragment to check (can be incomplete/in-progress)') },
  async ({ css }) => {
    const guidance: string[] = [];
    let tokenCount = 0;
    let hardcodedCount = 0;

    // Check for hardcoded px — suggest rhythm tokens
    const pxMatches = css.match(/(\d+)px/g);
    if (pxMatches) {
      for (const m of pxMatches) {
        const val = parseInt(m);
        // Map common px values to rhythm suggestions
        const rhythmHints: Record<number, string> = {
          0: '0 (usa 0 senza unità)',
          4: 'var(--space-xs)',
          8: 'var(--space-sm)',
          12: 'var(--space-md)',
          16: 'var(--space)',
          20: 'var(--space-lg)',
          24: 'var(--space-xl)',
          32: 'var(--space-2xl)',
          40: 'var(--space-3xl)',
          48: 'var(--space-4xl)',
          64: 'var(--space-5xl)',
          80: 'var(--space-6xl)',
        };
        const hint = rhythmHints[val];
        if (hint) {
          guidance.push(`${m} → ${hint}`);
          hardcodedCount++;
        } else {
          guidance.push(`${m} → considera un token di spaziatura var(--space-*)`);
          hardcodedCount++;
        }
      }
    }

    // Check for hex/rgb colors — suggest token lookup
    const hexMatches = css.match(/#[0-9a-fA-F]{3,8}/g) || [];
    const rgbMatches = css.match(/rgba?\s*\([^)]+\)/g) || [];
    for (const m of [...hexMatches, ...rgbMatches]) {
      guidance.push(`${m} → esiste un token semantico per questo colore? Controlla tokens.css.`);
      hardcodedCount++;
    }

    // Check for CSS variables — positive reinforcement
    const varMatches = css.match(/var\(--[\w-]+\)/g) || [];
    tokenCount = varMatches.length;

    if (hardcodedCount === 0 && tokenCount > 0) {
      guidance.push('Bene! Stai usando design token. Continua così.');
    } else if (hardcodedCount === 0 && tokenCount === 0) {
      guidance.push('Pronto per aggiungere stili. Ricorda: usa var(--*) per colori e spaziature.');
    }

    return jsonResult({
      tokens_used: tokenCount,
      hardcoded_found: hardcodedCount,
      guidance,
      live_check: true,
    });
  },
);

// ─── Figma Import ─────────────────────────────────────────────────────────

server.tool(
  'valentino_import_figma',
  'Import a Figma file and convert to Valentino PageSpec V1. Provide Figma JSON directly or fetch via fileKey+figmaToken.',
  {
    figmaJson: z.string().optional().describe('Figma REST API JSON response (document object). Use this OR fileKey+figmaToken.'),
    fileKey: z.string().optional().describe('Figma file key (from URL). Requires figmaToken.'),
    figmaToken: z.string().optional().describe('Figma personal access token. Required if using fileKey.'),
    template: z.string().optional().describe('PageSpec template id (default: corporate)'),
  },
  async ({ figmaJson, fileKey, figmaToken, template }) => {
    try {
      if (figmaJson) {
        const doc = JSON.parse(figmaJson);
        const result = figmaToPageSpec(doc, { template });
        return jsonResult({
          ...result,
          importMethod: 'json',
        });
      }

      if (fileKey && figmaToken) {
        const doc = await fetchFigmaFile(fileKey, figmaToken);
        const result = figmaToPageSpec(doc, { template });
        return jsonResult({
          ...result,
          importMethod: 'api',
          importedFrom: `Figma file ${fileKey}`,
        });
      }

      return jsonResult({
        error: 'Provide either figmaJson (Figma document JSON) or fileKey+figmaToken.',
        usage: 'figmaJson: "{\\"document\\":{\\"children\\":[...]}}"  OR  fileKey:"abc123" figmaToken:"figd_..."',
      });
    } catch (e) {
      return jsonResult({
        error: `Figma import failed: ${String(e)}`,
        help: 'Verify the Figma JSON is a valid document object with document.children array.',
      });
    }
  },
);

// ─── Image Generation ─────────────────────────────────────────────────────

server.tool(
  'valentino_generate_image',
  'Generate an image for a PageSpec section. Uses configured external endpoint or falls back to placeholder SVG from design tokens. Valentino is the orchestrator — the external service does the generation.',
  {
    prompt: z.string().describe('Text prompt describing the desired image'),
    primaryColor: z.string().optional().describe('Primary brand color (hex, e.g. #1a73e8)'),
    backgroundColor: z.string().optional().describe('Background color (hex, e.g. #0a0a0a)'),
    accentColor: z.string().optional().describe('Accent color (hex)'),
    width: z.number().optional().describe('Image width in pixels (default: 1200)'),
    height: z.number().optional().describe('Image height in pixels (default: 630)'),
    style: z.enum(['corporate', 'landing', 'minimal']).optional().describe('Visual style (default: corporate)'),
    endpoint: z.string().optional().describe('External image API endpoint URL. If omitted, generates placeholder SVG.'),
    externalToken: z.string().optional().describe('Token for external endpoint'),
    model: z.string().optional().describe('Model identifier for external provider'),
  },
  async ({ prompt, primaryColor, backgroundColor, accentColor, width, height, style, endpoint, externalToken, model }) => {
    try {
      const request: ImageGenerationRequest = {
        prompt,
        context: {
          primaryColor: primaryColor || '#1a73e8',
          backgroundColor: backgroundColor || '#0a0a0a',
          accentColor: accentColor || '#34a853',
          textColor: '#ffffff',
          width: width || 1200,
          height: height || 630,
          style: style || 'corporate',
        },
      };

      const config: ImageProviderConfig = {
        endpoint,
        token: externalToken,
        model,
        width: width || 1200,
        height: height || 630,
      };

      const result = await generateImage(request, config);

      return jsonResult({
        ...result,
        generatedFor: prompt.substring(0, 100),
        isPlaceholder: !!result.svg,
        note: result.svg
          ? 'Placeholder SVG generated from design tokens. Configure an external endpoint (--endpoint) for AI-generated images.'
          : `Image generated by ${result.provider}`,
      });
    } catch (e) {
      return jsonResult({
        error: `Image generation failed: ${String(e)}`,
        fallback: 'Placeholder SVG available — use without endpoint parameter.',
      });
    }
  },
);

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('valentino-engine MCP server running on stdio (18 tools)');
  process.stdin.resume();
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});

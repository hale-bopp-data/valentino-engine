# Changelog

## [2.14.0] — 2026-06-21

### Added
- **audit-dom (#3051)**: `valentino audit-dom <url>` — runtime DOM audit via Playwright. Detects inline styles injected by JS, horizontal overflow per viewport, console errors, 404 resources, interactive elements without accessible labels. Multi-viewport with `--responsive`. MCP tool `valentino_audit_dom`. 10 tests.
- **suggest-fix (#3050)**: `valentino suggest-fix <file>` — non-destructive fix proposals. Covers inline→class, 0px→0, px→token/rem, hardcoded color→token, named color→token. Output formats: `--format patch` (unified diff), `table` (markdown), `json` (structured). MCP tool `valentino_suggest_fix`. 12 tests.
- **MCP tools update (#3057)**: `profile` (landing|spa|dashboard) on `valentino_probe_rhythm`, `valentino_probe_all`, `valentino_visual_audit`. `debug` on `valentino_visual_audit`. `allowedTokenPrefixes` on `valentino_audit_css`, `valentino_audit_html`, `valentino_report`.

### Changed
- **MCP**: 22 tools → 24 tools (added `valentino_audit_dom`, `valentino_suggest_fix`).
- **CLI**: 24 commands → 26 commands (added `audit-dom`, `suggest-fix`).
- **Pipeline CI (#3058)**: `pr:` and `trigger:` now include `develop` branch (was main-only).
- **Test suite**: 781 → 803 tests across 52 suites.

## [2.13.0] — 2026-06-21

### Added
- **SPA/Dashboard Profile (#3049)**: `--profile spa|dashboard|landing` on `probe` and `visual-audit`. SPA profile relaxes rhythm rules, adds sidebar-ratio, form-label coverage, tab a11y, nav-landmark checks. New `src/core/spa-profile.ts` (21 tests).
- **Config Token Definitions (#3052)**: `.valentino.json` config with `allowedTokenPrefixes` and `tokenDefinitionSelectors`. Prefix-based filtering — only authorized token prefixes are exempted. Auto-discovery walks up 10 directories. New `src/core/guardrail-config.ts` (22 tests).
- **Uniform JSON Output (#3053)**: `--json` flag on all 6 commands (`audit`, `audit-html`, `certify`, `validate-tokens`, `probe`, `report`). Schema v1 with `tool`, `version`, `schemaVersion`, `timestamp`, `passed`, `exitCode`, `sections`, `summary`. New `src/core/json-output.ts` (7 tests).
- **Visual-Audit Diagnostics (#3048)**: console capture (`page.on('console')`, `page.on('pageerror')`), `--debug` mode (script preview, raw result), actionable error messages with typeof/preview/readyState, partial fallback on script failure (6 tests).
- **57 new tests**: guardrail-config (22), spa-profile (21), report (7), json-output (7). Total: 781.

### Fixed
- **Report `--allow-token-definitions` (#3047)**: flag now propagated to HTML Audit section in `generateReport()`. Was only reaching CSS Guardrails (7 tests).

### Changed
- **Exit codes**: unified across all commands — 0=pass, 1=violations, 2=tool error, 3=dependency missing.
- **`VisualAuditResult`**: added `consoleMessages`, `pageErrors`, `pageTitle`, `diagnostics` fields.
- **Test suite**: 724 → 781 tests across 50 suites.

## [2.12.0] — 2026-06-20

### Added
- **MCP Visual Audit (#3046)**: `valentino_visual_audit` — Playwright audit on HTML content or live URLs. Detects overflow, collisions, contrast. Supports `responsive` mode (desktop/tablet/mobile).
- **MCP Report (#3046)**: `valentino_report` — unified report (CSS guardrails + tokens + security) as MCP tool. JSON output.
- **URL Visual Audit (#3046)**: `valentino visual-audit http://localhost:8765` — accepts URLs directly, auto-detected by `http(s)://` prefix.
- **Responsive Audit (#3046)**: `--responsive` flag runs visual audit at 3 viewports: desktop (1440x900), tablet (768x1024), mobile (390x844).
- **`--allow-token-definitions` (#3046)**: skip CSS custom property declarations (`--var: value`) in guardrail checks. Available on `audit`, `audit-html`, `report` CLI commands and `valentino_audit_css`, `valentino_audit_html` MCP tools.
- **JSON Output (#3046)**: `--json` flag on `report` and `visual-audit` for machine-readable output.
- **Exit Codes (#3046)**: 0=pass, 1=violations, 2=tool error, 3=browser unavailable.
- **CLI `valentino mcp`**: start MCP server from CLI (22 tools, stdio).
- **Page-level overflow detection**: audit script checks `document.documentElement.scrollWidth > window.innerWidth`.
- **Phase-based error diagnostics**: visual audit errors include `phase` field (browser-launch, page-create, content-load, audit-script).
- **11 new tests**: `GuardrailOptions`, responsive audit, EXIT_CODES, viewport labels, report `allowTokenDefinitions`. Total: 724.

### Changed
- **MCP**: 20 tools -> 22 tools (added `valentino_visual_audit`, `valentino_report`)
- **MCP version**: 2.7.0 -> 2.12.0
- **`valentino_audit_css`**: now accepts `allowTokenDefinitions` parameter
- **`valentino_audit_html`**: now accepts `allowTokenDefinitions` parameter
- **`auditHtml()` core**: accepts optional `GuardrailOptions`
- **Visual audit selectors**: expanded to include `header`, `nav`, `footer`, `.container`, `.wrapper`, `article`, `aside`
- **Help text**: updated with all new flags and `mcp` command

## [Unreleased] — develop

### Added
- **Figma Import (#1671)**: `figmaToPageSpec()` converts Figma REST API JSON → PageSpec V1. Maps frames → sections (hero/cards/cta), extracts tokens from fills. MCP `valentino_import_figma`. CLI `valentino figma import`.
- **Image Bridge (#1671)**: Provider pattern (G16) for external image generation. Default: placeholder SVG from design tokens. `generateImage()` + `generatePlaceholder()`. MCP `valentino_generate_image`. CLI `valentino image generate`.
- **MCP Self-Check (#1668)**: `valentino_self_check` — engine self-diagnostics PASS/FAIL (guardrails.json, PROMPTS.md, core modules).
- **MCP Recommend (#1668)**: `valentino_recommend` — guided suggestions, never errors. Invisible hand for LLMs.
- **MCP Live Check (#1668)**: `valentino_live_check` — real-time CSS guidance while writing, works on incomplete fragments.
- **Guardrails SSoT (#1668)**: `guardrails.json` — 10 Sovereign Guardrails machine-readable (GR01-GR10, severity, rule, check).
- **Self-check script (#1668)**: `self-check.sh` — atomic PASS/FAIL (5 checks: vitest, css audit, wcag, guardrails, build).
- **Test coverage (#1668)**: 34 new tests (editor.ts + schema-export.ts + figma-import + image provider). Total: 535.

### Changed
- **MCP**: 13 tools → 18 tools
- **PROMPTS.md**: rewritten as universal design guide for any LLM (was missing/broken)
- **Manifest**: version 0.1.0 → 2.7.0, system_prompt path fixed

## [2.1.0] — 2026-03-26

### Added
- **CMS Guardrails (PBI #605)**: 6 new checks — `checkOgImageExists`, `checkMediaOrphans`, `checkMediaMissingAlt`, `checkBreadcrumbDepth`, `checkLanguageCoverage`, `checkDuplicateRoutes` (12/14 total)
- **LLMs.txt Generator (PBI #614)**: `generateLlmsTxt` (L0 compact) + `generateLlmsFullTxt` (L1 detailed) + CLI `valentino llms`
- **Animation Presets (PBI #611)**: `AnimationSpec` on `SectionPresentationBase`, 5 presets (fade-up/in, slide-left/right, scale-in), `probeAnimations` validation, `resolveAnimationCSS` for consumers
- **Encoding Guardrail (PBI #629)**: `checkMojibake` (14 Latin-1/Win-1252 patterns), `checkTypography` (15+ rules for IT/EN/FR/DE/ES), `checkEncoding` combined

### Changed
- CLI now has 10 commands (was 9): added `llms`
- Test suite: 239 tests across 16 suites (was 170/13)
- Core modules: 17 (was 14)
- `collectPureCmsWarnings` accepts new options: `mediaManifest`, `contentByLang`

## [2.0.0] — 2026-03-26

### Breaking Changes
- **`resolveMediaUrl(manifest, key)`**: now requires `MediaManifest` as first argument (was single-arg before)

### Added
- **CMS Module**: `getPageStatus`, `getPublishAt`, `isPageVisible` — page lifecycle management
- **Redirects Module**: `findRedirect`, `RedirectRule`, `RedirectsConfig` — declarative redirect resolution
- **Media Module**: `resolveMediaUrl`, `resolveMediaAsset`, `MediaAsset`, `MediaManifest` — media resolution
- **SEO Module**: `buildWebPageSchema`, `SeoSpec` — Schema.org WebPage generation
- **Extension Registry**: 6 extension points (custom renderers, guardrails, statuses, content/media resolvers, editor panels)
- **CMS Guardrails**: 6 pure rules migrated from portal (draft, publishAt, 404, redirects, SEO, maintenance)
- **CLI `valentino init`**: interactive scaffolding with 4 templates (minimal, product, advisor, conversion)
- **CLI `valentino validate`**: reads `valentino.guardrails.json`, applies severity per template
- **ManifestPageV1**: extended with `status`, `publishAt`, `seo` (optional fields)
- **PagesManifestV1**: added `maintenanceMode` (optional)
- **PageSpecV1**: added `seo` (optional)

### Changed
- CLI now has 9 commands (was 7): added `init` and `validate`
- Test suite: 170 tests across 14 suites (was 109/9)
- Core modules: 14 (was 10)

### Architecture
- Full CMS logic extracted from easyway-portal — engine is now standalone
- Portal reduced to glue code (I/O + DOM), imports everything from engine
- Consumer example: `examples/minimal-consumer/`

## [1.0.0] — 2026-03-23

### Added
- **Core Type System**: Full PageSpecV1 type system (18 section types, catalog, manifest, navigation)
- **Catalog Resolver**: `resolvePageSpecWithCatalog` with blueprint, template, and preset resolution + governance checks
- **Presentation Resolver**: `resolvePresentation`, `inferRhythmProfile`, `DEFAULT_PRESENTATION`
- **Manifest Resolver**: `normalizePathname`, `resolvePageIdByRoute`
- **CSS Guardrails**: `checkNoHardcodedPx`, `checkNoHardcodedColor`, `checkNoNamedColor` (148 CSS colors)
- **WCAG Contrast**: `checkWcagContrast` with AA/AAA levels
- **Rhythm Probe**: hero-first, no consecutive same rhythm, spacer rules
- **Hero Contract**: CTA discipline, single decorative source, copy density, action rail geometry
- **Section Integrity**: per-type structural validation for 8 section types
- **CLI**: 7 commands (`audit`, `validate`, `guardrails`, `probe`, `contrast`, `catalog resolve`, `manifest resolve`)
- **MCP Server**: 13 tools covering all engine capabilities
- **Test Suite**: 109 tests across 9 suites

### Architecture
- Zero DOM, zero fetch — pure functions only
- Framework-agnostic: consumers load data, engine resolves/validates/probes
- Type system extracted from easyway-portal (single source of truth)

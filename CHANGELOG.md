# Changelog

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

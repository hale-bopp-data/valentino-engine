# Changelog

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

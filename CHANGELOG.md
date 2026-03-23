# Changelog

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

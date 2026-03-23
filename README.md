# Valentino Engine

> **Antifragile Open Source UI Design Engine** — part of the [HALE-BOPP](https://dev.azure.com/EasyWayData/EasyWay-DataPortal/_git/hale-bopp-valentino-engine) family.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@hale-bopp/valentino-engine)](https://www.npmjs.com/package/@hale-bopp/valentino-engine)

## What is Valentino Engine?

Valentino Engine validates, resolves, and probes **Runtime PageSpec JSON** — the contract that drives UI rendering. It enforces Design Tokens, checks WCAG accessibility, validates page structure, and resolves catalog blueprints — all without framework lock-in.

**Zero DOM. Zero fetch. Pure functions only.** You load data, the engine validates and resolves it.

## Quickstart

```bash
# Audit CSS for guardrail violations (px, hex, named colors)
npx @hale-bopp/valentino audit ./styles/theme.css

# Validate a PageSpec JSON
npx @hale-bopp/valentino validate ./pages/home.json

# Run all structural probes on a page
npx @hale-bopp/valentino probe all ./pages/home.json

# Check WCAG contrast ratio
npx @hale-bopp/valentino contrast "#333333" "#ffffff" AA

# Resolve a spec with a catalog
npx @hale-bopp/valentino catalog resolve ./pages/home.json --catalog ./catalog.json

# List the 10 Sovereign Guardrails
npx @hale-bopp/valentino guardrails
```

## Library API

```typescript
import {
  // Types (18 section types, full PageSpecV1)
  type PageSpecV1, type SectionSpec, type ValentinoCatalogV1,

  // Validation
  validatePageSpec, checkWcagContrast,

  // CSS Guardrails
  checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor,

  // Probes
  probeRhythm, probeHeroContract, probeSectionIntegrity,

  // Catalog & Presentation
  resolvePageSpecWithCatalog, resolvePresentation, inferRhythmProfile,

  // Manifest
  resolvePageIdByRoute,
} from '@hale-bopp/valentino-engine';
```

## MCP Server (13 Tools)

Any MCP-compatible AI agent can connect to Valentino Engine:

```json
{
  "mcp_servers": {
    "valentino-engine": {
      "command": "npx",
      "args": ["@hale-bopp/valentino-engine", "mcp"]
    }
  }
}
```

| Tool | Description |
|------|-------------|
| `valentino_audit_css` | Audit CSS for hardcoded px, hex/rgba, and named colors |
| `valentino_validate_pagespec` | Validate PageSpecV1 contract |
| `valentino_check_contrast` | WCAG 2.1 contrast ratio (AA/AAA) |
| `valentino_probe_rhythm` | Section sequence rhythm validation |
| `valentino_probe_hero` | Hero contract (CTA discipline, copy density) |
| `valentino_probe_integrity` | Per-type structural validation |
| `valentino_probe_all` | All probes combined |
| `valentino_resolve_catalog` | Resolve spec with catalog (blueprints, presets) |
| `valentino_resolve_route` | Resolve URL route to page ID |
| `valentino_get_skill` | Get design skill rules |
| `valentino_list_guardrails` | List 10 Sovereign Guardrails |

## The 10 Sovereign Guardrails

1. **WhatIf di Layout** — Wireframe first, code second
2. **Component Boundary & Fallbacks** — Error Boundaries on all API bridges
3. **Design Token System** — No hardcoded colors or px values
4. **L3 Audit before Commit** — ARIA, performance, and dependency check
5. **Escalation to GEDI** — Consult GEDI on architectural trade-offs
6. **Zero UI-Debt** — Reuse before creating
7. **Electrical Socket Pattern** — CSS root variables for all colors
8. **Testudo Formation** — No inline padding/margin overrides on containers
9. **Tangible Legacy** — No redundant CSS blocks
10. **Visual Live Audit** — Playwright MCP or `npm run test:e2e:valentino`

## Contributing

PRs welcome! Please link your PR to an ADO Work Item under [Epic #480](https://dev.azure.com/EasyWayData/EasyWay-DataPortal/_workitems/edit/480).

## License

[MIT](./LICENSE) — EasyWay Platform Team

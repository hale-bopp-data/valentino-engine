# Valentino Engine

> **Antifragile Open Source UI Design Engine** — part of the [HALE-BOPP](https://github.com/hale-bopp-data) family.

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

## Valentino Cockpit — Il Sarto Parla

Interactive conversational cockpit for building and editing pages. Speak naturally (IT/EN), import from screenshots, URLs, videos, or existing projects.

### Quick Launch

```bash
# Windows
cockpit.bat

# Mac / Linux
./cockpit.sh

# Any OS
npx tsx src/cockpit-server.ts examples/minimal-site/pages/home.json
```

Then open **http://localhost:3781** in your browser.

### With LLM (smart parsing)

```bash
# Windows
set OPENROUTER_API_KEY=sk-or-v1-your-key
cockpit.bat

# Mac / Linux
OPENROUTER_API_KEY=sk-or-v1-your-key ./cockpit.sh
```

Or configure the API key from the **Settings** button in the browser UI.

### Custom page spec & port

```bash
# Windows
cockpit.bat path\to\my-page.json 4000

# Mac / Linux
./cockpit.sh path/to/my-page.json 4000
```

### CLI REPL (no browser)

```bash
npx tsx src/bin/valentino.ts cockpit examples/minimal-site/pages/home.json
```

### Features

| Feature | What it does |
|---------|-------------|
| **Chat** | Speak naturally: "mostrami le sezioni", "aggiungi stats", "rimuovi la cta" |
| **Import Screenshot** | Upload a screenshot, LLM vision generates a page spec |
| **Import URL** | Paste a URL, system fetches and analyzes the page |
| **Import Video** | Upload a video, browser extracts frames, LLM composes a page |
| **Import Project** | Point to a local HTML/CSS folder, generates governed specs |
| **Undo / Save** | Full undo history, save to disk |
| **Settings** | Configure OpenRouter API key and model from the UI |
| **Live Preview** | See page sections update in real-time as you work |

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

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) — EasyWay Platform Team

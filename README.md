# Valentino Engine

> **Antifragile Open Source UI Design Engine** — part of the [HALE-BOPP](https://dev.azure.com/EasyWayData/EasyWay-DataPortal/_git/hale-bopp-valentino-engine) family.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@hale-bopp/valentino-engine)](https://www.npmjs.com/package/@hale-bopp/valentino-engine)

## What is Valentino Engine?

Valentino Engine generates **Runtime PageSpec JSON**, validates accessibility, enforces Design Tokens, and consults GEDI for architectural decisions — all without a framework lock-in.

It was born from **Agent Valentino** (Epic #444), an L3 UI Specialist agent that acquired:
- Multi-modal capabilities (MP4 video → Runtime JSON widget)
- Remote Playwright visual audits
- Chaos Resilience E2E testing
- A11y Auto-Remediation
- Multi-agent architecture consultation via Gedi MCP

## Quickstart

```bash
# Audit a CSS file for guardrail violations
npx @hale-bopp/valentino audit ./src/styles/theme.css

# Validate a Runtime PageSpec JSON
npx @hale-bopp/valentino validate ./public/pages/home.json

# List all 10 Sovereign Guardrails
npx @hale-bopp/valentino guardrails
```

## Use as an MCP Server

Any MCP-compatible AI agent can connect to Valentino Engine directly:

```json
{
  "mcp_servers": {
    "valentino-engine": {
      "command": "npx",
      "args": ["@hale-bopp/valentino", "mcp"]
    }
  }
}
```

### Exposed Tools

| Tool | Description |
|------|-------------|
| `valentino_audit_css` | Detects hardcoded px and color values |
| `valentino_validate_pagespec` | Validates Runtime PageSpec JSON contract |
| `valentino_get_skill` | Returns rules for a specific design skill |
| `valentino_list_guardrails` | Lists all 10 Sovereign Guardrails |

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

This is an open source project. PRs welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and link your PR to an ADO Work Item.

## License

[MIT](./LICENSE) — EasyWay Platform Team

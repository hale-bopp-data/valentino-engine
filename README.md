# Valentino Engine

> **Antifragile Open Source UI Design Engine** — part of the [HALE-BOPP](https://github.com/hale-bopp-data) family.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@hale-bopp/valentino-engine)](https://www.npmjs.com/package/@hale-bopp/valentino-engine)

## What is Valentino Engine?

Valentino Engine is a **CSS/HTML audit tool and UI design engine** that:

- **Audits CSS and HTML** for hardcoded values (px, hex, rgba, named colors) and enforces design token usage
- **Runs visual audits** via Playwright on files or live URLs (overflow, collisions, contrast)
- **Validates PageSpec JSON** — the contract that drives UI rendering
- **Checks WCAG accessibility** (contrast ratios AA/AAA)
- **Provides 22 MCP tools** for AI-agent integration
- **Works as CLI, MCP server, or TypeScript library**

Zero framework lock-in. No React, no Tailwind. Pure TypeScript.

## When to use Valentino

| Situation | What to use | Example |
|-----------|-------------|---------|
| Audit a CSS/HTML file for design token violations | CLI `valentino audit` or `valentino report` | `valentino report index.html --json` |
| Check a live running site for visual issues | CLI `valentino visual-audit` with URL | `valentino visual-audit http://localhost:8765 --responsive` |
| AI agent needs to audit CSS during code review | MCP `valentino_audit_css` or `valentino_report` | Agent calls tool with CSS content |
| AI agent needs visual audit on rendered page | MCP `valentino_visual_audit` | Agent passes URL, gets overflow/contrast results |
| Validate a PageSpec before rendering | API `validatePageSpec()` | Import and call from TypeScript |
| CI pipeline guardrail gate | CLI with exit codes | Exit 0=pass, 1=violations, 2=error, 3=no browser |

## Quickstart

```bash
npm install @hale-bopp/valentino-engine

# Unified report: CSS guardrails + tokens + security in one command
valentino report ./styles/theme.css

# Same, but skip :root token definitions (avoid false positives)
valentino report index.html --allow-token-definitions

# Machine-readable JSON output
valentino report index.html --json --allow-token-definitions

# Visual audit on a live URL
valentino visual-audit http://localhost:8765

# Responsive visual audit (desktop 1440 + tablet 768 + mobile 390)
valentino visual-audit http://localhost:8765 --responsive --json

# Audit CSS only
valentino audit ./styles/theme.css --allow-token-definitions

# Audit HTML (inline styles + <style> tags)
valentino audit-html index.html --allow-token-definitions

# WCAG contrast check
valentino contrast "#333333" "#ffffff" AA

# Start MCP server (22 tools, stdio)
valentino mcp
```

## CLI Commands (24)

### Audit & Report

| Command | Description |
|---------|-------------|
| `valentino audit <file.css> [--fix] [--no-backup] [--allow-token-definitions]` | Audit CSS for guardrail violations |
| `valentino audit-html <file.html> [--fix] [--no-backup] [--allow-token-definitions]` | Audit HTML (inline styles + `<style>` tags) |
| `valentino report <file> [--json] [--allow-token-definitions]` | Unified report: audit + tokens + security |
| `valentino visual-audit <file\|URL> [--responsive] [--json]` | Playwright visual audit (overflow, collision, contrast) |
| `valentino certify --security <file>` | Security audit: inline styles, event handlers, token overrides |

### Validation & Probes

| Command | Description |
|---------|-------------|
| `valentino validate <spec.json>` | Validate PageSpec V1 contract |
| `valentino validate-tokens <file.css> [--fix]` | Detect circular/self-referencing CSS tokens |
| `valentino probe <rhythm\|hero\|integrity\|all> <spec.json>` | Structural validation probes |
| `valentino contrast <fg> <bg> [AA\|AAA]` | WCAG 2.1 contrast ratio |
| `valentino guardrails` | List the 10 Sovereign Guardrails |

### Design Tools

| Command | Description |
|---------|-------------|
| `valentino figma import --file <json> [--template id]` | Figma JSON -> PageSpec V1 |
| `valentino image generate --prompt "..." [--endpoint url]` | Image generation (placeholder SVG or external) |
| `valentino spool <directory> [--out file]` | Analyze site CSS -> token mapping |
| `valentino theme-audit <pack.json> [--level AA\|AAA]` | Theme-pack WCAG contrast audit |
| `valentino template-audit <file> [--template jinja2\|twig\|ejs]` | Template engine conflict detection |
| `valentino grid-contract init\|verify <file.html>` | Grid layout contract |
| `valentino refactor <file> [--dry-run] [--apply]` | CSS refactor with self-ref guard |

### Interactive

| Command | Description |
|---------|-------------|
| `valentino cockpit <spec.json>` | Conversational REPL |
| `valentino cockpit <spec.json> --serve [--port N]` | Web cockpit (browser UI, default port 3781) |
| `valentino watch <file\|directory>` | File watcher with auto-audit |
| `valentino review-notes new\|add\|export\|stats` | Structured review annotations |

### Server

| Command | Description |
|---------|-------------|
| `valentino mcp` | Start MCP server (22 tools, stdio transport) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass - no violations |
| 1 | Violations found |
| 2 | Tool/runtime error (bad args, file not found, etc.) |
| 3 | Browser/Playwright not available |

## MCP Server (22 Tools)

Connect any MCP-compatible AI agent:

```json
{
  "mcpServers": {
    "valentino-engine": {
      "command": "npx",
      "args": ["@hale-bopp/valentino-engine", "mcp"]
    }
  }
}
```

### Audit & Report Tools

| Tool | Description |
|------|-------------|
| `valentino_audit_css` | Audit CSS for hardcoded px, hex/rgba, named colors. Supports `allowTokenDefinitions`. |
| `valentino_audit_html` | Audit HTML (`<style>` + inline). Supports `allowTokenDefinitions`. |
| `valentino_report` | Unified report on a file (CSS guardrails + tokens + security). JSON output. |
| `valentino_visual_audit` | Playwright visual audit on HTML content or live URL. Supports `responsive` mode. |
| `valentino_validate_tokens` | Detect circular/self-referencing CSS custom properties |
| `valentino_validate_pagespec` | Validate PageSpecV1 contract |

### WCAG & Contrast Tools

| Tool | Description |
|------|-------------|
| `valentino_check_contrast` | WCAG 2.1 contrast ratio (AA/AAA) |
| `valentino_theme_audit` | Theme-pack contrast audit across all surfaces |
| `valentino_probe_contrast_usage` | Find text/accent variables used without surface remaps |

### Probe Tools

| Tool | Description |
|------|-------------|
| `valentino_probe_rhythm` | Section sequence rhythm validation |
| `valentino_probe_hero` | Hero section contract (CTA, copy density) |
| `valentino_probe_integrity` | Per-type structural validation |
| `valentino_probe_all` | All probes combined |

### Design & Utility Tools

| Tool | Description |
|------|-------------|
| `valentino_resolve_catalog` | Resolve PageSpec with catalog blueprints |
| `valentino_resolve_route` | URL route -> page ID |
| `valentino_get_skill` | Design skill rules (premium-design, web-guardrails, design-guidelines) |
| `valentino_list_guardrails` | List 10 Sovereign Guardrails from SSoT |
| `valentino_self_check` | Engine self-diagnostics PASS/FAIL |
| `valentino_recommend` | Guided CSS recommendations (suggestions, not errors) |
| `valentino_live_check` | Real-time CSS check while writing (fragments OK) |
| `valentino_import_figma` | Figma file -> PageSpec V1 |
| `valentino_generate_image` | Image generation (placeholder SVG or external endpoint) |

## Library API

```typescript
import {
  // CSS Guardrails (with allowTokenDefinitions option)
  checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor,
  type GuardrailOptions,

  // HTML Audit
  auditHtml, fixHtml,

  // Unified Report
  generateReport, formatReport,
  type UnifiedReport, type ReportOptions,

  // Visual Audit (URL + responsive)
  runVisualAudit, runResponsiveAudit, formatVisualAudit,
  EXIT_CODES,
  type VisualAuditResult, type ResponsiveAuditResult,

  // Validation
  validatePageSpec, checkWcagContrast,

  // Token Validation
  validateTokens, fixSelfReferences,

  // Security Certification
  certifySecurity, certifySecurityCss,

  // Probes
  probeRhythm, probeHeroContract, probeSectionIntegrity,

  // Catalog & Presentation
  resolvePageSpecWithCatalog, resolvePresentation,

  // Types
  type PageSpecV1, type SectionSpec, type ValentinoCatalogV1,
} from '@hale-bopp/valentino-engine';
```

## The `--allow-token-definitions` Flag

By default, Valentino flags ALL hardcoded px/color values, including CSS custom property definitions in `:root`:

```css
:root {
  --vr-12: 12px;        /* flagged as "hardcoded px" */
  --vc-accent: #0072bc; /* flagged as "hardcoded color" */
}
```

These are **token definitions**, not hardcoded application values. Use `--allow-token-definitions` to skip them:

```bash
valentino report index.html --allow-token-definitions
valentino audit theme.css --allow-token-definitions
valentino audit-html index.html --allow-token-definitions
```

In the MCP tools, pass `allowTokenDefinitions: true`.

In the API, pass `{ allowTokenDefinitions: true }` to any check function:

```typescript
const violations = checkNoHardcodedPx(css, { allowTokenDefinitions: true });
```

## Responsive Visual Audit

`--responsive` runs the audit at 3 viewports:

| Viewport | Width | Height |
|----------|-------|--------|
| Desktop | 1440 | 900 |
| Tablet | 768 | 1024 |
| Mobile | 390 | 844 |

```bash
valentino visual-audit http://localhost:8765 --responsive --json
```

Detects per-viewport: horizontal overflow, element collisions, WCAG contrast violations.

Requires Playwright:

```bash
npm install --save-dev playwright && npx playwright install chromium
```

## Consumers

Projects that use Valentino Engine:

| Project | How | Purpose |
|---------|-----|---------|
| easyway-portal | npm dependency, API | PageSpec rendering, design token enforcement |
| sn-desk | npm dependency, CLI | CSS/HTML audit, visual audit |
| AI agents (via MCP) | MCP server | Automated CSS review, visual regression checks |
| CI pipelines | CLI + exit codes | Guardrail gate before merge |

## FAQ / Troubleshooting

### "70+ violations on my `:root` token definitions"

Use `--allow-token-definitions`. Valentino treats `--vr-12: 12px` as hardcoded px by default. The flag skips lines that are CSS custom property declarations.

### "visual-audit treats my URL as a file path"

Make sure the URL starts with `http://` or `https://`. Valentino auto-detects: if it looks like a URL, it uses Playwright `page.goto()`; otherwise it reads the file.

### "Cannot read properties of undefined (reading 'violations')"

This was a bug in pre-2.12.0. The visual audit now returns a structured error with `phase` field telling you exactly where it failed: `browser-launch`, `page-create`, `content-load`, or `audit-script`.

### "Visual audit skipped: Playwright not installed"

Install Playwright: `npm install --save-dev playwright && npx playwright install chromium`. The audit gracefully skips (exit code 3) when Playwright is unavailable.

### "MCP returns wrong branch strategy for valentino-engine"

The MCP reads `factory-vcs.json` from canonical paths. If it returns stale data, restart the MCP server. Since v2.12.0, stale bundled copies are no longer used as silent fallback.

### "How do I get JSON output?"

Add `--json` to `report` or `visual-audit` commands:

```bash
valentino report index.html --json
valentino visual-audit http://localhost:8765 --responsive --json
```

MCP tools always return JSON.

## The 10 Sovereign Guardrails

1. **WhatIf di Layout** -- Wireframe first, code second
2. **Component Boundary & Fallbacks** -- Error Boundaries on all API bridges
3. **Design Token System** -- No hardcoded colors or px values
4. **L3 Audit before Commit** -- ARIA, performance, and dependency check
5. **Architecture Review** -- Escalate trade-offs before committing
6. **Zero UI-Debt** -- Reuse before creating
7. **Electrical Socket Pattern** -- CSS root variables for all colors
8. **Testudo Formation** -- No inline padding/margin overrides on containers
9. **Tangible Legacy** -- No redundant CSS blocks
10. **Visual Live Audit** -- Playwright or `valentino visual-audit`

## Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) -- EasyWay Platform Team

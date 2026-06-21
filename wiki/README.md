---
title: "valentino-engine -- Wiki Figlia"
status: active
created: "2026-06-20"
owner: agent_valentino
lifecycle: stable
inherits_from: easyway/wiki/
doctrine: wiki-sovereignty v1.0.0
---

# valentino-engine -- Wiki Figlia

> **Sovrana**: questa wiki vive di vita propria. Chi clona valentino-engine ha tutto qui.

## A cosa serve

Valentino Engine e' un **audit tool per CSS/HTML e un design engine** che impone l'uso di design token, verifica accessibilita' WCAG, e valida la struttura delle pagine. Funziona come CLI (24 comandi), MCP server (22 tool per agenti AI), e libreria TypeScript. Non ha dipendenze da framework (no React, no Tailwind).

## Owner & lifecycle

- **Owner**: hale-bopp (open source, MIT)
- **Lifecycle**: stable (v2.12.0, 724 test, npm published)
- **Decommissioning trigger**: se EasyWay abbandona il sistema di design token, Valentino perde il suo scopo

## Upstream / downstream

### Upstream (chi consuma questo repo)

| Consumer | Come | Cosa usa |
|----------|------|----------|
| easyway-portal | npm dependency, API | PageSpec rendering, design token enforcement, catalog resolution |
| sn-desk | npm dependency, CLI | CSS/HTML audit, visual audit su portale live |
| AI agents | MCP server (22 tools) | Automated CSS review, visual regression checks, WCAG contrast |
| CI pipelines | CLI + exit codes | Guardrail gate prima di merge (exit 0=pass, 1=fail) |
| easyway-ado MCP | Indirect (agents invoke valentino MCP) | Branch strategy, PR gate |

### Downstream (chi questo repo consuma)

| Dependency | Tipo | Scopo |
|------------|------|-------|
| @modelcontextprotocol/sdk | npm | MCP server stdio transport |
| zod | npm | Input validation per MCP tools |
| playwright | peer (optional) | Visual audit, Visual Guardian, runtime token verify |

## Indice wiki figlia

- [Runbook](runbook.md) -- come build/test/deploy localmente
- [Contracts](contracts.md) -- API/CLI/config esposti + breaking-change policy
- [Lessons](lessons.md) -- lessons specifiche di questo repo (3 lessons da S438)
- [Doctrine inherited](doctrine-inherited.md) -- snapshot doctrine mamma usate qui
- [Component guide](guides/component-valentino.md) -- guida componente

## Doctrine governance

Questa wiki applica wiki-sovereignty:

- **Cosa universale** vive in mamma (G-rules, manifesti cross-agent, handoff).
- **Come locale** vive qui (runbook, contracts, lessons di questo repo).

## Status & versioning

- Version: 2.12.0
- Last review: 2026-06-20 (S438)
- npm: [@hale-bopp/valentino-engine](https://www.npmjs.com/package/@hale-bopp/valentino-engine)

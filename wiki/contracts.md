---
title: "<REPO-NAME> — Contracts esposti"
status: TODO
created: "YYYY-MM-DD"
inherits_from: easyway/wiki/
doctrine: wiki-sovereignty v1.0.0
---

# <REPO-NAME> — Contracts

> **Sovrano**: contratti esposti da questo repo. Consumatori (mamma, altre figlie, agenti) si attaccano a queste interfacce. Breaking change qui = breaking change downstream.

## API HTTP / REST

<!-- TODO: tabella endpoint o "N/A" se nessuno. -->

| Method | Path | Purpose | Request schema | Response schema |
|--------|------|---------|----------------|-----------------|
| | | | | |

## CLI

<!-- TODO: tabella comandi esposti o "N/A". -->

| Comando | Args | Output (text/json) | Exit codes |
|---------|------|--------------------|------------|
| | | | |

## MCP tools (se applicabile)

<!-- TODO: lista tool MCP esposti dal repo. Schema JSON, idempotenza, side effects. -->

## Env vars / config

<!-- TODO: lista env var consumate. Marcare se secret (rotation policy). -->

| Var | Required | Default | Secret | Note |
|-----|----------|---------|--------|------|
| | | | | |

## File / artefatti prodotti

<!-- TODO: file output del repo (log, telemetry jsonl, build artifacts). -->

## Breaking-change policy

<!-- TODO: come si gestisce un breaking change? Semver bump? Deprecation period? Migration guide? -->

- **Detection**: <!-- TODO: chi flagga il breaking change (lint, test, manual review)? -->
- **Communication**: <!-- TODO: come si comunica? handoff `breaking-change`? wiki entry? -->
- **Migration period**: <!-- TODO: quanto deprecation soak? -->

## Consumatori noti (downstream)

<!-- TODO: lista repo/sistemi che consumano questi contratti. Cross-ref con factory-vcs.json _circle. -->

## See also

- [Runbook](runbook.md) — come testare un contratto
- [Lessons](lessons.md) — breaking-change incidents storici
- mamma: [[doctrine-versioning-taxonomy]] (G35) — semver + status enum
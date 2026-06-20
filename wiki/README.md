---
title: "<REPO-NAME> — Wiki Figlia"
status: TODO  # active | draft | deprecated
created: "YYYY-MM-DD"
owner: TODO   # team o agent owner
lifecycle: TODO  # experimental | stable | maintenance | sunset
inherits_from: easyway/wiki/  # mamma SSoT cross-agent (read-only reference)
doctrine: wiki-sovereignty v1.0.0  # [[wiki-sovereignty]] in mamma
---

# <REPO-NAME> — Wiki Figlia

> **Sovrana**: questa wiki vive di vita propria. Chi clona <REPO-NAME> ha tutto qui. La mamma `easyway/wiki/` è una *referenza*, non una *dipendenza*. Vedi [[wiki-sovereignty]] (manifesto).

## A cosa serve

<!-- TODO: 1-2 frasi. Cosa fa questo repo, perché esiste. NON copiare README.md del codice — qui ragioniamo a livello documentale/cognitivo. -->

## Owner & lifecycle

- **Owner**: <!-- TODO: team o agent (es. agent_scrummaster, founder, team_devops) -->
- **Lifecycle**: <!-- TODO: experimental / stable / maintenance / sunset -->
- **Decommissioning trigger**: <!-- TODO opzionale: cosa lo rende obsoleto? -->

## Upstream / downstream

- **Upstream** (chi consuma questo repo): <!-- TODO: lista repo o sistemi -->
- **Downstream** (chi questo repo consuma): <!-- TODO: lista repo, MCP, servizi -->

## Indice wiki figlia

- [Runbook](runbook.md) — come build/test/deploy localmente
- [Contracts](contracts.md) — API/CLI/config esposti + breaking-change policy
- [Lessons](lessons.md) — lessons specifiche di questo repo
- [Doctrine inherited](doctrine-inherited.md) — snapshot doctrine mamma usate qui

## Doctrine governance

Questa wiki applica [[wiki-sovereignty]] (mamma `easyway/wiki/guides/governance/wiki-sovereignty.md`):

- **Cosa universale** vive in mamma (G-rules, manifesti cross-agent, handoff).
- **Come locale** vive qui (runbook, contracts, lessons di questo repo).
- Lesson che diventa universale (≥3 repo): promotion via handoff `promote-to-mother` in `_handoffs/landing/`. Vedi [[wiki-sovereignty]] § Promotion bottom-up.

## Status & versioning

- Version: <!-- TODO semver opzionale -->
- Last review: <!-- TODO data ultima revisione wiki -->
- Test sovranità: <!-- TODO data + esito Test 1-3 di wiki-sovereignty § Test scenari -->
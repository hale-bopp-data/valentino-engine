---
title: "Valentino — The Frontend Architect"
created: 2026-03-22
updated: "2026-05-27"
session: S165
migration_session: S207
migrated_from: "easyway/wiki/guides/component-valentino.md"
status: active
type: component
rag_categories:
  - agents
  - architecture
  - data
answers:
  - "Valentino e un agente o un prodotto? Cosa fa esattamente?"
  - "Cos'e Valentino in EasyWay?"
  - "Cosa fa il Valentino Framework?"
  - "Chi gestisce il frontend del portal?"
superseded_by: null
tags: []
---

## Cosa

**Valentino** e sia un **agente** che un **framework frontend**. E il Frontend Architect di EasyWay — governa qualita, accessibilita e design del portale.

- Come **agente**: opera nella pipeline CI/CD, blocca PR con regressioni visive
- Come **framework**: definisce i pattern frontend (Web Components nativi, zero dipendenze inutili)

Motto: *"L'eleganza non e aggiungere, ma togliere il superfluo."*

## Come Funziona

### I 4 Guardiani (sotto-agenti)

```
PR portal merge request
  → Visual Guardian (Playwright) — screenshot pixel-perfect, blocca se 1px di differenza
  → Inclusive Guardian (Axe-Core) — accessibilita WCAG 2.1 AA
  → Chaos Guardian (Gremlins.js) — test resilienza (antifragilita)
  → Code Guardian (Husky) — lint, format, quality gate
  → Tutti passano → merge consentito
  → Uno fallisce → merge bloccato, report con motivo
```

### Modalita operative

| Modalita | Quando | Cosa fa |
|---|---|---|
| **Review** | PR su easyway-portal | Lancia i 4 guardiani, blocca/approva |
| **Scaffolding** | Nuovo componente | Genera componente da blueprint (Web Components nativi) |
| **Audit** | Su richiesta | `valentino-audit.sh <audit-id>` — healthcheck + visual + whatfirst lint |

### Script e API

| Script | Dove | Cosa fa |
|---|---|---|
| `valentino-audit.sh` | `src/scripts/` | CLI runner per audit pipeline |
| `valentino-check.ps1` | `src/scripts/qa/` | Wrapper Playwright per audit focali |
| Healthcheck | `http://localhost:8080` (frontend), `http://localhost:3001` (API) | Endpoint health |

## Perche

Il frontend e la faccia del sistema — la prima cosa che un utente vede. Senza governance:
- Regressioni visive passano inosservate
- Accessibilita degrada (WCAG violations)
- Dipendenze crescono senza controllo (`npm install random-library`)

Valentino implementa il principio *"Haute Couture Engineering"*: ogni pixel e intenzionale, ogni dipendenza e giustificata.

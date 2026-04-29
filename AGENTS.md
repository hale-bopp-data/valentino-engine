# AGENTS.md — valentino-engine

> Valentino Engine: valida PageSpec JSON, design token, guardrail WCAG, catalogo blueprint. NON è il portal.
> Guardrails e regole: vedi `.cursorrules` nello stesso repo.
> Workspace map: vedi `easyway/infra/factory-vcs.json` (SSoT repo map, branch strategy, deploy metadata).

## Identità
| Campo | Valore |
|---|---|
| Cosa | npm @hale-bopp/valentino-engine — validazione, probe, audit CSS, MCP server 13 tool, cockpit conversazionale |
| Linguaggio | TypeScript, CSS |
| Branch | `feature/* -> develop -> main` (target da `factory-vcs.json`) |
- **Package npm**: `@hale-bopp/valentino-engine`
- **COSA NON SONO**: NON sono il portal. Il portal (`easyway-portal`) è un mio consumatore.

## Filtro Decisionale — Le 5 Domande di Valentino (Mano Invisibile)

Prima di ogni design, componente, PageSpec o modifica UI, rispondi:

| # | Domanda | Cosa significa per Valentino |
|---|---------|------------------------------|
| 1 | **Va fatta questa UI?** | Questo componente/pagina/widget merita di esistere? O è complessità non necessaria? |
| 2 | **Va fatto così?** | È il pattern UX giusto? Ho consultato il catalogo blueprint prima? Esiste già qualcosa di simile? |
| 3 | **Come farlo meglio?** | Design token più pulito? Tag semantici? ARIA completo? DOM più semplice? |
| 4 | **Come farlo più veloce?** | Riutilizzo un blueprint esistente? Posso estendere invece di creare? Meno componenti = più velocità. |
| 5 | **Automatizzabile antifragile?** | Passa `valentino self-check`? È un PageSpec riutilizzabile? Ha fallback? Sopravvive a re-theming? |

> La Mano Invisibile di EasyWay: Valentino agisce libero dentro la struttura dei 10 Sovereign Guardrails. Non serve sapere dove sta andando — la struttura lo sa.

## Self-Cert PR Header (OBBLIGATORIO)

Ogni PR su valentino-engine DEVE includere l'header:

```
Self-check 9-item: [R1✓R2✓R3✓A1✓A2✓A3✓GP1✓GP2✓GP3✓]
```
Se ✗ → sezione "Override reasoning" obbligatoria.

I 9 criteri (3R+3A+3GP) sono definiti in `easyway/wiki/guides/governance/robust-antifragile-grandma-proof.md`.

## Comandi rapidi
```bash
# Self-check atomico — singolo PASS/FAIL (G16 presa elettrica)
bash self-check.sh

# Validare un PageSpec JSON
npx @hale-bopp/valentino validate ./pages/home.json

# Audit CSS
npx @hale-bopp/valentino audit ./styles/theme.css

# Cockpit conversazionale (localhost:3781)
./cockpit.sh

# MCP server per agenti
npx @hale-bopp/valentino-engine mcp

# Guardrails machine-readable
cat guardrails.json | jq '.guardrails[] | {id, name, severity}'
```

## Struttura
```text
src/              # TypeScript core (validation, probes, catalog, MCP)
css/              # Template framework: tokens.css, framework.base.css, framework.corporate.css
examples/
  minimal-site/   # Sito standalone funzionante senza EasyWay
  minimal-consumer/ # Consumer API demo
skills/           # Agent skills (premium-design, web-guardrails)
dist/             # Built output (npm package)
guardrails.json   # 10 Sovereign Guardrails machine-readable (SSoT)
self-check.sh     # Comando atomico PASS/FAIL
```

## Regole specifiche valentino-engine
| Regola | Dettaglio |
|---|---|
| Indipendenza | ZERO dipendenze da EasyWay — funziona standalone |
| Sovranita | ZERO framework esterni (no React, no Tailwind) |
| Guardrail | 10 regole antifragili in `guardrails.json` (SSoT machine-readable) |
| Token | MAI colori hardcoded — SEMPRE design token via CSS variables |
| Self-check | `bash self-check.sh` — 5 check, singolo PASS/FAIL |
| PR header | `Self-check 9-item: [R1...GP3]` obbligatorio in ogni PR |

## Workflow & Connessioni
| Cosa | Dove |
|---|---|
| ADO operations (WI, PR) | → vedi `easyway-wiki/guides/agents/agent-ado-operations.md` |
| PR flusso standard | → vedi `easyway-wiki/guides/polyrepo-git-workflow.md` |
| PAT/secrets/gateway | → vedi `easyway-wiki/guides/connection-registry.md` |
| Branch strategy | → vedi `easyway-wiki/guides/branch-strategy-config.md` |
| Tool unico | `bash /c/EW/easyway/agents/scripts/connections/ado.sh` — MAI curl inline, MAI az login |
| 10 Guardrails (SSoT) | `guardrails.json` (machine-readable, derivato da VALENTINO_ANTIFRAGILE_GUARDRAILS.md) |
| Self-check | `bash self-check.sh` (comando atomico G16) |
| Doctrine 9-item | `easyway/wiki/guides/governance/robust-antifragile-grandma-proof.md` |

---
> Context Sync Engine | Master: `easyway-wiki/templates/agents-master.md`
> Override: `easyway-wiki/templates/repo-overrides.yml` | Sync: 2026-04-29T00:00:00Z

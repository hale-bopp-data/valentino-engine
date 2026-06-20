---
title: "valentino-engine -- Lessons locali"
status: active
created: "2026-06-20"
inherits_from: easyway/wiki/
doctrine: wiki-sovereignty v1.0.0
---

# valentino-engine -- Lessons

> **Sovrano**: lessons specifiche di *questo* repo.

## Indice

| Date | Title | Promotion candidate? |
|------|-------|----------------------|
| 2026-06-20 | factory-vcs.json silent fallback causa drift branch strategy | yes (applicable >=3 repo) |
| 2026-06-20 | Token definitions vs hardcoded values: false positive costante | no (valentino-specific) |
| 2026-06-20 | MCP tool senza visual-audit URL = guardrail inutilizzabile | no (valentino-specific) |

## Lessons

### 2026-06-20: factory-vcs.json silent fallback causa drift branch strategy

**Contesto**: `ado_branch_strategy valentino-engine` restituiva `2-tier target:main` nonostante il SSoT canonical (`easyway/infra/factory-vcs.json`) dicesse `3-tier target:develop`. Un agente ha creato una PR che ha saltato develop, andando direttamente su main.

**Root cause**: il codice in `branch-strategy.ts` aveva un fallback silente a una copia bundled (`ado/scripts/factory-vcs.json`). Quella copia aveva valentino-engine rimosso (S273, "decommissioned"), quindi il codice tornava al default `main/2-tier` senza errore.

**Fix**: PR #4919 -- rimosso il fallback silente. Se nessun path canonical trovato, `throw Error(...)` con lista path tentati. Build sync da canonical confermato funzionante.

**Lesson**: mai fallback silenti su config che determina target di merge. Un errore chiaro e' meglio di dati stale serviti senza avviso. Il pattern "graceful degradation" non si applica a routing decisions -- li' serve fail-loud.

**Promotion candidate**: yes. Applicabile a qualsiasi sistema con copie bundled di config (easyway-ado, easyway-agents, easyway-infra). Tag: [config-drift] [fail-loud] [branch-strategy]

---

### 2026-06-20: Token definitions vs hardcoded values: false positive costante

**Contesto**: `valentino report index.html` su SN Desk produceva 74 violazioni, quasi tutte su definizioni di token CSS dentro `:root`:
```css
:root {
  --vr-12: 12px;        /* segnalato come "hardcoded px" */
  --vc-accent: #0072bc; /* segnalato come "hardcoded color" */
}
```
Queste sono definizioni di token, non hardcoding applicativo.

**Root cause**: i guardrail check (`checkNoHardcodedPx`, `checkNoHardcodedColor`, `checkNoNamedColor`) operano riga per riga senza context awareness -- non distinguono `:root { --var: value }` da `.class { padding: 12px }`.

**Fix**: PR #4917 -- aggiunto `GuardrailOptions.allowTokenDefinitions`. Quando attivo, le righe che matchano `^\s*--[\w-]+\s*:` (custom property declarations) vengono saltate. Flag `--allow-token-definitions` su CLI, `allowTokenDefinitions` su MCP.

**Lesson**: un guardrail che produce 70+ false positive su un file tipico e' peggio di nessun guardrail -- gli agenti imparano a ignorare l'output. Il rapporto segnale/rumore e' critico per l'adozione.

**Promotion candidate**: no (valentino-specific).

---

### 2026-06-20: MCP tool senza visual-audit URL = guardrail inutilizzabile

**Contesto**: un agente voleva fare visual audit su un portale SN Desk live (`http://127.0.0.1:8765`). Il MCP non aveva un tool `valentino_visual_audit`. Il CLI `valentino visual-audit` accettava solo file path, trattando l'URL come path. Il Visual Guardian richiedeva `renderHtml` callback. Risultato: nessun modo pratico per un agente di verificare visualmente una pagina live.

**Root cause**: il visual audit era stato progettato per HTML statico (`page.setContent(html)`), non per URL live (`page.goto(url)`). L'MCP esponeva 20 tool ma nessuno per visual audit.

**Fix**: PR #4917 -- aggiunto `valentino_visual_audit` MCP tool (accetta `html` o `url`), CLI accetta URL direttamente, `runVisualAudit()` auto-detecta URL da `http(s)://` prefix, aggiunto `runResponsiveAudit()` per multi-viewport.

**Lesson**: se un agente non puo' chiamare un guardrail via MCP, quel guardrail non esiste per lui. "Installato ma non callable" = non installato. Ogni guardrail deve essere: CLI + MCP + API.

**Promotion candidate**: no (valentino-specific, ma il principio "callable = exists" e' universale).

## Promotion log

| Date promoted | Lesson title | Target path mamma | Handoff ID |
|---------------|--------------|-------------------|------------|
| | | | |

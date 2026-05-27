---
title: "<REPO-NAME> — Doctrine ereditate (snapshot mamma)"
status: TODO
created: "YYYY-MM-DD"
inherits_from: easyway/wiki/
doctrine: wiki-sovereignty v1.0.0
snapshot_warning: "Questo è uno SNAPSHOT. La source-of-truth aggiornata vive in easyway/wiki/. Verifica drift periodicamente o quando consulti un'estratto."
---

# <REPO-NAME> — Doctrine ereditate

> **Sovrano + antifragile**: questo file replica gli **estratti** delle doctrine mamma che *questo repo usa attivamente*. Se la mamma cade, qui resta autonomia locale. La replica è il prezzo della sovranità ([[wiki-sovereignty]] § Perché antifragile).

## Come leggere questo file

- Ogni estratto ha header `### Doctrine: <nome>` con:
  - `source`: path in mamma
  - `snapshot_date`: data dello snapshot
  - `mamma_version`: versione della doctrine al momento dello snapshot
  - `usage_in_repo`: 1 riga — *perché* questo repo la usa
- Il contenuto **non** è la doctrine intera — solo le 5-30 righe rilevanti per questo repo.
- Drift detection: cron periodico ([[doc-drift-detect]]) confronta mamma vs snapshot e segnala.

## Anti-pattern da evitare

- ❌ Replicare TUTTA una doctrine mamma → red flag se file >50 KB (vedi [[wiki-sovereignty]] § Mitigations).
- ❌ Modificare l'estratto come fosse la mamma → la mamma è SSoT, qui solo snapshot.
- ❌ Aggiungere doctrine universali nuove qui → quelle vivono in mamma. Se nasce qui ed è universale, promotion (vedi [[wiki-sovereignty]] § Promotion bottom-up).

## Doctrine ereditate

<!-- TODO: una sezione per ogni doctrine mamma usata da questo repo. Pattern: -->

<!--
### Doctrine: <nome-doctrine>

- **source**: `easyway/wiki/guides/<path>.md`
- **snapshot_date**: YYYY-MM-DD
- **mamma_version**: 1.0.0
- **usage_in_repo**: <!-- TODO: 1 riga — perché questo repo usa questa doctrine -->

> [estratto verbatim 5-30 righe dalla mamma]
-->

## Drift log

<!-- TODO: traccia degli aggiornamenti snapshot quando mamma evolve. -->

| Date | Doctrine | Mamma version delta | Action |
|------|----------|---------------------|--------|
| | | | |

## See also

- mamma: [[wiki-sovereignty]] — manifesto sovranità
- mamma: [[doctrine-versioning-taxonomy]] (G35) — semver doctrine
- mamma: [[doc-drift-detect]] — cron drift detection
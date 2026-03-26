# Decommissioning: Portal CMS → valentino-engine

> Piano per staccare la logica CMS dal portal e rendere valentino-engine l'unica source of truth.

## Stato attuale (post PBI #606 + #630)

| Componente | Dove vive | Note |
|---|---|---|
| Tipi (PageStatus, RedirectRule, MediaAsset, SeoSpec) | **engine** | Portal re-esporta |
| Funzioni pure (getPageStatus, isPageVisible, findRedirect, resolveMedia, buildWebPageSchema) | **engine** | Portal usa facade |
| CMS Guardrails pure (draft, publishAt, 404, redirects, SEO, maintenance) | **engine** | Portal ha ancora wrapper I/O |
| Extension Registry | **engine** | Nuovo, standalone |
| I/O (loadRedirects, loadMediaManifest) | **portal** | Resta nel consumer |
| DOM (applyPageSeo, applySchemaOrg, renderBreadcrumb) | **portal** | Resta nel consumer |
| Schema JSON (manifest, page spec) | **portal** | Allineati con tipi engine |

## Checklist import (verificata)

| File portal | Import da engine | Cast (as any) rimossi |
|---|---|---|
| `types/runtime-pages.ts` | 34 tipi re-esportati | 0 |
| `utils/runtime-pages.ts` | 8 funzioni + 6 tipi | 3 cast rimossi (#630) |
| `utils/pages-loader.ts` | normalizePathname, resolvePageIdByRoute | 0 |
| `utils/pages-renderer.ts` | DEFAULT_PRESENTATION, inferRhythmProfile, resolvePresentation | 0 |
| `utils/valentino-catalog.ts` | mergePresentation, isGovernanceAllowed, resolvePageSpecWithCatalog | 0 |

## Breaking changes per consumer esterni

Se usi `@hale-bopp/valentino-engine` >= 1.2.0:

| Cambio | Impatto | Azione |
|---|---|---|
| `ManifestPageV1` ha nuovi campi opzionali (status, publishAt, seo) | Nessuno (opzionali) | Nessuna |
| `PagesManifestV1` ha `maintenanceMode` opzionale | Nessuno | Nessuna |
| `PageSpecV1` ha `seo` opzionale | Nessuno | Nessuna |
| `resolveMediaUrl(manifest, key)` richiede manifest come primo arg | **Breaking** se usavi la vecchia firma | Passa il manifest |
| `isPageVisible(page, { devMode })` accetta opzioni | Nessuno (opzionale) | Nessuna |

## Rollback plan

Se qualcosa si rompe dopo il decommissioning:

1. **Immediato**: il portal ha ancora le facade function in `runtime-pages.ts`. Basta ri-commentare gli import engine e de-commentare le implementazioni locali.
2. **Build dependency**: tornare a `file:` path in `package.json` se npm version causa problemi.
3. **Schema**: rimuovere i nuovi campi dagli schema JSON (sono opzionali, non rompono i dati esistenti).

## Prossimi passi (quando pronti)

1. ~~Completare migrazione logica pura (#606)~~ DONE
2. ~~Allineare schema JSON (#630)~~ DONE
3. ~~Rimuovere cast (as any) (#630)~~ DONE
4. Pubblicare engine su npm come `@hale-bopp/valentino-engine@2.0.0`
5. Portal: cambiare da `file:` a `npm:` dependency
6. Rimuovere facade re-export in `types/runtime-pages.ts` (import diretto dall'engine)
7. Portal: eliminare CMS guardrails I/O wrapper duplicati (usare engine + custom I/O via extension registry)

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

## Checklist import (verificata — aggiornata #634)

| File portal | Import da engine | Note |
|---|---|---|
| `types/runtime-pages.ts` | Solo `AdvisorResponseStatus` | 2 tipi portal-only restano qui |
| `utils/runtime-pages.ts` | 8 funzioni + 6 tipi diretti da engine | CMS logic completa |
| `utils/pages-loader.ts` | normalizePathname, resolvePageIdByRoute | Re-export |
| `utils/pages-renderer.ts` | 18 tipi + DEFAULT_PRESENTATION, inferRhythmProfile, resolvePresentation | Advisor types restano locali |
| `utils/valentino-catalog.ts` | mergePresentation, isGovernanceAllowed, resolvePageSpecWithCatalog | Re-export |
| `editor/editor-app.ts` | 7 funzioni + 5 tipi da engine (#602) | Editor utilities |
| `components/sovereign-header.ts` | Nav types da engine | Diretto |
| `stories/hero.stories.ts` | HeroSection type | Diretto |
| `utils/mermaid-renderer.ts` | MermaidDiagramSection type | Diretto |
| `utils/theme-packs-loader.ts` | PageSpecV1 type | Diretto |

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
4. ~~Pubblicare engine su npm come `@hale-bopp/valentino-engine@2.1.0`~~ DONE
5. ~~Portal: switch a `@hale-bopp/valentino-engine@^2.1.0` (#634)~~ DONE — import diretti, facade rimosso, `types/runtime-pages.ts` ridotto a 2 tipi portal-only
6. ~~Rimuovere facade re-export in `types/runtime-pages.ts`~~ DONE — file contiene solo `AdvisorRequestPayload` e `AdvisorResponsePayload`
7. Portal: eliminare CMS guardrails I/O wrapper duplicati (usare engine + custom I/O via extension registry)

/**
 * Valentino Engine — Public API
 * Entry point for programmatic usage.
 */

// Types (full type system from portal)
export type {
    ActionSpec, CtaSpec, ActionWidgetIcon, ActionWidgetVariant, ActionWidgetSpec,
    SectionPresentationSpec, SectionPresentationBase,
    LayoutMapMeasureToken, LayoutMapVariantToken, LayoutMapPlacementSpec,
    LayoutMapStyleSpec, LayoutMapSlotSpec, LayoutMapGridSpec,
    LayoutMapBreakpointSpec, LayoutMapSpec,
    HeroGuardrailToken, HeroGeometryAnchorId, HeroGeometryAnchorSpec,
    HeroGeometryBreakpointSpec, HeroGeometrySpec,
    HeroSection, CardsCatalogItem, CardsLinkRailItem, CardsSection,
    ComparisonSection, CtaSection, FormFieldSpec, FormSection,
    SpacerSection, ManifestoSection,
    ComponentVariant, ComponentShowcaseItem, ShowcaseIntroSection, ComponentShowcaseSection,
    AgentDashboardSection, AgentGraphSection, AgentListSection,
    DataListColumnSpec, RowActionSpec, DataListSection,
    ActionFormFieldSpec, ActionFormSection,
    StatItemSpec, StatsSection,
    HowItWorksStepSpec, HowItWorksSection,
    AdvisorPromptSpec, AdvisorResponseStatus, AdvisorResponseLabelsSpec, AdvisorSection,
    MermaidDiagramSection,
    ValentinoCatalogSection,
    SectionSpec, PageProfileSpec, PageSpecV1,
    ValentinoGovernanceTier, ValentinoGovernanceSpec,
    ValentinoTemplateEntry, ValentinoSectionPresetEntry,
    ValentinoTransitionProfileEntry, ValentinoPageBlueprintEntry, ValentinoCatalogV1,
    ManifestPageV1, NavigationConfigV1, PagesManifestV1,
    NavInteractionModeV1, NavPanelVariantV1, NavPanelWidthTokenV1,
    NavPanelLayoutTokenV1, NavLinkDensityTokenV1,
    NavPanelLinkV1, NavPanelGroupV1, NavFeaturedCardV1, NavItemV1,
} from './core/types.js';

// Catalog resolver
export { mergePresentation, isGovernanceAllowed, resolvePageSpecWithCatalog } from './core/catalog.js';

// Presentation resolver
export { DEFAULT_PRESENTATION, inferRhythmProfile, resolvePresentation } from './core/presentation.js';

// Manifest resolver
export { normalizePathname, resolvePageIdByRoute } from './core/manifest.js';

// PageSpec validation (legacy + V1)
export { validatePageSpec } from './core/page-spec.js';

// Guardrails
export { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor, GUARDRAILS } from './core/guardrails.js';
export { CSS_NAMED_COLORS } from './core/css-named-colors.js';

// Validation probes
export { checkWcagContrast, parseColor, relativeLuminance, contrastRatio } from './core/contrast.js';
export type { ContrastLevel, ContrastResult } from './core/contrast.js';
export { probeRhythm } from './core/rhythm.js';
export type { RhythmWarning, RhythmProbeResult } from './core/rhythm.js';
export { probeHeroContract } from './core/hero-contract.js';
export type { HeroContractWarning, HeroContractResult } from './core/hero-contract.js';
export { probeSectionIntegrity } from './core/section-integrity.js';
export type { IntegrityWarning, IntegrityResult } from './core/section-integrity.js';

// Skills
export { premiumDesignSkill, webGuardrailsSkill, designGuidelinesSkill } from './skills/index.js';

// CMS — Page status workflow (PBI #606)
export { getPageStatus, getPublishAt, isPageVisible } from './core/page-status.js';
export type { PageStatus } from './core/page-status.js';

// CMS — Redirects (PBI #606)
export { findRedirect } from './core/redirects.js';
export type { RedirectRule, RedirectsConfig } from './core/redirects.js';

// CMS — Media resolver (PBI #606)
export { resolveMediaUrl, resolveMediaAsset } from './core/media.js';
export type { MediaAsset, MediaManifest } from './core/media.js';

// CMS — SEO types + Schema.org builder (PBI #606)
export { buildWebPageSchema } from './core/seo.js';
export type { SeoSpec } from './core/seo.js';

// CMS — Guardrails pure rules (PBI #606, extended PBI #605)
export {
    checkDraftOrphans, checkPublishAtCoherence, checkMaintenanceModeLeak,
    check404Exists, checkRedirects, checkSeoCompleteness,
    checkOgImageExists, checkMediaOrphans, checkMediaMissingAlt,
    checkBreadcrumbDepth, checkLanguageCoverage, checkDuplicateRoutes,
    collectPureCmsWarnings,
} from './core/guardrails-cms.js';
export type { CmsWarning } from './core/guardrails-cms.js';

// Encoding guardrail — mojibake + typography (PBI #629)
export { checkMojibake, checkTypography, checkEncoding, MOJIBAKE_PATTERN_COUNT, TYPO_RULE_COUNT } from './core/encoding.js';
export type { EncodingWarning } from './core/encoding.js';

// LLMs.txt generator (PBI #614)
export { generateLlmsTxt, generateLlmsFullTxt } from './core/llms-generator.js';
export type { LlmsGeneratorOptions } from './core/llms-generator.js';

// Animation presets (PBI #611)
export { probeAnimations, resolveAnimationCSS, ANIMATION_PRESETS } from './core/animation.js';
export type { AnimationWarning } from './core/animation.js';
export type { AnimationPreset, AnimationDelay, AnimationTrigger, AnimationSpec } from './core/types.js';

// Editor utilities (PBI #602)
export {
    getEditableSectionTypes, generateEditorSchema, generateAllEditorSchemas,
    applySectionPatch, addSection, removeSection, moveSection, applyPagePatch,
} from './core/editor.js';
export type {
    EditorFieldType, EditorFieldSpec, EditorSectionSchema,
    SectionPatchWarning, SectionPatchResult,
} from './core/editor.js';

// AI Page Generator (PBI #608)
export { parsePrompt, generatePageSpec, generatePageSpecLocal } from './core/page-generator.js';
export type {
    PageIntent, SectionIntent, GeneratePageOptions, LlmContext, GeneratePageResult,
} from './core/page-generator.js';

// Template Gallery (PBI #610)
export { listCatalogEntries, listPageEntries, listAllGalleryEntries, filterGalleryEntries } from './core/gallery.js';
export type { GalleryEntryKind, GalleryEntry, GalleryFilter } from './core/gallery.js';

// Cockpit API — Conversational Cockpit (Feature #778, PBI #779)
export {
    executeCockpitAction, executeCockpitBatch,
    validateCockpitAction, describeCockpitAction,
    COCKPIT_SECTION_TYPES,
} from './core/cockpit-api.js';
export type {
    CockpitAction, CockpitActionAddSection, CockpitActionEditSection,
    CockpitActionRemoveSection, CockpitActionMoveSection, CockpitActionEditPage,
    CockpitActionQuery, CockpitQuery, CockpitWarning, CockpitActionResult,
    CockpitBatchResult,
} from './core/cockpit-api.js';

// Intent Parser — Natural language → CockpitAction (Feature #778, PBI #780)
export { parseIntent, parseIntentLocal, buildMinimalSection, buildSectionSummary } from './core/intent-parser.js';
export type {
    ParsedIntent, IntentParseResult, IntentLlmCallback, IntentLlmContext,
} from './core/intent-parser.js';

// REPL — Interactive conversational loop (Feature #778, PBI #780)
export { processReplInput, createReplSession, startRepl } from './core/cockpit-repl.js';
export type { ReplOptions, ReplSession } from './core/cockpit-repl.js';

// Visual Import — Screenshot → PageSpecV1 (Feature #784, PBI #785)
export { importFromImage, createVisionCallback } from './core/visual-import.js';
export type { VisualImportResult, VisualImportOptions, VisionLlmCallback } from './core/visual-import.js';

// URL Import — URL → screenshot/HTML → PageSpecV1 (Feature #784, PBI #786)
export { importFromUrl } from './core/url-import.js';
export type { UrlImportResult, UrlImportOptions, HtmlLlmCallback } from './core/url-import.js';

// Project Adapter — HTML/CSS project → PageSpecV1 (Feature #784, PBI #788)
export { importFromProject, scanProjectDirectory, analyzeHtmlStructure } from './core/project-adapter.js';
export type { ProjectScanResult, ProjectPageResult, ProjectAdapterResult, ProjectAdapterOptions } from './core/project-adapter.js';

// OpenRouter Client — LLM integration for intent parsing (Feature #778)
export { createOpenRouterCallback, testOpenRouterConnection } from './core/openrouter-client.js';
export type { OpenRouterConfig } from './core/openrouter-client.js';

// Cockpit Server — HTTP API + Web UI (Feature #778, PBI #781)
export { startCockpitServer } from './cockpit-server.js';
export type { CockpitServerOptions } from './cockpit-server.js';

// Schema Export — JSON Schema for external consumers (Feature #778, PBI #779)
export {
    getPageSpecSchema, getCockpitActionSchema,
    getSectionSchema, getAllSectionSchemas, getSchemaDefinedSectionTypes,
} from './core/schema-export.js';

// Extension Registry (PBI #606)
export {
    createExtensionRegistry,
    registerSectionRenderer, registerGuardrail, registerCustomStatus,
    setContentResolver, setMediaResolver, registerEditorPanel,
    hasCustomRenderer, getCustomRenderer, runCustomGuardrails, getEditorPanels,
} from './core/extension-registry.js';
export type {
    ExtensionRegistry, CustomSectionRenderer, CustomGuardrail, GuardrailContext,
    ContentResolver, MediaResolver, EditorPanelDef,
} from './core/extension-registry.js';

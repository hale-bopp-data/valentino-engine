/**
 * Valentino Engine — Browser Entry Point
 *
 * Re-exports all browser-safe modules (no Node builtins: readline, fs, http, etc.).
 * Use this entry point in browser bundlers (Vite, Rollup, webpack) to avoid
 * pulling in Node-only code.
 *
 * Usage: import { PageSpecV1, validatePageSpec } from '@hale-bopp/valentino-engine/browser';
 */

// Types (full type system)
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
    AnimationPreset, AnimationDelay, AnimationTrigger, AnimationSpec,
} from './core/types.js';

// Catalog resolver
export { mergePresentation, isGovernanceAllowed, resolvePageSpecWithCatalog } from './core/catalog.js';

// Presentation resolver
export { DEFAULT_PRESENTATION, inferRhythmProfile, resolvePresentation } from './core/presentation.js';

// Manifest resolver
export { normalizePathname, resolvePageIdByRoute } from './core/manifest.js';

// PageSpec validation
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

// Theme Audit
export {
    auditThemePack, auditThemePacks,
    validateThemePackAgainstRegistry,
    inferTokenRole, VALENTINO_SURFACES,
} from './core/theme-audit.js';
export type {
    SurfaceKind, SurfaceDefinition, ThemePackTokens, TokenRole,
    ThemeAuditViolation, ThemeAuditResult, RegistryViolation, BatchAuditResult,
} from './core/theme-audit.js';

// Contrast Usage Probe
export {
    probeContrastUsage, probeContrastUsageMulti,
    parseRemappedTokens, parseTextTokenUsages,
    extractShadowDomStyles,
} from './core/contrast-usage-probe.js';
export type { ContrastUsageWarning, ContrastUsageProbeResult, ContrastUsageMultiResult } from './core/contrast-usage-probe.js';

// Skills
export { premiumDesignSkill, webGuardrailsSkill, designGuidelinesSkill } from './skills/index.js';

// CMS — Page status workflow
export { getPageStatus, getPublishAt, isPageVisible, getContrastAuditPages } from './core/page-status.js';
export type { PageStatus, ContrastAuditPage } from './core/page-status.js';

// CMS — Redirects
export { findRedirect } from './core/redirects.js';
export type { RedirectRule, RedirectsConfig } from './core/redirects.js';

// CMS — Media resolver
export { resolveMediaUrl, resolveMediaAsset } from './core/media.js';
export type { MediaAsset, MediaManifest } from './core/media.js';

// CMS — SEO + Schema.org
export { buildWebPageSchema } from './core/seo.js';
export type { SeoSpec } from './core/seo.js';

// CMS — Guardrails pure rules
export {
    checkDraftOrphans, checkPublishAtCoherence, checkMaintenanceModeLeak,
    check404Exists, checkRedirects, checkSeoCompleteness,
    checkOgImageExists, checkMediaOrphans, checkMediaMissingAlt,
    checkBreadcrumbDepth, checkLanguageCoverage, checkDuplicateRoutes,
    collectPureCmsWarnings,
} from './core/guardrails-cms.js';
export type { CmsWarning } from './core/guardrails-cms.js';

// Encoding guardrail
export { checkMojibake, checkTypography, checkEncoding, MOJIBAKE_PATTERN_COUNT, TYPO_RULE_COUNT } from './core/encoding.js';
export type { EncodingWarning } from './core/encoding.js';

// LLMs.txt generator
export { generateLlmsTxt, generateLlmsFullTxt } from './core/llms-generator.js';
export type { LlmsGeneratorOptions } from './core/llms-generator.js';

// Animation presets
export { probeAnimations, resolveAnimationCSS, ANIMATION_PRESETS } from './core/animation.js';
export type { AnimationWarning } from './core/animation.js';

// Editor utilities
export {
    getEditableSectionTypes, generateEditorSchema, generateAllEditorSchemas,
    applySectionPatch, addSection, removeSection, moveSection, applyPagePatch,
} from './core/editor.js';
export type {
    EditorFieldType, EditorFieldSpec, EditorSectionSchema,
    SectionPatchWarning, SectionPatchResult,
} from './core/editor.js';

// AI Page Generator
export { parsePrompt, generatePageSpec, generatePageSpecLocal } from './core/page-generator.js';
export type {
    PageIntent, SectionIntent, GeneratePageOptions, LlmContext, GeneratePageResult,
} from './core/page-generator.js';

// Template Gallery
export { listCatalogEntries, listPageEntries, listAllGalleryEntries, filterGalleryEntries } from './core/gallery.js';
export type { GalleryEntryKind, GalleryEntry, GalleryFilter } from './core/gallery.js';

// Cockpit API (pure logic, no Node builtins)
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

// Intent Parser (pure logic)
export { parseIntent, parseIntentLocal, buildMinimalSection, buildSectionSummary } from './core/intent-parser.js';
export type {
    ParsedIntent, IntentParseResult, IntentLlmCallback, IntentLlmContext,
} from './core/intent-parser.js';

// Visual Import (fetch-based, no fs)
export { importFromImage, createVisionCallback } from './core/visual-import.js';
export type { VisualImportResult, VisualImportOptions, VisionLlmCallback } from './core/visual-import.js';

// Video Import (in-memory, no fs)
export { importFromVideo, selectKeyFrames } from './core/video-import.js';
export type { VideoImportResult, VideoImportOptions, FrameData } from './core/video-import.js';

// URL Import — moved to ./node entry (requires playwright)
export type { UrlImportResult, UrlImportOptions, HtmlLlmCallback } from './core/url-import.js';

// OpenRouter Client (fetch-based)
export { createOpenRouterCallback, testOpenRouterConnection } from './core/openrouter-client.js';
export type { OpenRouterConfig } from './core/openrouter-client.js';

// Schema Export
export {
    getPageSpecSchema, getCockpitActionSchema,
    getSectionSchema, getAllSectionSchemas, getSchemaDefinedSectionTypes,
} from './core/schema-export.js';

// Extension Registry
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

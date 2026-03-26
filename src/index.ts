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

// LLMs.txt generator (PBI #614)
export { generateLlmsTxt, generateLlmsFullTxt } from './core/llms-generator.js';
export type { LlmsGeneratorOptions } from './core/llms-generator.js';

// Animation presets (PBI #611)
export { probeAnimations, resolveAnimationCSS, ANIMATION_PRESETS } from './core/animation.js';
export type { AnimationWarning } from './core/animation.js';
export type { AnimationPreset, AnimationDelay, AnimationTrigger, AnimationSpec } from './core/types.js';

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

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

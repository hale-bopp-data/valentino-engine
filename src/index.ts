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
export { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor, fixNamedColors, GUARDRAILS } from './core/guardrails.js';
export type { GuardrailOptions } from './core/guardrails.js';
export { CSS_NAMED_COLORS } from './core/css-named-colors.js';
export { findConfigFile, loadTokenConfig, resolveGuardrailOptions } from './core/guardrail-config.js';
export type { ValentinoTokenConfig } from './core/guardrail-config.js';

// HTML Audit — audit <style> tags and inline styles in HTML (#3028)
export { auditHtml, fixHtml, extractStyleTagCss, extractInlineStyles } from './core/audit-html.js';
export type { HtmlAuditViolation, HtmlAuditResult } from './core/audit-html.js';

// Token Validation — detect circular/self-referencing CSS custom properties (#3029)
export { validateTokens, fixSelfReferences, parseTokenDeclarations, extractVarReferences } from './core/validate-tokens.js';
export type { TokenViolation, ValidateTokensResult } from './core/validate-tokens.js';

export { createJsonOutput, printJson, SCHEMA_VERSION } from './core/json-output.js';
export type { JsonOutput, JsonSection } from './core/json-output.js';

// Backup — pre-fix file backup + diff (#3035)
export { createBackup, restoreBackup, backupExists, computeDiff, formatDiff, writeFixed, parseFixArgs } from './core/backup.js';
export type { BackupResult, DiffLine, DiffHunk } from './core/backup.js';

// Refactor — dry-run preview + self-ref detection (#3036)
export { previewRefactor, detectNewSelfReferences, countNewTokenReferences, applyFixes, detectFileType, formatProposal } from './core/refactor.js';
export type { RefactorProposal, SelfRefWarning } from './core/refactor.js';

// Security Certification — UI surface audit (#3039)
export { certifySecurity, certifySecurityCss, checkInlineStyles, checkEventHandlers, checkTokenOverrides, formatCertification } from './core/certify-security.js';
export type { SecurityViolation, SecurityCertification } from './core/certify-security.js';

// Validation probes
export { checkWcagContrast, parseColor, relativeLuminance, contrastRatio } from './core/contrast.js';
export type { ContrastLevel, ContrastResult } from './core/contrast.js';
export { probeRhythm } from './core/rhythm.js';
export type { RhythmWarning, RhythmProbeResult, RhythmOptions } from './core/rhythm.js';
export { probeHeroContract } from './core/hero-contract.js';
export type { HeroContractWarning, HeroContractResult } from './core/hero-contract.js';
export { probeSectionIntegrity } from './core/section-integrity.js';
export type { IntegrityWarning, IntegrityResult } from './core/section-integrity.js';
export { getProfileConfig, isValidProfile, buildSpaAuditScript } from './core/spa-profile.js';
export type { AuditProfile, ProfileConfig } from './core/spa-profile.js';

// Theme Audit — static contrast analysis for theme-packs against surfaces
export {
    auditThemePack, auditThemePacks,
    validateThemePackAgainstRegistry,
    inferTokenRole, VALENTINO_SURFACES,
} from './core/theme-audit.js';
export type {
    SurfaceKind, SurfaceDefinition, ThemePackTokens, TokenRole,
    ThemeAuditViolation, ThemeAuditResult, RegistryViolation, BatchAuditResult,
} from './core/theme-audit.js';

// Contrast Usage Probe — static CSS analysis for unremediated text variables
export {
    probeContrastUsage, probeContrastUsageMulti,
    parseRemappedTokens, parseTextTokenUsages,
    extractShadowDomStyles,
} from './core/contrast-usage-probe.js';
export type { ContrastUsageWarning, ContrastUsageProbeResult, ContrastUsageMultiResult } from './core/contrast-usage-probe.js';

// Skills
export { premiumDesignSkill, webGuardrailsSkill, designGuidelinesSkill } from './skills/index.js';

// CMS — Page status workflow (PBI #606)
export { getPageStatus, getPublishAt, isPageVisible, getContrastAuditPages } from './core/page-status.js';
export type { PageStatus, ContrastAuditPage } from './core/page-status.js';

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

// Video Import — Frames → multi-frame analysis → PageSpecV1 (Feature #784, PBI #787)
export { importFromVideo, selectKeyFrames } from './core/video-import.js';
export type { VideoImportResult, VideoImportOptions, FrameData } from './core/video-import.js';

// URL Import — URL → screenshot/HTML → PageSpecV1 (Feature #784, PBI #786)
export { importFromUrl } from './core/url-import.js';
export type { UrlImportResult, UrlImportOptions, HtmlLlmCallback } from './core/url-import.js';

// Project Adapter — HTML/CSS project → PageSpecV1 (Feature #784, PBI #788)
export { importFromProject, scanProjectDirectory, analyzeHtmlStructure } from './core/project-adapter.js';
export type { ProjectScanResult, ProjectPageResult, ProjectAdapterResult, ProjectAdapterOptions } from './core/project-adapter.js';

// OpenRouter Client — LLM integration for intent parsing (Feature #778)
export * from './core/providers/types.js';
export { createOpenRouterCallback, testOpenRouterConnection } from './core/providers/openrouter.js';
export type { OpenRouterConfig } from './core/providers/openrouter.js';
export { createAzureOpenAICallback } from './core/providers/azure-openai.js';
export type { AzureOpenAIConfig } from './core/providers/azure-openai.js';
export { createOllamaCallback } from './core/providers/ollama.js';
export type { OllamaConfig } from './core/providers/ollama.js';

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

// Visual Guardian — Playwright headless DOM audit (PBI-004, optional peer dep)
export { runVisualGuardian, isPlaywrightAvailable } from './core/playwright-adapter.js';
export type { VisualGuardianReport, VisualViolation, VisualGuardianOptions, RenderHtmlCallback } from './core/playwright-adapter.js';

// Visual Audit — first-class Playwright audit on raw HTML or URL (#3032)
export { runVisualAudit, runResponsiveAudit, formatVisualAudit, formatResponsiveAudit, EXIT_CODES } from './core/visual-audit.js';
export type { VisualAuditViolation, VisualAuditResult, VisualAuditOptions, ResponsiveAuditResult } from './core/visual-audit.js';

// Unified Report — one command for all audits (#3030)
export { generateReport, formatReport } from './core/report.js';
export type { ReportSection, UnifiedReport, ReportOptions } from './core/report.js';

// Runtime Token Verification — Playwright getComputedStyle (#3037)
export { verifyTokensRuntime, formatVerifyRuntime } from './core/verify-tokens-runtime.js';
export type { RuntimeTokenResult, VerifyTokensRuntimeResult } from './core/verify-tokens-runtime.js';

// Watch — live file observer with auto-audit (#3038)
export { watchFile, auditFileForWatch, formatWatchEvent } from './core/watch.js';
export type { WatchEvent, WatchOptions } from './core/watch.js';

// DOM Audit — runtime Playwright audit: inline styles, overflow, console, 404, a11y (#3051)
export { runAuditDom, runMultiViewportAuditDom, formatAuditDom, auditDomToJson } from './core/audit-dom.js';
export type { DomViolation, AuditDomResult, AuditDomOptions } from './core/audit-dom.js';

// Suggest Fix — non-destructive fix proposals: inline→class, px→rem, color→token (#3050)
export { suggestFixes, formatPatch, formatTable, suggestFixToJson } from './core/suggest-fix.js';
export type { Suggestion, SuggestFixResult } from './core/suggest-fix.js';

// Grid Contract — declare and verify DOM grid layout (#3040)
export { initGridContract, verifyGridContract, formatGridContract, formatGridVerify } from './core/grid-contract.js';
export type { GridSlot, GridContract, GridVerifyViolation, GridVerifyResult } from './core/grid-contract.js';

// Template Engine Awareness — detect template/CSS conflicts (#3031)
export { detectTemplateEngine, findTemplateExpressions, auditTemplateExpressions, stripTemplateExpressions, formatTemplateAudit, SUPPORTED_ENGINES } from './core/template-engine.js';
export type { TemplateEngine, TemplateWarning, TemplateAuditResult } from './core/template-engine.js';

// Review Notes — structured review annotations for LLM/operator handoff (#3045)
export { createNote, updateNote, createSession, addNote, updateSessionStatus, validateNote, validateSession, exportSessionMarkdown, parseSessionJson, sessionStats, NOTE_TYPES, SEVERITIES, OUTCOMES, STATES } from './core/review-notes.js';
export type { NoteType, NoteSeverity, NoteOutcome, NoteState, ReviewMode, SessionStatus, NoteRecord, ReviewSession, ValidationError } from './core/review-notes.js';

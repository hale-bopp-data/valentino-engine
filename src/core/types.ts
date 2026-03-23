/**
 * Valentino Engine — Runtime Pages Type System
 * Extracted verbatim from easyway-portal (src/types/runtime-pages.ts).
 * This is the single source of truth for all PageSpec, Section, and Catalog types.
 */

export type ActionSpec =
    | { type: 'link'; href: string }
    | { type: 'noop' };

export type CtaSpec = {
    labelKey: string;
    action: ActionSpec;
};

export type ActionWidgetIcon =
    | 'code'
    | 'manifesto'
    | 'agents'
    | 'github'
    | 'azure-devops'
    | 'star';

export type ActionWidgetVariant = 'default' | 'repo';

export type ActionWidgetSpec = {
    labelKey: string;
    href: string;
    icon: ActionWidgetIcon;
    variant?: ActionWidgetVariant;
    selected?: boolean;
    metaKey?: string;
};

export type SectionPresentationSpec = {
    surface?: 'default' | 'muted' | 'accent' | 'dark' | 'shell-dark' | 'reading-light' | 'ops-light';
    surfaceScreen?: 'none' | 'soft' | 'immersive' | 'inherit';
    seamProfile?: 'none' | 'hero-intro-merge' | 'hero-to-light';
    seamDensity?: 'default' | 'immersive';
    surfaceEntry?: 'slab' | 'bleed' | 'floating';
    surfaceOverlap?: 'none' | 'sm' | 'md' | 'lg';
    contentLift?: 'none' | 'sm' | 'md' | 'lg';
    visualStage?: string;
    height?: 'content' | 'screen-sm' | 'screen-md' | 'screen-full';
    tone?: 'default' | 'elevated' | 'immersive';
    rhythmProfile?: 'hero' | 'transition' | 'feature' | 'reading' | 'proof' | 'metrics' | 'ops';
    rhythmGroup?: string;
    presetId?: string;
    transitionProfileId?: string;
};

export type SectionPresentationBase = {
    presentation?: SectionPresentationSpec;
};

export type LayoutMapMeasureToken = 'compact' | 'reading' | 'wide' | 'full';

export type LayoutMapVariantToken = 'default' | 'lego' | 'panel-right';

export type LayoutMapPlacementSpec = {
    col?: number;
    row?: number;
    colSpan?: number;
    rowSpan?: number;
    justifySelf?: 'start' | 'center' | 'end' | 'stretch';
    alignSelf?: 'start' | 'center' | 'end' | 'stretch';
    offsetX?: string;
    offsetY?: string;
    maxWidth?: string;
};

export type LayoutMapStyleSpec = {
    surfaceToken?: string;
    textToken?: string;
    accentToken?: string;
    borderToken?: string;
    shadowToken?: string;
    measure?: LayoutMapMeasureToken;
    variant?: LayoutMapVariantToken;
};

export type LayoutMapSlotSpec = {
    placement?: LayoutMapPlacementSpec;
    style?: LayoutMapStyleSpec;
    visible?: boolean;
};

export type LayoutMapGridSpec = {
    columns: string[];
    rows: string[];
    columnGap?: string;
    rowGap?: string;
    alignItems?: 'start' | 'center' | 'end' | 'stretch';
};

export type LayoutMapBreakpointSpec = {
    grid: LayoutMapGridSpec;
    slots: Record<string, LayoutMapSlotSpec>;
};

export type LayoutMapSpec = {
    template: string;
    version: 1;
    variant?: LayoutMapVariantToken;
    desktop?: LayoutMapBreakpointSpec;
    mobile?: LayoutMapBreakpointSpec;
};

export type HeroGuardrailToken =
    | 'horizontal-anchors'
    | 'fold-budget'
    | 'title-claim-wrap'
    | 'early-proof'
    | 'cta-discipline'
    | 'surface-continuity'
    | 'decorative-noise-ceiling'
    | 'single-decorative-source'
    | 'no-cover-up-layers'
    | 'rail-item-geometry'
    | 'copy-density'
    | 'mobile-collapse-order';

export type HeroGeometryAnchorId =
    | 'eyebrow'
    | 'title'
    | 'tagline'
    | 'support'
    | 'aside'
    | 'panel'
    | 'cta'
    | 'rail';

export type HeroGeometryAnchorSpec = {
    x: number;
    y: number;
    width?: number;
    height?: number;
};

export type HeroGeometryBreakpointSpec = {
    viewportWidth: number;
    viewportHeight: number;
    anchors: Partial<Record<HeroGeometryAnchorId, HeroGeometryAnchorSpec>>;
};

export type HeroGeometrySpec = {
    desktop?: HeroGeometryBreakpointSpec;
    mobile?: HeroGeometryBreakpointSpec;
};

export type HeroSection = SectionPresentationBase & {
    type: 'hero';
    layout?: 'default' | 'split';
    layoutMode?: 'stack' | 'split' | 'stage-right';
    foldVisibility?: 'immediate' | 'scroll';
    primaryFocus?: 'copy' | 'action-box' | 'balanced';
    heroPanel?: 'none' | 'inline' | 'right-box';
    panelSource?: 'inline' | 'companion-section';
    ctaPlacement?: 'inline' | 'sibling';
    copyGrouping?: 'shell' | 'lego';
    layoutMap?: LayoutMapSpec;
    companionSectionId?: string;
    titleKey: string;
    eyebrowKey?: string;
    taglineKey?: string;
    supportKey?: string;
    mottoKey?: string;
    actionPanelTitleKey?: string;
    poeticAsideKey?: string;
    visualAssetPath?: string;
    heroGuardrails?: HeroGuardrailToken[];
    heroGeometry?: HeroGeometrySpec;
    cta?: CtaSpec;
    ctaSecondary?: CtaSpec;
    ctaTertiary?: CtaSpec;
    actionRail?: ActionWidgetSpec[];
};

export type CardsCatalogItem = {
    iconText?: string;
    titleKey: string;
    badgeKey?: string;
    descKey?: string;
    action?: (CtaSpec & { variant?: 'glass' | 'primary' });
};

export type CardsLinkRailItem = {
    labelKey: string;
    metaKey?: string;
    href: string;
};

export type CardsSection = SectionPresentationBase & {
    type: 'cards';
    variant: 'catalog';
    layoutMap?: LayoutMapSpec;
    density?: 'default' | 'compact';
    titleKey?: string;
    descKey?: string;
    items: CardsCatalogItem[];
    linkRail?: CardsLinkRailItem[];
};

export type ComparisonSection = SectionPresentationBase & {
    type: 'comparison';
    layoutMap?: LayoutMapSpec;
    titleKey: string;
    subtitleKey?: string;
    left: { titleKey: string; itemsKeys: string[] };
    right: { titleKey: string; itemsKeys: string[] };
};

export type CtaSection = SectionPresentationBase & {
    type: 'cta';
    layoutMap?: LayoutMapSpec;
    titleKey: string;
    bodyKey?: string;
    primary?: CtaSpec;
    secondary?: CtaSpec;
};

export type FormFieldSpec = {
    name: string;
    type: 'text' | 'email' | 'select' | 'textarea' | 'checkbox';
    labelKey: string;
    placeholderKey?: string;
    required?: boolean;
    optionsKey?: string;
    rows?: number;
    width?: 'half' | 'full';
};

export type FormSection = SectionPresentationBase & {
    type: 'form';
    layoutMap?: LayoutMapSpec;
    id?: string;
    variant?: 'demo';
    titleKey: string;
    leadKey?: string;
    badgesKeys?: string[];
    testimonialTextKey?: string;
    testimonialAuthorKey?: string;
    fields: FormFieldSpec[];
    consentKey?: string;
    submitKey: string;
    legalKey?: string;
};

export type SpacerSection = SectionPresentationBase & {
    type: 'spacer';
    layoutMap?: LayoutMapSpec;
    size?: 'sm' | 'md' | 'lg';
};

export type ManifestoSection = SectionPresentationBase & {
    type: 'manifesto';
    layoutMap?: LayoutMapSpec;
    contentPrefix?: string;
    ctaLabelKey?: string;
    ctaHref?: string;
};

export type ComponentVariant = {
    name: string;
    spec: Record<string, unknown>;
};

export type ComponentShowcaseItem = {
    id: string;
    name: string;
    variants: ComponentVariant[];
};

export type ShowcaseIntroSection = SectionPresentationBase & {
    type: 'showcase-intro';
    layoutMap?: LayoutMapSpec;
    titleKey: string;
    descriptionKey: string;
};

export type ComponentShowcaseSection = SectionPresentationBase & {
    type: 'component-showcase';
    layoutMap?: LayoutMapSpec;
    components: ComponentShowcaseItem[];
};

export type AgentDashboardSection = SectionPresentationBase & {
    type: 'agent-dashboard';
    layoutMap?: LayoutMapSpec;
    titleKey?: string;
};

export type AgentGraphSection = SectionPresentationBase & {
    type: 'agent-graph';
    layoutMap?: LayoutMapSpec;
    titleKey?: string;
    descKey?: string;
};

export type AgentListSection = SectionPresentationBase & {
    type: 'agent-list';
    layoutMap?: LayoutMapSpec;
    titleKey?: string;
    descKey?: string;
};

export type DataListColumnSpec = {
    key: string;
    labelKey: string;
    format?: 'datetime' | 'date' | 'currency';
};

export type RowActionSpec =
    | { type: 'run'; labelKey: string; idField?: string; }
    | { type: 'link'; labelKey: string; href: string; };

export type DataListSection = SectionPresentationBase & {
    type: 'data-list';
    layoutMap?: LayoutMapSpec;
    titleKey?: string;
    dataUrl: string;
    columns: DataListColumnSpec[];
    rowActions?: RowActionSpec[];
};

export type ActionFormFieldSpec = {
    name: string;
    type: 'text' | 'email' | 'number' | 'date' | 'datetime-local' | 'textarea';
    labelKey: string;
    placeholderKey?: string;
    required?: boolean;
    rows?: number;
};

export type ActionFormSection = SectionPresentationBase & {
    type: 'action-form';
    layoutMap?: LayoutMapSpec;
    titleKey: string;
    submitUrl: string;
    submitKey: string;
    successKey: string;
    fields: ActionFormFieldSpec[];
    refreshListSelector?: string;
};

export type StatItemSpec = {
    valueKey: string;
    labelKey: string;
};

export type StatsSection = SectionPresentationBase & {
    type: 'stats';
    layoutMap?: LayoutMapSpec;
    titleKey?: string;
    items: StatItemSpec[];
};

export type HowItWorksStepSpec = {
    numKey: string;
    titleKey: string;
    descKey: string;
};

export type HowItWorksSection = SectionPresentationBase & {
    type: 'how-it-works';
    layoutMap?: LayoutMapSpec;
    titleKey?: string;
    subtitleKey?: string;
    steps: HowItWorksStepSpec[];
};

export type AdvisorPromptSpec = {
    id: string;
    labelKey: string;
    answerTitleKey: string;
    answerBodyKey: string;
};

export type AdvisorResponseStatus = 'ok' | 'needs_clarification' | 'error';

export type AdvisorResponseLabelsSpec = {
    readingKey: string;
    recommendationKey: string;
    guardrailsKey: string;
    nextStepKey: string;
    followupsKey: string;
};

export type AdvisorSection = SectionPresentationBase & {
    type: 'advisor';
    layoutMap?: LayoutMapSpec;
    titleKey: string;
    leadKey?: string;
    promptPlaceholderKey?: string;
    submitKey: string;
    submitUrl?: string;
    loadingKey?: string;
    fallbackTitleKey: string;
    fallbackBodyKey: string;
    errorTitleKey?: string;
    errorBodyKey?: string;
    responseLabels?: AdvisorResponseLabelsSpec;
    prompts: AdvisorPromptSpec[];
};

export type ValentinoCatalogSection = SectionPresentationBase & {
    type: 'valentino-catalog';
    titleKey: string;
    descriptionKey?: string;
};

export type SectionSpec =
    | HeroSection
    | CardsSection
    | ComparisonSection
    | CtaSection
    | FormSection
    | ManifestoSection
    | SpacerSection
    | ShowcaseIntroSection
    | ComponentShowcaseSection
    | AgentDashboardSection
    | AgentGraphSection
    | AgentListSection
    | DataListSection
    | ActionFormSection
    | StatsSection
    | HowItWorksSection
    | AdvisorSection
    | ValentinoCatalogSection;

export type PageProfileSpec =
    | 'home-signature'
    | 'product-surface'
    | 'advisor-surface'
    | 'conversion-form'
    | 'reading-manifesto'
    | 'use-case-hub';

export type PageSpecV1 = {
    version: '1';
    id: string;
    profile?: PageProfileSpec;
    templateId?: string;
    blueprintId?: string;
    sourcePageId?: string;
    activeNav?: string;
    titleKey?: string;
    themeId?: string;
    chrome?: {
        floatingDock?: boolean;
    };
    sections: SectionSpec[];
};

export type ValentinoGovernanceTier = 'standard' | 'custom-governed';

export type ValentinoGovernanceSpec = {
    tier: ValentinoGovernanceTier;
    allowedPageProfiles?: PageProfileSpec[];
    allowedSectionTypes?: SectionSpec['type'][];
    notes?: string;
};

export type ValentinoTemplateEntry = {
    page?: Pick<PageSpecV1, 'profile' | 'themeId' | 'chrome'>;
};

export type ValentinoSectionPresetEntry = {
    presentation: SectionPresentationSpec;
    governance?: ValentinoGovernanceSpec;
};

export type ValentinoTransitionProfileEntry = {
    presentation: Pick<
        SectionPresentationSpec,
        'seamProfile' | 'seamDensity' | 'surfaceEntry' | 'surfaceOverlap' | 'contentLift'
    >;
    governance?: ValentinoGovernanceSpec;
};

export type ValentinoPageBlueprintEntry = {
    spec: PageSpecV1;
    governance?: ValentinoGovernanceSpec;
};

export type ValentinoCatalogV1 = {
    version: '1';
    templates: Record<string, ValentinoTemplateEntry>;
    sectionPresets: Record<string, ValentinoSectionPresetEntry>;
    transitionProfiles: Record<string, ValentinoTransitionProfileEntry>;
    pageBlueprints: Record<string, ValentinoPageBlueprintEntry>;
};

export type ManifestPageV1 = {
    id: string;
    route: string;
    titleKey?: string;
    spec: string;
    nav?: { labelKey: string; order: number };
};

export type NavInteractionModeV1 = 'hover' | 'click';
export type NavPanelVariantV1 = 'dropdown' | 'mega';
export type NavPanelWidthTokenV1 = 'compact' | 'default' | 'wide';
export type NavPanelLayoutTokenV1 = 'balanced' | 'groups-heavy';
export type NavLinkDensityTokenV1 = 'compact' | 'comfortable';

export type NavPanelLinkV1 = {
    labelKey: string;
    href: string;
    pageId?: string;
    descriptionKey?: string;
};

export type NavPanelGroupV1 = {
    groupKey?: string;
    links: NavPanelLinkV1[];
};

export type NavFeaturedCardV1 = {
    titleKey: string;
    bodyKey?: string;
    href: string;
    labelKey: string;
};

export type NavItemV1 = {
    id: string;
    labelKey: string;
    href?: string;
    pageId?: string;
    order?: number;
    interactionMode?: NavInteractionModeV1;
    panelVariant?: NavPanelVariantV1;
    panelWidthToken?: NavPanelWidthTokenV1;
    panelLayoutToken?: NavPanelLayoutTokenV1;
    linkDensity?: NavLinkDensityTokenV1;
    children?: NavPanelGroupV1[];
    featured?: NavFeaturedCardV1;
};

export type NavigationConfigV1 = {
    interactionMode?: NavInteractionModeV1;
    panelVariant?: NavPanelVariantV1;
    panelWidthToken?: NavPanelWidthTokenV1;
    panelLayoutToken?: NavPanelLayoutTokenV1;
    linkDensity?: NavLinkDensityTokenV1;
    items: NavItemV1[];
};

export type PagesManifestV1 = {
    version: '1';
    defaultLanguage?: string;
    navigation?: NavigationConfigV1;
    pages: ManifestPageV1[];
};

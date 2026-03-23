/**
 * Catalog Resolver — resolves PageSpec against a ValentinoCatalog.
 * Pure functions, no fetch, no DOM. Consumer loads the catalog.
 * Extracted from easyway-portal (src/utils/valentino-catalog.ts).
 */

import type {
    PageSpecV1,
    SectionPresentationSpec,
    SectionSpec,
    ValentinoCatalogV1,
    PageProfileSpec,
} from './types.js';

export function mergePresentation(
    presetPresentation: SectionPresentationSpec | undefined,
    transitionPresentation: SectionPresentationSpec | undefined,
    inlinePresentation: SectionPresentationSpec | undefined,
): SectionPresentationSpec | undefined {
    const merged = {
        ...(presetPresentation || {}),
        ...(transitionPresentation || {}),
        ...(inlinePresentation || {}),
    };
    return Object.keys(merged).length > 0 ? merged : undefined;
}

export function isGovernanceAllowed(
    sectionType: SectionSpec['type'],
    pageProfile: PageProfileSpec | undefined,
    governance?: {
        allowedPageProfiles?: PageProfileSpec[];
        allowedSectionTypes?: SectionSpec['type'][];
    },
): boolean {
    if (!governance) return true;

    if (governance.allowedPageProfiles?.length && (!pageProfile || !governance.allowedPageProfiles.includes(pageProfile))) {
        return false;
    }

    if (governance.allowedSectionTypes?.length && !governance.allowedSectionTypes.includes(sectionType)) {
        return false;
    }

    return true;
}

function resolveSectionWithCatalog(
    section: SectionSpec,
    pageProfile: PageProfileSpec | undefined,
    catalog: ValentinoCatalogV1,
): SectionSpec {
    const presentation = section.presentation;
    const presetId = presentation?.presetId;
    const transitionProfileId = presentation?.transitionProfileId;
    const presetEntry = presetId ? catalog.sectionPresets[presetId] : undefined;
    const transitionEntry = transitionProfileId ? catalog.transitionProfiles[transitionProfileId] : undefined;

    if (presetEntry && !isGovernanceAllowed(section.type, pageProfile, presetEntry.governance)) {
        console.warn(`[ValentinoCatalog] Preset '${presetId}' is outside the approved perimeter for page profile '${pageProfile || 'n/a'}' and section '${section.type}'`);
    }

    if (transitionEntry && !isGovernanceAllowed(section.type, pageProfile, transitionEntry.governance)) {
        console.warn(`[ValentinoCatalog] Transition profile '${transitionProfileId}' is outside the approved perimeter for page profile '${pageProfile || 'n/a'}' and section '${section.type}'`);
    }

    return {
        ...section,
        presentation: mergePresentation(
            presetEntry?.presentation,
            transitionEntry?.presentation,
            presentation,
        ),
    };
}

export function resolvePageSpecWithCatalog(pageSpec: PageSpecV1, catalog: ValentinoCatalogV1): PageSpecV1 {
    const blueprintEntry = pageSpec.blueprintId ? catalog.pageBlueprints[pageSpec.blueprintId] : undefined;
    const blueprintSpec = blueprintEntry?.spec;
    const templateId = pageSpec.templateId || blueprintSpec?.templateId;
    const templateEntry = templateId ? catalog.templates[templateId] : undefined;
    const resolvedProfile = pageSpec.profile || blueprintSpec?.profile || templateEntry?.page?.profile;
    const resolvedSections = Array.isArray(pageSpec.sections) && pageSpec.sections.length > 0
        ? pageSpec.sections
        : (blueprintSpec?.sections || []);

    return {
        ...blueprintSpec,
        ...pageSpec,
        id: pageSpec.id,
        templateId,
        profile: resolvedProfile,
        titleKey: pageSpec.titleKey || blueprintSpec?.titleKey,
        themeId: pageSpec.themeId || blueprintSpec?.themeId || templateEntry?.page?.themeId,
        chrome: pageSpec.chrome || blueprintSpec?.chrome || templateEntry?.page?.chrome,
        sections: resolvedSections.map((section) => resolveSectionWithCatalog(section, resolvedProfile, catalog)),
    };
}

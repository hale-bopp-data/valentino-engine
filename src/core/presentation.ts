/**
 * Presentation Resolver — resolves section presentation defaults.
 * Pure functions, no DOM. Extracted from easyway-portal (src/utils/pages-renderer.ts).
 */

import type { SectionPresentationSpec, SectionSpec } from './types.js';

export const DEFAULT_PRESENTATION: Required<SectionPresentationSpec> = {
    surface: 'default',
    surfaceScreen: 'none',
    visualStage: 'none',
    seamProfile: 'none',
    seamDensity: 'default',
    surfaceEntry: 'slab',
    surfaceOverlap: 'none',
    contentLift: 'none',
    height: 'content',
    tone: 'default',
    rhythmProfile: 'feature',
    rhythmGroup: 'default-flow',
    presetId: '',
    transitionProfileId: '',
};

export function inferRhythmProfile(section: SectionSpec): NonNullable<SectionPresentationSpec['rhythmProfile']> {
    switch (section.type) {
        case 'hero':
            return 'hero';
        case 'cta':
        case 'spacer':
            return 'transition';
        case 'cards':
        case 'how-it-works':
        case 'comparison':
        case 'valentino-catalog':
            return 'feature';
        case 'manifesto':
            return 'reading';
        case 'stats':
            return 'metrics';
        case 'agent-dashboard':
        case 'agent-graph':
        case 'agent-list':
        case 'data-list':
        case 'action-form':
            return 'ops';
        default:
            return 'feature';
    }
}

export function resolvePresentation(section: SectionSpec): Required<SectionPresentationSpec> {
    return {
        surface: section.presentation?.surface || DEFAULT_PRESENTATION.surface,
        surfaceScreen: section.presentation?.surfaceScreen || DEFAULT_PRESENTATION.surfaceScreen,
        seamProfile: section.presentation?.seamProfile || DEFAULT_PRESENTATION.seamProfile,
        seamDensity: section.presentation?.seamDensity || DEFAULT_PRESENTATION.seamDensity,
        surfaceEntry: section.presentation?.surfaceEntry || DEFAULT_PRESENTATION.surfaceEntry,
        surfaceOverlap: section.presentation?.surfaceOverlap || DEFAULT_PRESENTATION.surfaceOverlap,
        contentLift: section.presentation?.contentLift || DEFAULT_PRESENTATION.contentLift,
        visualStage: section.presentation?.visualStage || DEFAULT_PRESENTATION.visualStage,
        height: section.presentation?.height || DEFAULT_PRESENTATION.height,
        tone: section.presentation?.tone || DEFAULT_PRESENTATION.tone,
        rhythmProfile: section.presentation?.rhythmProfile || inferRhythmProfile(section),
        rhythmGroup: section.presentation?.rhythmGroup || DEFAULT_PRESENTATION.rhythmGroup,
        presetId: section.presentation?.presetId || '',
        transitionProfileId: section.presentation?.transitionProfileId || '',
    };
}

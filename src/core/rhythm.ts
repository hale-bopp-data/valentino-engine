/**
 * Rhythm Probe — validates section sequence against Valentino rhythm rules.
 * Pure function, no DOM.
 */

import type { PageSpecV1, SectionSpec } from './types.js';
import { inferRhythmProfile } from './presentation.js';

export type RhythmWarning = {
    index: number;
    sectionType: SectionSpec['type'];
    rule: string;
    message: string;
};

export type RhythmProbeResult = {
    valid: boolean;
    warnings: RhythmWarning[];
};

/**
 * Probe a PageSpecV1 for rhythm rule violations.
 *
 * Rules:
 * 1. Hero must be the first section (if present)
 * 2. No two consecutive sections with the same rhythmProfile
 * 3. Spacer should appear between sections with the same surface
 */
export function probeRhythm(spec: PageSpecV1): RhythmProbeResult {
    const warnings: RhythmWarning[] = [];
    const sections = spec.sections;

    if (sections.length === 0) {
        return { valid: true, warnings };
    }

    // Rule 1: Hero must be first
    const heroIndex = sections.findIndex(s => s.type === 'hero');
    if (heroIndex > 0) {
        warnings.push({
            index: heroIndex,
            sectionType: 'hero',
            rule: 'hero-first',
            message: `Hero section found at index ${heroIndex} — should be first (index 0).`,
        });
    }

    // Rule 2: No consecutive same rhythmProfile
    for (let i = 1; i < sections.length; i++) {
        const prev = sections[i - 1];
        const curr = sections[i];
        const prevRhythm = prev.presentation?.rhythmProfile || inferRhythmProfile(prev);
        const currRhythm = curr.presentation?.rhythmProfile || inferRhythmProfile(curr);

        if (prevRhythm === currRhythm && currRhythm !== 'transition') {
            warnings.push({
                index: i,
                sectionType: curr.type,
                rule: 'no-consecutive-rhythm',
                message: `Sections at index ${i - 1} (${prev.type}) and ${i} (${curr.type}) share rhythmProfile "${currRhythm}" — consider a spacer or different rhythm.`,
            });
        }
    }

    // Rule 3: Same surface without spacer
    for (let i = 1; i < sections.length; i++) {
        const prev = sections[i - 1];
        const curr = sections[i];
        if (curr.type === 'spacer' || prev.type === 'spacer') continue;

        const prevSurface = prev.presentation?.surface || 'default';
        const currSurface = curr.presentation?.surface || 'default';

        if (prevSurface === currSurface) {
            warnings.push({
                index: i,
                sectionType: curr.type,
                rule: 'spacer-between-same-surface',
                message: `Sections at index ${i - 1} and ${i} share surface "${currSurface}" without a spacer — consider adding visual separation.`,
            });
        }
    }

    // Rule 4: Surface monotony — warn if >50% non-spacer sections share the same surface
    const nonSpacerSections = sections.filter(s => s.type !== 'spacer');
    if (nonSpacerSections.length >= 4) {
        const surfaceCounts = new Map<string, number>();
        for (const s of nonSpacerSections) {
            const surface = s.presentation?.surface || 'default';
            surfaceCounts.set(surface, (surfaceCounts.get(surface) || 0) + 1);
        }
        for (const [surface, count] of surfaceCounts) {
            if (count > nonSpacerSections.length * 0.5) {
                warnings.push({
                    index: 0,
                    sectionType: nonSpacerSections[0].type,
                    rule: 'surface-monotony',
                    message: `${count} of ${nonSpacerSections.length} sections use surface "${surface}" — vary surfaces for visual rhythm.`,
                });
            }
        }
    }

    return {
        valid: warnings.length === 0,
        warnings,
    };
}

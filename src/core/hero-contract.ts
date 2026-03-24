/**
 * Hero Contract Validator — validates HeroSection against guardrail tokens.
 * Pure function, no DOM.
 */

import type { HeroSection } from './types.js';

export type HeroContractWarning = {
    rule: string;
    message: string;
};

export type HeroContractResult = {
    valid: boolean;
    warnings: HeroContractWarning[];
};

/**
 * Validate a HeroSection against the Hero Contract rules:
 * 1. cta-discipline: max 3 CTAs (primary + secondary + tertiary)
 * 2. single-decorative-source: only one of visualAssetPath or visualStage
 * 3. copy-density: title is required, max 5 text anchors
 */
export function probeHeroContract(hero: HeroSection): HeroContractResult {
    const warnings: HeroContractWarning[] = [];

    // Rule 1: CTA discipline — max 3 CTAs
    let ctaCount = 0;
    if (hero.cta) ctaCount++;
    if (hero.ctaSecondary) ctaCount++;
    if (hero.ctaTertiary) ctaCount++;
    if (ctaCount > 2) {
        warnings.push({
            rule: 'cta-discipline',
            message: `Hero has ${ctaCount} CTAs — maximum recommended is 2 (primary + secondary).`,
        });
    }

    // Rule 2: Single decorative source
    const hasVisualAsset = !!hero.visualAssetPath;
    const hasVisualStage = !!hero.presentation?.visualStage && hero.presentation.visualStage !== 'none';
    if (hasVisualAsset && hasVisualStage) {
        warnings.push({
            rule: 'single-decorative-source',
            message: 'Hero has both visualAssetPath and visualStage — use only one decorative source.',
        });
    }

    // Rule 3: Copy density — count text anchors
    let textAnchors = 0;
    if (hero.titleKey) textAnchors++;
    if (hero.eyebrowKey) textAnchors++;
    if (hero.taglineKey) textAnchors++;
    if (hero.supportKey) textAnchors++;
    if (hero.mottoKey) textAnchors++;
    if (hero.poeticAsideKey) textAnchors++;
    if (hero.actionPanelTitleKey) textAnchors++;
    if (textAnchors > 5) {
        warnings.push({
            rule: 'copy-density',
            message: `Hero has ${textAnchors} text anchors — recommended maximum is 5 for readability.`,
        });
    }

    // Rule 4: Action rail size
    if (hero.actionRail && hero.actionRail.length > 6) {
        warnings.push({
            rule: 'rail-item-geometry',
            message: `Hero action rail has ${hero.actionRail.length} items — maximum recommended is 6.`,
        });
    }

    return {
        valid: warnings.length === 0,
        warnings,
    };
}

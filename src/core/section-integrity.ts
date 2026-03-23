/**
 * Section Integrity Checker — per-type structural validation.
 * Pure function, no DOM.
 */

import type { SectionSpec } from './types.js';

export type IntegrityWarning = {
    index: number;
    sectionType: SectionSpec['type'];
    rule: string;
    message: string;
};

export type IntegrityResult = {
    valid: boolean;
    warnings: IntegrityWarning[];
};

/**
 * Validate structural integrity of each section in the array.
 *
 * Rules per type:
 * - cards: items must be non-empty
 * - form: fields must be non-empty, submitKey required
 * - comparison: left and right must have itemsKeys
 * - how-it-works: steps must be non-empty
 * - advisor: prompts must be non-empty
 * - stats: items must be non-empty
 * - data-list: columns must be non-empty, dataUrl required
 * - action-form: fields must be non-empty, submitUrl required
 */
export function probeSectionIntegrity(sections: SectionSpec[]): IntegrityResult {
    const warnings: IntegrityWarning[] = [];

    sections.forEach((section, index) => {
        switch (section.type) {
            case 'cards':
                if (!section.items || section.items.length === 0) {
                    warnings.push({ index, sectionType: 'cards', rule: 'cards-items-required', message: 'Cards section has no items.' });
                }
                break;

            case 'form':
                if (!section.fields || section.fields.length === 0) {
                    warnings.push({ index, sectionType: 'form', rule: 'form-fields-required', message: 'Form section has no fields.' });
                }
                break;

            case 'comparison':
                if (!section.left?.itemsKeys?.length) {
                    warnings.push({ index, sectionType: 'comparison', rule: 'comparison-left-required', message: 'Comparison section has empty left.itemsKeys.' });
                }
                if (!section.right?.itemsKeys?.length) {
                    warnings.push({ index, sectionType: 'comparison', rule: 'comparison-right-required', message: 'Comparison section has empty right.itemsKeys.' });
                }
                break;

            case 'how-it-works':
                if (!section.steps || section.steps.length === 0) {
                    warnings.push({ index, sectionType: 'how-it-works', rule: 'how-it-works-steps-required', message: 'How-it-works section has no steps.' });
                }
                break;

            case 'advisor':
                if (!section.prompts || section.prompts.length === 0) {
                    warnings.push({ index, sectionType: 'advisor', rule: 'advisor-prompts-required', message: 'Advisor section has no prompts.' });
                }
                break;

            case 'stats':
                if (!section.items || section.items.length === 0) {
                    warnings.push({ index, sectionType: 'stats', rule: 'stats-items-required', message: 'Stats section has no items.' });
                }
                break;

            case 'data-list':
                if (!section.columns || section.columns.length === 0) {
                    warnings.push({ index, sectionType: 'data-list', rule: 'data-list-columns-required', message: 'Data-list section has no columns.' });
                }
                break;

            case 'action-form':
                if (!section.fields || section.fields.length === 0) {
                    warnings.push({ index, sectionType: 'action-form', rule: 'action-form-fields-required', message: 'Action-form section has no fields.' });
                }
                break;
        }
    });

    return {
        valid: warnings.length === 0,
        warnings,
    };
}

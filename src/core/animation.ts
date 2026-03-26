/**
 * Animation Presets — Validation and CSS generation for declarative section animations.
 * No DOM — pure functions only. The consumer applies CSS/IntersectionObserver.
 * PBI #611.
 */
import type { AnimationPreset, AnimationSpec, SectionSpec } from './types.js';

export type AnimationWarning = {
    type: string;
    section: number;
    message: string;
};

const VALID_PRESETS: Set<string> = new Set(['fade-up', 'fade-in', 'slide-left', 'slide-right', 'scale-in', 'none']);
const VALID_DELAYS: Set<string> = new Set(['none', 'stagger']);
const VALID_TRIGGERS: Set<string> = new Set(['viewport', 'immediate']);

/** Validate animation specs across all sections of a page. */
export function probeAnimations(sections: SectionSpec[]): AnimationWarning[] {
    const warnings: AnimationWarning[] = [];

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const anim = section.animation;
        if (!anim) continue;

        if (anim.entrance && !VALID_PRESETS.has(anim.entrance)) {
            warnings.push({
                type: 'animation-invalid-preset',
                section: i,
                message: `Section ${i} (${section.type}): unknown animation preset "${anim.entrance}". Valid: ${[...VALID_PRESETS].join(', ')}`,
            });
        }

        if (anim.delay && !VALID_DELAYS.has(anim.delay)) {
            warnings.push({
                type: 'animation-invalid-delay',
                section: i,
                message: `Section ${i} (${section.type}): unknown delay "${anim.delay}". Valid: ${[...VALID_DELAYS].join(', ')}`,
            });
        }

        if (anim.trigger && !VALID_TRIGGERS.has(anim.trigger)) {
            warnings.push({
                type: 'animation-invalid-trigger',
                section: i,
                message: `Section ${i} (${section.type}): unknown trigger "${anim.trigger}". Valid: ${[...VALID_TRIGGERS].join(', ')}`,
            });
        }

        if (anim.duration !== undefined && (anim.duration < 0 || anim.duration > 5000)) {
            warnings.push({
                type: 'animation-duration-out-of-range',
                section: i,
                message: `Section ${i} (${section.type}): duration ${anim.duration}ms is out of range (0-5000)`,
            });
        }

        // Stagger on non-list sections is a no-op warning
        if (anim.delay === 'stagger') {
            const listTypes = new Set(['cards', 'stats', 'how-it-works', 'data-list', 'component-showcase']);
            if (!listTypes.has(section.type)) {
                warnings.push({
                    type: 'animation-stagger-no-effect',
                    section: i,
                    message: `Section ${i} (${section.type}): "stagger" delay has no effect on non-list sections`,
                });
            }
        }
    }

    return warnings;
}

/** Resolve animation to CSS custom properties for a section. */
export function resolveAnimationCSS(anim: AnimationSpec): Record<string, string> {
    const preset = anim.entrance || 'none';
    const duration = anim.duration || 400;
    const delay = anim.delay || 'none';

    if (preset === 'none') return {};

    const css: Record<string, string> = {
        '--v-anim-duration': `${duration}ms`,
        '--v-anim-delay-mode': delay,
    };

    switch (preset) {
        case 'fade-up':
            css['--v-anim-opacity'] = '0';
            css['--v-anim-transform'] = 'translateY(20px)';
            break;
        case 'fade-in':
            css['--v-anim-opacity'] = '0';
            css['--v-anim-transform'] = 'none';
            break;
        case 'slide-left':
            css['--v-anim-opacity'] = '0';
            css['--v-anim-transform'] = 'translateX(40px)';
            break;
        case 'slide-right':
            css['--v-anim-opacity'] = '0';
            css['--v-anim-transform'] = 'translateX(-40px)';
            break;
        case 'scale-in':
            css['--v-anim-opacity'] = '0';
            css['--v-anim-transform'] = 'scale(0.95)';
            break;
    }

    return css;
}

/** List of all valid animation presets. */
export const ANIMATION_PRESETS: readonly AnimationPreset[] = ['fade-up', 'fade-in', 'slide-left', 'slide-right', 'scale-in', 'none'];

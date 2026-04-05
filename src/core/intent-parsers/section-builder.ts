import type { SectionSpec } from '../types.js';

export function buildMinimalSection(sectionType: string): SectionSpec {
    const prefix = `new.${sectionType}`;
    switch (sectionType) {
        case 'hero':
            return { type: 'hero', titleKey: `${prefix}.title`, presentation: { surface: 'shell-dark', rhythmProfile: 'hero' } };
        case 'cards':
            return { type: 'cards', variant: 'catalog', titleKey: `${prefix}.title`, items: [{ titleKey: `${prefix}.item1.title` }], presentation: { rhythmProfile: 'feature' } };
        case 'cta':
            return { type: 'cta', titleKey: `${prefix}.title`, presentation: { surface: 'accent', rhythmProfile: 'proof' } };
        case 'stats':
            return { type: 'stats', items: [{ valueKey: `${prefix}.item1.value`, labelKey: `${prefix}.item1.label` }], presentation: { rhythmProfile: 'metrics' } };
        case 'how-it-works':
            return { type: 'how-it-works', steps: [{ numKey: '1', titleKey: `${prefix}.step1.title`, descKey: `${prefix}.step1.desc` }], presentation: { rhythmProfile: 'feature' } };
        case 'form':
            return { type: 'form', titleKey: `${prefix}.title`, submitKey: `${prefix}.submit`, fields: [{ name: 'email', type: 'email', labelKey: `${prefix}.email` }] };
        case 'comparison':
            return { type: 'comparison', titleKey: `${prefix}.title`, left: { titleKey: `${prefix}.left`, itemsKeys: [] }, right: { titleKey: `${prefix}.right`, itemsKeys: [] } };
        case 'manifesto':
            return { type: 'manifesto', presentation: { surface: 'reading-light', rhythmProfile: 'reading' } };
        case 'spacer':
            return { type: 'spacer', size: 'md' };
        case 'advisor':
            return { type: 'advisor', titleKey: `${prefix}.title`, submitKey: `${prefix}.submit`, fallbackTitleKey: `${prefix}.fallback.title`, fallbackBodyKey: `${prefix}.fallback.body`, prompts: [] };
        case 'mermaid-diagram':
            return { type: 'mermaid-diagram', mermaidCode: 'graph LR\n  A-->B' };
        case 'data-list':
            return { type: 'data-list', dataUrl: '/api/data', columns: [{ key: 'id', labelKey: `${prefix}.col.id` }] };
        case 'action-form':
            return { type: 'action-form', titleKey: `${prefix}.title`, submitUrl: '/api/submit', submitKey: `${prefix}.submit`, successKey: `${prefix}.success`, fields: [{ name: 'name', type: 'text', labelKey: `${prefix}.name` }] };
        default:
            return { type: sectionType as any, presentation: {} } as any;
    }
}

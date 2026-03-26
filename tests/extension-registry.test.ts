import { describe, it, expect } from 'vitest';
import {
    createExtensionRegistry,
    registerSectionRenderer, registerGuardrail, registerCustomStatus,
    setContentResolver, setMediaResolver, registerEditorPanel,
    hasCustomRenderer, getCustomRenderer, runCustomGuardrails, getEditorPanels,
} from '../src/index.js';

describe('extension-registry', () => {
    it('creates an empty registry', () => {
        const reg = createExtensionRegistry();
        expect(reg.sectionRenderers.size).toBe(0);
        expect(reg.guardrails.size).toBe(0);
        expect(reg.customStatuses.size).toBe(0);
        expect(reg.contentResolver).toBeNull();
        expect(reg.mediaResolver).toBeNull();
        expect(reg.editorPanels.size).toBe(0);
    });

    it('registers and retrieves custom section renderer', () => {
        const reg = createExtensionRegistry();
        const renderer = () => {};
        registerSectionRenderer(reg, 'video', renderer);
        expect(hasCustomRenderer(reg, 'video')).toBe(true);
        expect(getCustomRenderer(reg, 'video')).toBe(renderer);
        expect(hasCustomRenderer(reg, 'unknown')).toBe(false);
    });

    it('registers and runs custom guardrails', () => {
        const reg = createExtensionRegistry();
        registerGuardrail(reg, 'no-empty-titles', () => [
            { type: 'custom-empty-title', severity: 'warning', file: 'test.json', message: 'Title is empty' },
        ]);
        const warnings = runCustomGuardrails(reg, { manifest: {} });
        expect(warnings).toHaveLength(1);
        expect(warnings[0].type).toBe('custom-empty-title');
    });

    it('registers custom statuses', () => {
        const reg = createExtensionRegistry();
        registerCustomStatus(reg, 'archived');
        registerCustomStatus(reg, 'review');
        expect(reg.customStatuses.has('archived')).toBe(true);
        expect(reg.customStatuses.size).toBe(2);
    });

    it('sets content resolver', () => {
        const reg = createExtensionRegistry();
        const resolver = (key: string) => `value-${key}`;
        setContentResolver(reg, resolver);
        expect(reg.contentResolver).toBe(resolver);
        expect(reg.contentResolver!('test')).toBe('value-test');
    });

    it('sets media resolver', () => {
        const reg = createExtensionRegistry();
        setMediaResolver(reg, (key) => key === 'logo' ? { url: '/logo.png' } : null);
        expect(reg.mediaResolver!('logo')).toEqual({ url: '/logo.png' });
        expect(reg.mediaResolver!('nope')).toBeNull();
    });

    it('registers and queries editor panels', () => {
        const reg = createExtensionRegistry();
        registerEditorPanel(reg, {
            id: 'video-settings',
            label: 'Video Settings',
            sectionTypes: ['video', 'hero'],
            render: () => {},
        });
        expect(getEditorPanels(reg, 'video')).toHaveLength(1);
        expect(getEditorPanels(reg, 'cards')).toHaveLength(0);
        expect(getEditorPanels(reg, 'hero')).toHaveLength(1);
    });
});

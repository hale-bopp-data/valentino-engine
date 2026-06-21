import { describe, it, expect } from 'vitest';
import { getProfileConfig, isValidProfile, buildSpaAuditScript } from '../src/core/spa-profile.js';
import { probeRhythm } from '../src/core/rhythm.js';
import type { PageSpecV1 } from '../src/core/types.js';

function makeSpec(sections: any[]): PageSpecV1 {
    return { version: '1', id: 'test', sections };
}

describe('spa-profile', () => {
    describe('getProfileConfig', () => {
        it('returns landing config by default', () => {
            const config = getProfileConfig('landing');
            expect(config.label).toContain('Landing');
            expect(config.rhythmRules.heroFirst).toBe(true);
            expect(config.rhythmRules.surfaceMonotony).toBe(true);
        });

        it('returns SPA config with relaxed rules', () => {
            const config = getProfileConfig('spa');
            expect(config.label).toContain('SPA');
            expect(config.rhythmRules.heroFirst).toBe(false);
            expect(config.rhythmRules.surfaceMonotony).toBe(false);
            expect(config.rhythmRules.consecutiveRhythm).toBe(false);
            expect(config.rhythmRules.spacerBetweenSameSurface).toBe(false);
        });

        it('returns dashboard config with relaxed rules', () => {
            const config = getProfileConfig('dashboard');
            expect(config.rhythmRules.heroFirst).toBe(false);
            expect(config.rhythmRules.surfaceMonotony).toBe(false);
        });

        it('SPA selectors include app-specific elements', () => {
            const config = getProfileConfig('spa');
            expect(config.visualSelectors).toContain('[role=tabpanel]');
            expect(config.visualSelectors).toContain('[role=toolbar]');
            expect(config.visualSelectors).toContain('.sidebar');
            expect(config.visualSelectors).toContain('.workspace');
        });

        it('dashboard selectors include data elements', () => {
            const config = getProfileConfig('dashboard');
            expect(config.visualSelectors).toContain('[role=grid]');
            expect(config.visualSelectors).toContain('.widget');
            expect(config.visualSelectors).toContain('table');
        });
    });

    describe('isValidProfile', () => {
        it('accepts valid profiles', () => {
            expect(isValidProfile('landing')).toBe(true);
            expect(isValidProfile('spa')).toBe(true);
            expect(isValidProfile('dashboard')).toBe(true);
        });

        it('rejects invalid profiles', () => {
            expect(isValidProfile('invalid')).toBe(false);
            expect(isValidProfile('')).toBe(false);
        });
    });

    describe('buildSpaAuditScript', () => {
        it('generates valid JS for SPA profile', () => {
            const script = buildSpaAuditScript('spa');
            expect(script).toContain('threshold');
            expect(script).toContain('violations');
            expect(script).toContain('warnings');
            expect(script).toContain('elementCount');
        });

        it('SPA script includes form-labels check', () => {
            const script = buildSpaAuditScript('spa');
            expect(script).toContain('aria-label');
            expect(script).toContain('interactiveCount');
        });

        it('SPA script includes tab-a11y check', () => {
            const script = buildSpaAuditScript('spa');
            expect(script).toContain('role=tablist');
            expect(script).toContain('role=tab');
        });

        it('SPA script includes sidebar-ratio check', () => {
            const script = buildSpaAuditScript('spa');
            expect(script).toContain('Sidebar width ratio');
        });

        it('SPA script includes nav-landmark check', () => {
            const script = buildSpaAuditScript('spa');
            expect(script).toContain('navigation landmark');
        });

        it('dashboard script omits tab-a11y check', () => {
            const script = buildSpaAuditScript('dashboard');
            expect(script).not.toContain('has no child elements with role=tab');
        });

        it('landing profile uses standard selectors', () => {
            const script = buildSpaAuditScript('landing');
            expect(script).not.toContain('sidebar-ratio');
            expect(script).not.toContain('form-labels');
        });
    });
});

describe('spa-profile — chat / data-table / form profiles (#3084)', () => {
    describe('getProfileConfig', () => {
        it('returns chat config with relaxed rhythm rules', () => {
            const config = getProfileConfig('chat');
            expect(config.label).toContain('Chat');
            expect(config.rhythmRules.heroFirst).toBe(false);
            expect(config.rhythmRules.surfaceMonotony).toBe(false);
            expect(config.rhythmRules.consecutiveRhythm).toBe(false);
            expect(config.rhythmRules.spacerBetweenSameSurface).toBe(false);
        });

        it('returns data-table config with relaxed rhythm rules', () => {
            const config = getProfileConfig('data-table');
            expect(config.label).toContain('Data Table');
            expect(config.rhythmRules.heroFirst).toBe(false);
            expect(config.rhythmRules.surfaceMonotony).toBe(false);
        });

        it('returns form config with relaxed rhythm rules', () => {
            const config = getProfileConfig('form');
            expect(config.label).toContain('Form');
            expect(config.rhythmRules.heroFirst).toBe(false);
        });

        it('chat selectors include conversational elements', () => {
            const config = getProfileConfig('chat');
            expect(config.visualSelectors).toContain('[role=log]');
            expect(config.visualSelectors).toContain('.message-list');
            expect(config.visualSelectors).toContain('.composer');
        });

        it('data-table selectors include table elements', () => {
            const config = getProfileConfig('data-table');
            expect(config.visualSelectors).toContain('table');
            expect(config.visualSelectors).toContain('[role=grid]');
            expect(config.visualSelectors).toContain('.table-wrapper');
        });

        it('form selectors include form-entry elements', () => {
            const config = getProfileConfig('form');
            expect(config.visualSelectors).toContain('form');
            expect(config.visualSelectors).toContain('fieldset');
            expect(config.visualSelectors).toContain('.form-group');
        });
    });

    describe('isValidProfile', () => {
        it('accepts the new profiles', () => {
            expect(isValidProfile('chat')).toBe(true);
            expect(isValidProfile('data-table')).toBe(true);
            expect(isValidProfile('form')).toBe(true);
        });

        it('still rejects near-miss names', () => {
            expect(isValidProfile('datatable')).toBe(false);
            expect(isValidProfile('chats')).toBe(false);
        });
    });

    describe('buildSpaAuditScript — chat', () => {
        it('generates valid JS scaffolding', () => {
            const script = buildSpaAuditScript('chat');
            expect(script).toContain('threshold');
            expect(script).toContain('violations');
            expect(script).toContain('warnings');
            expect(script).toContain('elementCount');
        });

        it('includes message-list scroll check', () => {
            const script = buildSpaAuditScript('chat');
            expect(script).toContain('No scrollable message list found');
            expect(script).toContain('messageListCount');
        });

        it('includes composer-pinned check', () => {
            const script = buildSpaAuditScript('chat');
            expect(script).toContain('Chat composer is not pinned');
            expect(script).toContain('composerPinned');
        });

        it('includes message-bubble overflow check', () => {
            const script = buildSpaAuditScript('chat');
            expect(script).toContain('Chat message bubble overflows');
            expect(script).toContain('bubbleCount');
        });

        it('does not include data-table-only checks', () => {
            const script = buildSpaAuditScript('chat');
            expect(script).not.toContain('has no sticky header');
        });
    });

    describe('buildSpaAuditScript — data-table', () => {
        it('generates valid JS scaffolding', () => {
            const script = buildSpaAuditScript('data-table');
            expect(script).toContain('threshold');
            expect(script).toContain('elementCount');
        });

        it('includes sticky-header check', () => {
            const script = buildSpaAuditScript('data-table');
            expect(script).toContain('has no sticky header');
            expect(script).toContain('tableCount');
        });

        it('includes horizontal-scroll containment check', () => {
            const script = buildSpaAuditScript('data-table');
            expect(script).toContain('not wrapped in a horizontally scrollable container');
        });

        it('includes density check', () => {
            const script = buildSpaAuditScript('data-table');
            expect(script).toContain('density risk');
            expect(script).toContain('tableRowCount');
        });

        it('does not include chat-only checks', () => {
            const script = buildSpaAuditScript('data-table');
            expect(script).not.toContain('Chat composer is not pinned');
        });
    });

    describe('buildSpaAuditScript — form', () => {
        it('includes form-labels check', () => {
            const script = buildSpaAuditScript('form');
            expect(script).toContain('aria-label');
            expect(script).toContain('interactiveCount');
        });

        it('omits chat and data-table checks', () => {
            const script = buildSpaAuditScript('form');
            expect(script).not.toContain('No scrollable message list found');
            expect(script).not.toContain('has no sticky header');
        });
    });

    describe('landing omits the new profile checks', () => {
        it('landing script has no chat or data-table markers', () => {
            const script = buildSpaAuditScript('landing');
            expect(script).not.toContain('No scrollable message list found');
            expect(script).not.toContain('has no sticky header');
        });
    });

    describe('probeRhythm with new profiles skips landing rules', () => {
        it('chat profile does not warn on hero-not-first', () => {
            const result = probeRhythm(makeSpec([
                { type: 'cards', variant: 'catalog', items: [] },
                { type: 'hero', titleKey: 'h' },
            ]), { profile: 'chat' });
            expect(result.warnings.filter(w => w.rule === 'hero-first')).toHaveLength(0);
            expect(result.profile).toBe('chat');
        });

        it('data-table profile does not warn on hero-not-first', () => {
            const result = probeRhythm(makeSpec([
                { type: 'cards', variant: 'catalog', items: [] },
                { type: 'hero', titleKey: 'h' },
            ]), { profile: 'data-table' });
            expect(result.warnings.filter(w => w.rule === 'hero-first')).toHaveLength(0);
            expect(result.profile).toBe('data-table');
        });

        it('form profile does not warn on hero-not-first', () => {
            const result = probeRhythm(makeSpec([
                { type: 'cards', variant: 'catalog', items: [] },
                { type: 'hero', titleKey: 'h' },
            ]), { profile: 'form' });
            expect(result.warnings.filter(w => w.rule === 'hero-first')).toHaveLength(0);
            expect(result.profile).toBe('form');
        });
    });
});

describe('probeRhythm with SPA profile', () => {
    it('does not warn on hero-not-first with SPA profile', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'hero', titleKey: 'h' },
        ]), { profile: 'spa' });
        expect(result.warnings.filter(w => w.rule === 'hero-first')).toHaveLength(0);
        expect(result.profile).toBe('spa');
    });

    it('warns on hero-not-first with landing profile (default)', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'hero', titleKey: 'h' },
        ]));
        expect(result.warnings.filter(w => w.rule === 'hero-first')).toHaveLength(1);
        expect(result.profile).toBe('landing');
    });

    it('does not warn on consecutive rhythm with SPA profile', () => {
        const result = probeRhythm(makeSpec([
            { type: 'cards', variant: 'catalog', items: [] },
            { type: 'how-it-works', steps: [] },
        ]), { profile: 'spa' });
        expect(result.warnings.filter(w => w.rule === 'no-consecutive-rhythm')).toHaveLength(0);
    });

    it('does not warn on surface monotony with SPA profile', () => {
        const result = probeRhythm(makeSpec([
            { type: 'data-list', columns: ['a'], dataUrl: 'x' },
            { type: 'data-list', columns: ['b'], dataUrl: 'y' },
            { type: 'action-form', fields: ['f1'], submitUrl: 'z' },
            { type: 'data-list', columns: ['c'], dataUrl: 'w' },
            { type: 'data-list', columns: ['d'], dataUrl: 'v' },
        ]), { profile: 'spa' });
        expect(result.warnings.filter(w => w.rule === 'surface-monotony')).toHaveLength(0);
    });

    it('does not warn on same surface without spacer with SPA profile', () => {
        const result = probeRhythm(makeSpec([
            { type: 'data-list', columns: ['a'], dataUrl: 'x' },
            { type: 'action-form', fields: ['f1'], submitUrl: 'z' },
        ]), { profile: 'spa' });
        expect(result.warnings.filter(w => w.rule === 'spacer-between-same-surface')).toHaveLength(0);
    });

    it('SPA profile produces zero warnings for typical ops layout', () => {
        const result = probeRhythm(makeSpec([
            { type: 'data-list', columns: ['a'], dataUrl: 'x', presentation: { surface: 'ops-light', rhythmProfile: 'ops' } },
            { type: 'data-list', columns: ['b'], dataUrl: 'y', presentation: { surface: 'ops-light', rhythmProfile: 'ops' } },
            { type: 'action-form', fields: ['f1'], submitUrl: 'z', presentation: { surface: 'ops-light', rhythmProfile: 'ops' } },
        ]), { profile: 'spa' });
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it('dashboard profile also skips landing rules', () => {
        const result = probeRhythm(makeSpec([
            { type: 'stats', items: [{ label: 'x', value: '1' }] },
            { type: 'stats', items: [{ label: 'y', value: '2' }] },
        ]), { profile: 'dashboard' });
        expect(result.warnings.filter(w => w.rule === 'no-consecutive-rhythm')).toHaveLength(0);
        expect(result.profile).toBe('dashboard');
    });
});

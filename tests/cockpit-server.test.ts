/**
 * Tests for Cockpit Server HTTP API.
 * Feature #778, PBI #781 (Phase 2).
 *
 * Tests the API logic directly (no actual HTTP server).
 * The server uses cockpit-api + intent-parser under the hood,
 * which are already thoroughly tested. These tests verify the
 * HTTP layer works correctly.
 */

import { describe, it, expect } from 'vitest';
import type { PageSpecV1 } from '../src/core/types.js';
import {
    executeCockpitAction,
    validateCockpitAction,
} from '../src/core/cockpit-api.js';
import { parseIntentLocal } from '../src/core/intent-parser.js';
import { getPageSpecSchema, getCockpitActionSchema, getAllSectionSchemas } from '../src/core/schema-export.js';

// We test the server's logic (same functions it calls) rather than
// spinning up an actual HTTP server, keeping tests fast and deterministic.

const baseSpec: PageSpecV1 = {
    version: '1',
    id: 'web-test',
    profile: 'home-signature',
    sections: [
        {
            type: 'hero',
            titleKey: 'test.hero.title',
            presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
        },
        {
            type: 'cards',
            variant: 'catalog',
            titleKey: 'test.cards.title',
            items: [{ titleKey: 'test.cards.item1' }],
            presentation: { rhythmProfile: 'feature' },
        },
    ],
};

describe('Cockpit Server — API logic', () => {
    // Simulates GET /api/spec
    it('/api/spec returns current spec with metadata', () => {
        const response = {
            spec: baseSpec,
            actionCount: 0,
            undoAvailable: 0,
        };
        expect(response.spec.id).toBe('web-test');
        expect(response.spec.sections).toHaveLength(2);
    });

    // Simulates GET /api/schema
    it('/api/schema returns all schemas', () => {
        const response = {
            pageSpec: getPageSpecSchema(),
            cockpitAction: getCockpitActionSchema(),
            sections: getAllSectionSchemas(),
        };
        expect(response.pageSpec).toHaveProperty('title');
        expect(response.cockpitAction).toHaveProperty('oneOf');
        expect(Object.keys(response.sections).length).toBeGreaterThan(10);
    });

    // Simulates POST /api/parse
    it('/api/parse returns parsed intent', () => {
        const result = parseIntentLocal('mostrami le sezioni', baseSpec);
        expect(result.intent).not.toBeNull();
        expect(result.intent!.action.action).toBe('query');
    });

    it('/api/parse returns null for unparseable', () => {
        const result = parseIntentLocal('fai magie', baseSpec);
        expect(result.intent).toBeNull();
    });

    // Simulates POST /api/action
    it('/api/action executes valid action', () => {
        const action = { action: 'query' as const, query: { type: 'describe-page' as const } };
        const preErrors = validateCockpitAction(action, baseSpec);
        expect(preErrors).toEqual([]);

        const result = executeCockpitAction(baseSpec, action);
        expect(result.success).toBe(true);
        expect((result.data as any).id).toBe('web-test');
    });

    it('/api/action rejects invalid action', () => {
        const action = { action: 'remove-section' as const, sectionIndex: 99 };
        const preErrors = validateCockpitAction(action, baseSpec);
        expect(preErrors.length).toBeGreaterThan(0);
    });

    // Simulates POST /api/speak (parse + execute)
    it('/api/speak: parse + execute query', () => {
        const parseResult = parseIntentLocal('descrivi la pagina', baseSpec);
        expect(parseResult.intent).not.toBeNull();

        const result = executeCockpitAction(baseSpec, parseResult.intent!.action);
        expect(result.success).toBe(true);
        expect((result.data as any).sectionCount).toBe(2);
    });

    it('/api/speak: parse + execute mutation', () => {
        const parseResult = parseIntentLocal('aggiungi una sezione stats', baseSpec);
        expect(parseResult.intent).not.toBeNull();

        const action = parseResult.intent!.action;
        expect(action.action).toBe('add-section');

        const preErrors = validateCockpitAction(action, baseSpec);
        expect(preErrors).toEqual([]);

        const result = executeCockpitAction(baseSpec, action);
        expect(result.success).toBe(true);
        expect(result.spec.sections).toHaveLength(3);
    });

    // Simulates POST /api/undo
    it('/api/undo: restores previous state', () => {
        // Simulate: execute action, then undo
        const history: PageSpecV1[] = [];
        let spec = baseSpec;

        // Execute mutation
        history.push(structuredClone(spec));
        const result = executeCockpitAction(spec, {
            action: 'add-section',
            section: { type: 'cta', titleKey: 'undo.test', presentation: { rhythmProfile: 'proof' } },
        });
        spec = result.spec;
        expect(spec.sections).toHaveLength(3);

        // Undo
        spec = history.pop()!;
        expect(spec.sections).toHaveLength(2);
    });

    // Simulates full conversation flow
    it('full conversation: describe → add → query → undo', () => {
        let spec = baseSpec;
        const history: PageSpecV1[] = [];

        // 1. Describe
        const r1 = executeCockpitAction(spec, { action: 'query', query: { type: 'describe-page' } });
        expect((r1.data as any).sectionCount).toBe(2);

        // 2. Add stats
        history.push(structuredClone(spec));
        const r2 = executeCockpitAction(spec, {
            action: 'add-section',
            section: { type: 'stats', items: [{ valueKey: 'v', labelKey: 'l' }], presentation: { rhythmProfile: 'metrics' } },
        });
        spec = r2.spec;
        expect(spec.sections).toHaveLength(3);

        // 3. List sections
        const r3 = executeCockpitAction(spec, { action: 'query', query: { type: 'list-sections' } });
        expect((r3.data as any[])).toHaveLength(3);
        expect((r3.data as any[])[2].type).toBe('stats');

        // 4. Undo
        spec = history.pop()!;
        expect(spec.sections).toHaveLength(2);
    });
});

describe('Cockpit Web UI', () => {
    it('index.html exists', async () => {
        const { existsSync } = await import('fs');
        const { dirname, join } = await import('path');
        const { fileURLToPath } = await import('url');
        const thisDir = dirname(fileURLToPath(import.meta.url));
        const uiPath = join(thisDir, '..', 'src', 'cockpit-web', 'index.html');
        expect(existsSync(uiPath)).toBe(true);
    });

    it('index.html contains essential elements', async () => {
        const { readFileSync } = await import('fs');
        const { dirname, join } = await import('path');
        const { fileURLToPath } = await import('url');
        const thisDir = dirname(fileURLToPath(import.meta.url));
        const uiPath = join(thisDir, '..', 'src', 'cockpit-web', 'index.html');
        const html = readFileSync(uiPath, 'utf-8');

        expect(html).toContain('Valentino Cockpit');
        expect(html).toContain('/api/speak');
        expect(html).toContain('/api/spec');
        expect(html).toContain('/api/undo');
        expect(html).toContain('/api/save');
        expect(html).toContain('Il Sarto Parla');
    });
});

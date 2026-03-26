/**
 * Minimal Consumer Example — valentino-engine standalone usage.
 * Demonstrates how a project OTHER than easyway-portal can use the engine.
 *
 * Run: npx tsx examples/minimal-consumer/index.ts
 */
import {
    // Page status
    getPageStatus, isPageVisible,
    // Redirects
    findRedirect,
    // Media
    resolveMediaUrl,
    // SEO
    buildWebPageSchema,
    // CMS guardrails
    collectPureCmsWarnings,
    // Extension registry
    createExtensionRegistry, registerGuardrail, registerCustomStatus, runCustomGuardrails,
} from '../../src/index.js';

import type { PagesManifestV1, ManifestPageV1, MediaManifest } from '../../src/index.js';

// ---------------------------------------------------------------------------
// 1. Page status workflow
// ---------------------------------------------------------------------------
const pages: ManifestPageV1[] = [
    { id: 'home', route: '/', spec: '/pages/home.json' },
    { id: 'blog', route: '/blog', spec: '/pages/blog.json', status: 'draft' },
    { id: 'launch', route: '/launch', spec: '/pages/launch.json', publishAt: '2099-06-01T00:00:00Z' },
];

console.log('--- Page Status ---');
for (const p of pages) {
    console.log(`  ${p.id}: status=${getPageStatus(p)}, visible=${isPageVisible(p)}`);
}

// ---------------------------------------------------------------------------
// 2. Redirects
// ---------------------------------------------------------------------------
const redirectRules = [
    { from: '/old-blog', to: '/blog' },
    { from: '/legacy', to: '/' },
];

console.log('\n--- Redirects ---');
console.log(`  /old-blog → ${findRedirect('/old-blog', redirectRules)}`);
console.log(`  /unknown  → ${findRedirect('/unknown', redirectRules)}`);

// ---------------------------------------------------------------------------
// 3. Media resolver
// ---------------------------------------------------------------------------
const mediaManifest: MediaManifest = {
    version: '1',
    assets: [
        { key: 'logo', file: '/img/logo.svg', alt: 'My Logo' },
        { key: 'hero-bg', file: '/img/hero.webp', width: 1920, height: 1080 },
    ],
};

console.log('\n--- Media ---');
console.log(`  logo → ${resolveMediaUrl(mediaManifest, 'logo')}`);

// ---------------------------------------------------------------------------
// 4. SEO — Schema.org builder
// ---------------------------------------------------------------------------
const schema = buildWebPageSchema({
    title: 'My Site — Home',
    url: 'https://mysite.com/',
    description: 'A minimal site built with valentino-engine',
    sectionTypes: ['hero', 'cards', 'cta'],
});

console.log('\n--- Schema.org ---');
console.log(JSON.stringify(schema, null, 2));

// ---------------------------------------------------------------------------
// 5. CMS guardrails
// ---------------------------------------------------------------------------
const manifest: PagesManifestV1 = {
    version: '1',
    defaultLanguage: 'en',
    navigation: { interactionMode: 'hover', items: [] },
    pages,
};

const warnings = collectPureCmsWarnings(manifest, { redirectRules });
console.log('\n--- CMS Guardrails ---');
if (warnings.length === 0) {
    console.log('  All checks passed!');
} else {
    for (const w of warnings) {
        console.log(`  [${w.severity}] ${w.type}: ${w.message}`);
    }
}

// ---------------------------------------------------------------------------
// 6. Extension registry — custom guardrail + custom status
// ---------------------------------------------------------------------------
const registry = createExtensionRegistry();

registerCustomStatus(registry, 'archived');

registerGuardrail(registry, 'no-empty-route', (ctx) => {
    const m = ctx.manifest as PagesManifestV1;
    return m.pages
        .filter((p) => !p.route || p.route.trim() === '')
        .map((p) => ({
            type: 'custom-empty-route',
            severity: 'error' as const,
            file: p.spec,
            message: `Page "${p.id}" has an empty route`,
        }));
});

const customWarnings = runCustomGuardrails(registry, { manifest });
console.log('\n--- Custom Guardrails ---');
console.log(`  Custom statuses: ${[...registry.customStatuses].join(', ')}`);
console.log(`  Custom warnings: ${customWarnings.length}`);

console.log('\nDone. valentino-engine works standalone.');

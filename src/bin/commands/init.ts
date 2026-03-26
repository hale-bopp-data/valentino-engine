/**
 * valentino init — Scaffolding interattivo per nuovi progetti.
 * Crea un progetto completo con page spec, content, catalog, guardrails.
 *
 * Usage: valentino init <name> [--template <id>] [--lang <code>] [--git <url>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as readline from 'node:readline';

// ---------------------------------------------------------------------------
// Template definitions — what pages each template generates
// ---------------------------------------------------------------------------
type TemplateDef = {
    label: string;
    description: string;
    blueprintId: string | null;       // from catalog, or null for minimal
    pages: PageDef[];
    guardrails: Record<string, { severity: string; [k: string]: unknown }>;
};

type PageDef = {
    id: string;
    route: string;
    titleKey: string;
    spec: object;
    contentKeys: Record<string, string>;  // key → placeholder text
};

const TEMPLATES: Record<string, TemplateDef> = {
    'minimal': {
        label: 'Minimal',
        description: '2 pagine (home + about) — perfetto per iniziare',
        blueprintId: null,
        pages: [
            {
                id: 'home', route: '/', titleKey: 'home.hero.title',
                spec: {
                    version: '1', id: 'home',
                    sections: [
                        { type: 'hero', presentation: { surface: 'dark', rhythmProfile: 'hero' }, titleKey: 'home.hero.title', taglineKey: 'home.hero.tagline' },
                        { type: 'cards', presentation: { surface: 'muted', rhythmProfile: 'feature' }, titleKey: 'home.cards.title', variant: 'feature', items: [
                            { titleKey: 'home.cards.item1.title', descKey: 'home.cards.item1.desc' },
                            { titleKey: 'home.cards.item2.title', descKey: 'home.cards.item2.desc' },
                            { titleKey: 'home.cards.item3.title', descKey: 'home.cards.item3.desc' },
                        ]},
                        { type: 'cta', presentation: { surface: 'accent', rhythmProfile: 'transition' }, titleKey: 'home.cta.title', primary: { labelKey: 'home.cta.primary', action: { type: 'link', href: '/about' } } },
                    ],
                },
                contentKeys: {
                    'home.hero.title': 'Welcome to {{name}}',
                    'home.hero.tagline': 'Your tagline here',
                    'home.cards.title': 'What we offer',
                    'home.cards.item1.title': 'Feature 1', 'home.cards.item1.desc': 'Description of feature 1',
                    'home.cards.item2.title': 'Feature 2', 'home.cards.item2.desc': 'Description of feature 2',
                    'home.cards.item3.title': 'Feature 3', 'home.cards.item3.desc': 'Description of feature 3',
                    'home.cta.title': 'Get started', 'home.cta.primary': 'Learn more',
                },
            },
            {
                id: 'about', route: '/about', titleKey: 'about.hero.title',
                spec: {
                    version: '1', id: 'about',
                    sections: [
                        { type: 'hero', presentation: { surface: 'dark', rhythmProfile: 'hero' }, titleKey: 'about.hero.title', taglineKey: 'about.hero.tagline' },
                        { type: 'cards', presentation: { surface: 'default', rhythmProfile: 'reading' }, titleKey: 'about.team.title', variant: 'feature', items: [
                            { titleKey: 'about.team.item1.title', descKey: 'about.team.item1.desc' },
                            { titleKey: 'about.team.item2.title', descKey: 'about.team.item2.desc' },
                        ]},
                    ],
                },
                contentKeys: {
                    'about.hero.title': 'About us',
                    'about.hero.tagline': 'Our story',
                    'about.team.title': 'The team',
                    'about.team.item1.title': 'Member 1', 'about.team.item1.desc': 'Role and bio',
                    'about.team.item2.title': 'Member 2', 'about.team.item2.desc': 'Role and bio',
                },
            },
        ],
        guardrails: {
            'seo': { severity: 'warning' },
            'i18n': { severity: 'off' },
            'media': { severity: 'warning', maxSizeKb: 500 },
            'contrast': { severity: 'warning', level: 'AA' },
            'rhythm': { severity: 'warning' },
            'draft-orphan': { severity: 'warning' },
            'redirect': { severity: 'error' },
            '404': { severity: 'error' },
        },
    },
    'product': {
        label: 'Product',
        description: '4 pagine (hero, offerta, confronto, CTA) — sito prodotto',
        blueprintId: 'product-surface',
        pages: [], // generated from blueprint
        guardrails: {
            'seo': { severity: 'error', required: true },
            'i18n': { severity: 'warning', minLanguages: 2 },
            'media': { severity: 'warning', maxSizeKb: 500 },
            'contrast': { severity: 'error', level: 'AA' },
            'rhythm': { severity: 'warning' },
            'draft-orphan': { severity: 'warning', staleDays: 30 },
            'redirect': { severity: 'error' },
            '404': { severity: 'error' },
        },
    },
    'advisor': {
        label: 'Advisor',
        description: '4 pagine con interfaccia consulenza AI',
        blueprintId: 'advisor-review',
        pages: [],
        guardrails: {
            'seo': { severity: 'warning' },
            'i18n': { severity: 'off' },
            'media': { severity: 'warning' },
            'contrast': { severity: 'error', level: 'AA' },
            'rhythm': { severity: 'warning' },
            'form': { severity: 'error' },
            'cta-presence': { severity: 'error', minCta: 1 },
            '404': { severity: 'error' },
        },
    },
    'conversion': {
        label: 'Conversion',
        description: 'Landing page con form di contatto/demo',
        blueprintId: 'conversion-intake',
        pages: [],
        guardrails: {
            'seo': { severity: 'error', required: true },
            'i18n': { severity: 'off' },
            'contrast': { severity: 'error', level: 'AA' },
            'cta-presence': { severity: 'error', minCta: 1 },
            'form': { severity: 'error' },
            'above-the-fold': { severity: 'warning' },
            '404': { severity: 'error' },
        },
    },
};

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------
function ask(rl: readline.Interface, question: string, defaultVal?: string): Promise<string> {
    const suffix = defaultVal ? ` (${defaultVal})` : '';
    return new Promise((resolve) => {
        rl.question(`  ${question}${suffix}: `, (answer) => {
            resolve(answer.trim() || defaultVal || '');
        });
    });
}

function chooseTemplate(rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => {
        console.log('\n  Available templates:');
        const keys = Object.keys(TEMPLATES);
        keys.forEach((k, i) => {
            const t = TEMPLATES[k];
            console.log(`    ${i + 1}. ${t.label} — ${t.description}`);
        });
        rl.question(`\n  Choose template (1-${keys.length}): `, (answer) => {
            const idx = parseInt(answer.trim(), 10) - 1;
            resolve(keys[idx] || keys[0]);
        });
    });
}

// ---------------------------------------------------------------------------
// Scaffold generator
// ---------------------------------------------------------------------------
export function generateProject(
    projectDir: string,
    projectName: string,
    lang: string,
    templateId: string,
    guardrailsEnabled: boolean,
): void {
    const template = TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    // Create directories
    const dirs = ['public/pages', 'public/content', 'public/media', 'public/runtime'];
    for (const d of dirs) {
        fs.mkdirSync(path.join(projectDir, d), { recursive: true });
    }

    // Content: collect all content keys from pages
    const contentEN: Record<string, Record<string, string>> = {};
    const contentLocal: Record<string, Record<string, string>> = {};

    for (const page of template.pages) {
        for (const [key, val] of Object.entries(page.contentKeys)) {
            const parts = key.split('.');
            const section = parts[0];
            if (!contentEN[section]) contentEN[section] = {};
            contentEN[section][parts.slice(1).join('.')] = (val as string).replace('{{name}}', projectName);
            if (lang !== 'en') {
                if (!contentLocal[section]) contentLocal[section] = {};
                contentLocal[section][parts.slice(1).join('.')] = `[${lang.toUpperCase()}] ${(val as string).replace('{{name}}', projectName)}`;
            }
        }
    }

    // Pages manifest
    const manifest = {
        version: '1',
        defaultLanguage: lang,
        maintenanceMode: false,
        navigation: {
            interactionMode: 'hover',
            items: template.pages.map((p, i) => ({
                id: p.id,
                labelKey: `nav.${p.id}`,
                href: p.route,
                pageId: p.id,
                order: (i + 1) * 10,
            })),
        },
        pages: [
            ...template.pages.map((p) => ({
                id: p.id,
                route: p.route,
                titleKey: p.titleKey,
                spec: `/pages/${p.id}.json`,
                nav: { labelKey: `nav.${p.id}`, order: template.pages.indexOf(p) * 10 + 10 },
            })),
            { id: 'not-found', route: '/404', spec: '/pages/not-found.json', titleKey: 'notFound.title' },
        ],
    };

    // Add nav keys to content
    contentEN['nav'] = {};
    for (const p of template.pages) {
        contentEN['nav'][p.id] = p.id.charAt(0).toUpperCase() + p.id.slice(1);
    }
    contentEN['notFound'] = { title: 'Page not found', body: 'The page you are looking for does not exist.' };

    // Write files
    writeJSON(projectDir, 'public/pages/pages.manifest.json', manifest);

    for (const page of template.pages) {
        writeJSON(projectDir, `public/pages/${page.id}.json`, page.spec);
    }

    // 404 page
    writeJSON(projectDir, 'public/pages/not-found.json', {
        version: '1', id: 'not-found',
        sections: [
            { type: 'hero', presentation: { surface: 'dark', rhythmProfile: 'hero' }, titleKey: 'notFound.title', taglineKey: 'notFound.body' },
        ],
    });

    // Content files
    writeJSON(projectDir, 'public/content/content.json', contentEN);
    if (lang !== 'en') {
        writeJSON(projectDir, `public/content/${lang}.json`, contentLocal);
    }

    // Media manifest (empty)
    writeJSON(projectDir, 'public/media/media.manifest.json', { version: '1', assets: [] });

    // Redirects (empty)
    writeJSON(projectDir, 'public/redirects.json', { version: '1', rules: [] });

    // Catalog (from engine defaults)
    writeJSON(projectDir, 'public/runtime/valentino.catalog.json', getDefaultCatalog());

    // Guardrails profile
    writeJSON(projectDir, 'valentino.guardrails.json', {
        template: templateId,
        guardrails: template.guardrails,
    });

    // Config
    writeJSON(projectDir, 'valentino.config.json', {
        name: projectName,
        version: '1',
        defaultLanguage: lang,
        template: templateId,
        engine: '@hale-bopp/valentino-engine',
    });

    // package.json
    writeJSON(projectDir, 'package.json', {
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            validate: 'valentino validate public/pages/*.json',
            'probe:all': 'valentino probe all public/pages/*.json',
            audit: 'valentino audit',
        },
        dependencies: {
            '@hale-bopp/valentino-engine': '^1.1.0',
        },
    });

    // .gitignore
    fs.writeFileSync(path.join(projectDir, '.gitignore'), [
        'node_modules/', 'dist/', '.DS_Store', '*.log', '.env', '.env.*',
    ].join('\n') + '\n');

    // README
    const readme = `# ${projectName}

Built with [valentino-engine](https://github.com/hale-bopp-data/valentino-engine).

## Quick start

\`\`\`bash
npm install
npx valentino validate public/pages/*.json   # Validate page specs
npx valentino probe all public/pages/*.json   # Run all probes
\`\`\`

## How to add a page

1. Create \`public/pages/my-page.json\` with sections (hero, cards, cta, form...)
2. Register it in \`public/pages/pages.manifest.json\`
3. Add content keys in \`public/content/content.json\`
4. Run \`npx valentino validate\` to check

## Template: ${templateId}

${template.description}

## Guardrails

This project uses the \`${templateId}\` guardrail profile. Edit \`valentino.guardrails.json\` to customize.

## Structure

\`\`\`
public/
  pages/          Page spec JSON files
  content/        i18n content (content.json = EN, ${lang}.json = ${lang.toUpperCase()})
  media/          Media assets + manifest
  runtime/        Valentino catalog (templates, presets, blueprints)
valentino.config.json       Project config
valentino.guardrails.json   Guardrail profile
\`\`\`
`;
    fs.writeFileSync(path.join(projectDir, 'README.md'), readme);

    // Pre-commit hook (optional)
    if (guardrailsEnabled) {
        const hooksDir = path.join(projectDir, '.husky');
        fs.mkdirSync(hooksDir, { recursive: true });
        fs.writeFileSync(path.join(hooksDir, 'pre-commit'),
            '#!/usr/bin/env sh\nnpx valentino validate public/pages/*.json\n',
        );
        try { fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755); } catch { /* Windows */ }
    }
}

function writeJSON(base: string, relPath: string, data: unknown): void {
    const full = path.join(base, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n');
}

function getDefaultCatalog(): object {
    // Minimal catalog with core presets — consumer can extend
    return {
        version: '1',
        templates: {
            'home-signature-template': { page: { profile: 'home-signature' } },
            'product-surface-template': { page: { profile: 'product-surface' } },
            'advisor-surface-template': { page: { profile: 'advisor-surface' } },
            'conversion-form-template': { page: { profile: 'conversion-form' } },
        },
        sectionPresets: {
            'hero-home-signature': { presentation: { surface: 'dark', tone: 'immersive', rhythmProfile: 'hero' } },
            'hero-shell-immersive': { presentation: { surface: 'shell-dark', surfaceScreen: 'immersive', tone: 'immersive', rhythmProfile: 'hero' } },
            'cards-muted-feature': { presentation: { surface: 'muted', rhythmProfile: 'feature' } },
            'cards-muted-proof': { presentation: { surface: 'muted', rhythmProfile: 'proof' } },
            'cta-accent-closeout': { presentation: { surface: 'accent', rhythmProfile: 'transition' } },
            'form-default-transition': { presentation: { surface: 'default', rhythmProfile: 'transition' } },
        },
        transitionProfiles: {
            'hero-intro-merge': { presentation: { seamProfile: 'hero-intro-merge', seamDensity: 'default', surfaceEntry: 'slab' } },
        },
        pageBlueprints: {},
    };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function runInit(args: string[]): Promise<void> {
    // Parse flags
    let projectName = '';
    let templateId = '';
    let lang = '';
    let gitUrl = '';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--template' && args[i + 1]) { templateId = args[++i]; continue; }
        if (args[i] === '--lang' && args[i + 1]) { lang = args[++i]; continue; }
        if (args[i] === '--git' && args[i + 1]) { gitUrl = args[++i]; continue; }
        if (!args[i].startsWith('-') && !projectName) { projectName = args[i]; }
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n  🎨 Valentino Init — Create a new project\n');

    // 1. Name
    if (!projectName) {
        projectName = await ask(rl, 'Project name', 'my-valentino-site');
    }

    // 2. Template
    if (!templateId || !TEMPLATES[templateId]) {
        templateId = await chooseTemplate(rl);
    }

    // 3. Language
    if (!lang) {
        lang = await ask(rl, 'Default language', 'en');
    }

    // 4. Git remote
    if (!gitUrl) {
        gitUrl = await ask(rl, 'Git remote URL (optional, press Enter to skip)');
    }

    // 5. Guardrails
    const guardrailsAnswer = await ask(rl, 'Enable pre-commit guardrails? (Y/n)', 'Y');
    const guardrailsEnabled = guardrailsAnswer.toLowerCase() !== 'n';

    rl.close();

    // Generate
    const projectDir = path.resolve(process.cwd(), projectName);
    if (fs.existsSync(projectDir)) {
        console.error(`\n  Error: directory "${projectName}" already exists.`);
        process.exit(1);
    }

    console.log(`\n  Creating project "${projectName}" with template "${templateId}"...`);

    generateProject(projectDir, projectName, lang, templateId, guardrailsEnabled);

    // Git init
    if (gitUrl || guardrailsEnabled) {
        try {
            execSync('git init', { cwd: projectDir, stdio: 'pipe' });
            if (gitUrl) {
                execSync(`git remote add origin ${gitUrl}`, { cwd: projectDir, stdio: 'pipe' });
            }
            execSync('git add -A', { cwd: projectDir, stdio: 'pipe' });
            execSync('git commit -m "Initial commit — valentino init"', { cwd: projectDir, stdio: 'pipe' });
            console.log('  ✓ Git initialized' + (gitUrl ? ` with remote ${gitUrl}` : ''));
        } catch {
            console.log('  ⚠ Git init failed — you can do it manually');
        }
    }

    // Summary
    const template = TEMPLATES[templateId];
    const pageCount = template.pages.length + 1; // +1 for 404
    console.log(`
  ✓ Project "${projectName}" created with template "${templateId}"
  ✓ ${pageCount} pages, language: ${lang}, guardrails: ${guardrailsEnabled ? 'active' : 'off'}

  Next steps:
    cd ${projectName}
    npm install
    # Edit public/content/content.json — replace placeholder text
    npx valentino validate public/pages/*.json
`);
}

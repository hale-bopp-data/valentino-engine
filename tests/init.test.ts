import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateProject } from '../src/bin/commands/init.js';

describe('valentino init — generateProject', () => {
    let tmpDir: string;
    let projectDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valentino-init-'));
        projectDir = path.join(tmpDir, 'test-site');
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates all expected directories', () => {
        generateProject(projectDir, 'test-site', 'it', 'minimal', false);
        expect(fs.existsSync(path.join(projectDir, 'public/pages'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'public/content'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'public/media'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'public/runtime'))).toBe(true);
    });

    it('creates package.json with engine dependency', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(pkg.name).toBe('test-site');
        expect(pkg.dependencies['@hale-bopp/valentino-engine']).toBeDefined();
    });

    it('creates valentino.config.json with correct settings', () => {
        generateProject(projectDir, 'my-app', 'it', 'minimal', false);
        const config = JSON.parse(fs.readFileSync(path.join(projectDir, 'valentino.config.json'), 'utf-8'));
        expect(config.name).toBe('my-app');
        expect(config.defaultLanguage).toBe('it');
        expect(config.template).toBe('minimal');
    });

    it('creates guardrails profile matching template', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const guardrails = JSON.parse(fs.readFileSync(path.join(projectDir, 'valentino.guardrails.json'), 'utf-8'));
        expect(guardrails.template).toBe('minimal');
        expect(guardrails.guardrails).toBeDefined();
        expect(guardrails.guardrails['404'].severity).toBe('error');
    });

    it('creates page specs for minimal template (home + about + 404)', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        expect(fs.existsSync(path.join(projectDir, 'public/pages/home.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'public/pages/about.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'public/pages/not-found.json'))).toBe(true);
    });

    it('creates manifest with correct page entries', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'public/pages/pages.manifest.json'), 'utf-8'));
        expect(manifest.pages.length).toBe(3); // home + about + 404
        expect(manifest.pages.map((p: any) => p.id)).toContain('not-found');
    });

    it('creates content files with placeholder text', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const content = JSON.parse(fs.readFileSync(path.join(projectDir, 'public/content/content.json'), 'utf-8'));
        expect(content.home).toBeDefined();
        expect(content.home['hero.title']).toBe('Welcome to test-site');
    });

    it('creates IT content when lang=it', () => {
        generateProject(projectDir, 'test-site', 'it', 'minimal', false);
        expect(fs.existsSync(path.join(projectDir, 'public/content/it.json'))).toBe(true);
    });

    it('does NOT create IT content when lang=en', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        expect(fs.existsSync(path.join(projectDir, 'public/content/it.json'))).toBe(false);
    });

    it('creates empty media manifest', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const media = JSON.parse(fs.readFileSync(path.join(projectDir, 'public/media/media.manifest.json'), 'utf-8'));
        expect(media.assets).toEqual([]);
    });

    it('creates catalog with templates and presets', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const catalog = JSON.parse(fs.readFileSync(path.join(projectDir, 'public/runtime/valentino.catalog.json'), 'utf-8'));
        expect(catalog.version).toBe('1');
        expect(Object.keys(catalog.templates).length).toBeGreaterThan(0);
        expect(Object.keys(catalog.sectionPresets).length).toBeGreaterThan(0);
    });

    it('creates .gitignore', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        const gi = fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf-8');
        expect(gi).toContain('node_modules/');
    });

    it('creates README with project name', () => {
        generateProject(projectDir, 'my-cool-site', 'en', 'minimal', false);
        const readme = fs.readFileSync(path.join(projectDir, 'README.md'), 'utf-8');
        expect(readme).toContain('my-cool-site');
    });

    it('creates pre-commit hook when guardrails enabled', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', true);
        expect(fs.existsSync(path.join(projectDir, '.husky/pre-commit'))).toBe(true);
    });

    it('does NOT create pre-commit hook when guardrails disabled', () => {
        generateProject(projectDir, 'test-site', 'en', 'minimal', false);
        expect(fs.existsSync(path.join(projectDir, '.husky'))).toBe(false);
    });

    it('works with product template', () => {
        generateProject(projectDir, 'test-site', 'en', 'product', false);
        const guardrails = JSON.parse(fs.readFileSync(path.join(projectDir, 'valentino.guardrails.json'), 'utf-8'));
        expect(guardrails.template).toBe('product');
        expect(guardrails.guardrails.seo.severity).toBe('error');
    });
});

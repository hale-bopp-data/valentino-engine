/**
 * Tests for Project Adapter module.
 * Feature #784, PBI #788.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    scanProjectDirectory,
    analyzeHtmlStructure,
    importFromProject,
} from '../src/core/project-adapter.js';
import type { HtmlLlmCallback } from '../src/core/url-import.js';
import { COCKPIT_SECTION_TYPES } from '../src/core/cockpit-api.js';

// ---------------------------------------------------------------------------
// Temp project fixture
// ---------------------------------------------------------------------------

let tempDir: string;

function createTempProject() {
    tempDir = mkdtempSync(join(tmpdir(), 'valentino-test-'));
    writeFileSync(join(tempDir, 'index.html'), `
<!DOCTYPE html>
<html>
<head><title>Test Site</title></head>
<body>
  <header class="hero">
    <h1>Welcome to Test Site</h1>
    <p>A tagline here</p>
  </header>
  <section class="features">
    <div class="card"><h3>Feature 1</h3><p>Description</p></div>
    <div class="card"><h3>Feature 2</h3><p>Description</p></div>
  </section>
  <section class="cta">
    <h2>Get Started</h2>
    <a href="/signup">Sign Up</a>
  </section>
  <footer><p>Footer</p></footer>
</body>
</html>`);
    writeFileSync(join(tempDir, 'about.html'), `
<!DOCTYPE html>
<html>
<head><title>About</title></head>
<body>
  <h1>About Us</h1>
  <article class="content">Long form content here...</article>
</body>
</html>`);
    mkdirSync(join(tempDir, 'css'));
    writeFileSync(join(tempDir, 'css', 'style.css'), `
:root {
  --primary: #3b82f6;
  --dark: #1e293b;
}
body { font-family: 'Inter', sans-serif; color: #333; }
.hero { background: #1e293b; }
.card { border: 1px solid #e5e7eb; }
`);
}

function cleanupTempProject() {
    try { rmSync(tempDir, { recursive: true }); } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scanProjectDirectory', () => {
    it('finds HTML and CSS files', () => {
        createTempProject();
        try {
            const scan = scanProjectDirectory(tempDir);
            expect(scan.htmlFiles.length).toBe(2);
            expect(scan.cssFiles.length).toBe(1);
        } finally { cleanupTempProject(); }
    });

    it('extracts colors from CSS', () => {
        createTempProject();
        try {
            const scan = scanProjectDirectory(tempDir);
            expect(scan.colors.length).toBeGreaterThan(0);
            expect(scan.colors).toContain('#3b82f6');
        } finally { cleanupTempProject(); }
    });

    it('extracts fonts from CSS', () => {
        createTempProject();
        try {
            const scan = scanProjectDirectory(tempDir);
            expect(scan.fonts.length).toBeGreaterThan(0);
        } finally { cleanupTempProject(); }
    });

    it('returns empty for nonexistent path', () => {
        const scan = scanProjectDirectory('/nonexistent/path/xyz');
        expect(scan.htmlFiles).toEqual([]);
    });
});

describe('analyzeHtmlStructure', () => {
    it('detects hero from header/h1', () => {
        const sections = analyzeHtmlStructure('<header><h1>Title</h1></header>');
        expect(sections.some(s => s.type === 'hero')).toBe(true);
    });

    it('detects cards from .card class', () => {
        const sections = analyzeHtmlStructure('<div class="card">Card</div>');
        expect(sections.some(s => s.type === 'cards')).toBe(true);
    });

    it('detects form from <form>', () => {
        const sections = analyzeHtmlStructure('<form><input type="email"></form>');
        expect(sections.some(s => s.type === 'form')).toBe(true);
    });

    it('detects cta from .cta class', () => {
        const sections = analyzeHtmlStructure('<section class="cta"><h2>Act Now</h2></section>');
        expect(sections.some(s => s.type === 'cta')).toBe(true);
    });

    it('detects stats from .stat class', () => {
        const sections = analyzeHtmlStructure('<div class="stats"><span>100+</span></div>');
        expect(sections.some(s => s.type === 'stats')).toBe(true);
    });

    it('detects how-it-works from .step class', () => {
        const sections = analyzeHtmlStructure('<div class="step">Step 1</div>');
        expect(sections.some(s => s.type === 'how-it-works')).toBe(true);
    });

    it('detects manifesto from <article>', () => {
        const sections = analyzeHtmlStructure('<article>Long content</article>');
        expect(sections.some(s => s.type === 'manifesto')).toBe(true);
    });

    it('all detected types are in closed registry', () => {
        const html = '<header class="hero"><h1>Hi</h1></header><div class="card">c</div><form>f</form><section class="cta">go</section>';
        const sections = analyzeHtmlStructure(html);
        for (const s of sections) {
            expect(COCKPIT_SECTION_TYPES).toContain(s.type);
        }
    });
});

describe('importFromProject', () => {
    const mockLlm: HtmlLlmCallback = async () => JSON.stringify({
        version: '1',
        id: 'llm-result',
        profile: 'home-signature',
        sections: [
            { type: 'hero', titleKey: 'imported.hero', presentation: { rhythmProfile: 'hero' } },
            { type: 'cards', variant: 'catalog', titleKey: 'imported.cards', items: [{ titleKey: 'f1' }], presentation: { rhythmProfile: 'feature' } },
            { type: 'cta', titleKey: 'imported.cta', presentation: { rhythmProfile: 'proof' } },
        ],
    });

    it('imports project successfully', async () => {
        createTempProject();
        try {
            const result = await importFromProject(tempDir, mockLlm);
            expect(result.success).toBe(true);
            expect(result.pages.length).toBe(2);
            expect(result.primarySpec).not.toBeNull();
            expect(result.scan.htmlFiles.length).toBe(2);
        } finally { cleanupTempProject(); }
    });

    it('returns primary spec from index.html', async () => {
        createTempProject();
        try {
            const result = await importFromProject(tempDir, mockLlm);
            const indexPage = result.pages.find(p => p.file.includes('index'));
            expect(indexPage).toBeDefined();
            expect(indexPage!.success).toBe(true);
        } finally { cleanupTempProject(); }
    });

    it('fails gracefully for nonexistent directory', async () => {
        const result = await importFromProject('/nonexistent/xyz', mockLlm);
        expect(result.success).toBe(false);
        expect(result.warnings[0]).toContain('not found');
    });

    it('fails gracefully for empty directory', async () => {
        const emptyDir = mkdtempSync(join(tmpdir(), 'valentino-empty-'));
        try {
            const result = await importFromProject(emptyDir, mockLlm);
            expect(result.success).toBe(false);
            expect(result.warnings[0]).toContain('No HTML');
        } finally { rmSync(emptyDir, { recursive: true }); }
    });
});

describe('Project Import — UI', () => {
    it('index.html contains project import elements', async () => {
        const { readFileSync } = await import('fs');
        const { dirname, join: joinPath } = await import('path');
        const { fileURLToPath } = await import('url');
        const thisDir = dirname(fileURLToPath(import.meta.url));
        const html = readFileSync(joinPath(thisDir, '..', 'src', 'cockpit-web', 'index.html'), 'utf-8');

        expect(html).toContain('/api/import/project');
        expect(html).toContain('tabProject');
        expect(html).toContain('importProjectPath');
    });
});

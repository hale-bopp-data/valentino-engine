import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spool } from '../src/core/spool.js';

function makeTempDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'spool-test-'));
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    const parent = full.replace(/[/\\][^/\\]+$/, '');
    mkdirSync(parent, { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

describe('spool — accent detection with saturation filter', () => {
  it('classifies saturated mid-range colors as accent', () => {
    const dir = makeTempDir({
      'style.css': `
        .btn { background: #2196f3; }
        .btn { background: #2196f3; }
        .btn { background: #2196f3; }
      `,
    });
    const result = spool(dir);
    const blue = result.analysis.accents.find(c => c.value === '#2196f3');
    expect(blue).toBeDefined();
    expect(blue!.role).toBe('accent');
  });

  it('classifies unsaturated mid-range colors as border (gray)', () => {
    const dir = makeTempDir({
      'style.css': `
        .border { color: #808080; }
        .border { color: #808080; }
        .border { color: #808080; }
        .divider { color: #999999; }
        .divider { color: #999999; }
      `,
    });
    const result = spool(dir);
    // Grays should NOT appear as accents
    expect(result.analysis.accents.length).toBe(0);
    // They should be classified as border
    const gray = result.analysis.colors.find(c => c.value === '#808080');
    expect(gray).toBeDefined();
    expect(gray!.role).toBe('border');
  });

  it('does not promote low-saturation colors to accent slots in tokens', () => {
    const dir = makeTempDir({
      'style.css': `
        body { background: #ffffff; color: #222222; }
        .card { background: #f5f5f5; border: 1px solid #cccccc; }
        .muted { color: #888888; }
        .link { color: #2196f3; }
      `,
    });
    const result = spool(dir);
    // Only #2196f3 should be accent (saturated blue, lum ~0.28)
    expect(result.analysis.accents.length).toBe(1);
    expect(result.analysis.accents[0].value).toBe('#2196f3');
    // Token CSS should include only the real accent
    expect(result.customTokensCss).toContain('#2196f3');
    expect(result.customTokensCss).not.toContain('#888888');
    expect(result.customTokensCss).not.toContain('#cccccc');
  });
});

describe('spool — directory analysis', () => {
  it('throws on empty directory', () => {
    const dir = makeTempDir({});
    // Add a non-css file so dir exists
    writeFileSync(join(dir, 'readme.txt'), 'hello');
    expect(() => spool(dir)).toThrow('No CSS files found');
  });

  it('detects hero and suggests landing for small sites', () => {
    const dir = makeTempDir({
      'style.css': `
        .hero { height: 100vh; }
        section { padding: 2rem; }
        .cta { background: #ff5722; }
      `,
    });
    const result = spool(dir);
    expect(result.analysis.hasHero).toBe(true);
    expect(result.analysis.suggestedTemplate).toBe('landing');
  });

  it('detects blog pattern', () => {
    const dir = makeTempDir({
      'blog.css': `
        .post { margin: 1rem; }
        .article { line-height: 1.6; }
        .reading { max-width: 680px; }
      `,
    });
    const result = spool(dir);
    expect(result.analysis.suggestedTemplate).toBe('blog');
  });

  it('skips node_modules', () => {
    const dir = makeTempDir({
      'style.css': '.main { color: #333; }',
      'node_modules/lib/dep.css': '.dep { color: #ff0000; }',
    });
    const result = spool(dir);
    expect(result.analysis.cssFiles.length).toBe(1);
  });
});

describe('spool — custom tokens output', () => {
  it('generates valid CSS with :root block', () => {
    const dir = makeTempDir({
      'style.css': `
        body { background: #0a0a0a; color: #f0f0f0; }
        .accent { color: #e91e63; }
        .accent { color: #e91e63; }
      `,
    });
    const result = spool(dir);
    expect(result.customTokensCss).toContain(':root {');
    expect(result.customTokensCss).toContain('}');
    expect(result.customTokensCss).toContain('--bg-deep-void');
  });
});

import { describe, it, expect } from 'vitest';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from '../src/core/guardrails.js';
import { findConfigFile, loadTokenConfig, resolveGuardrailOptions } from '../src/core/guardrail-config.js';
import { generateReport } from '../src/core/report.js';
import { writeFileSync, unlinkSync, mkdtempSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function withTempDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'valentino-config-'));
  try {
    fn(dir);
  } catch (e) {
    throw e;
  }
}

describe('allowedTokenPrefixes', () => {
  const css = `:root {\n  --vr-spacing-xl: 24px;\n  --vc-primary: #1a73e8;\n  --custom-gap: 16px;\n}`;

  it('without prefixes, all token definitions are skipped', () => {
    const violations = checkNoHardcodedPx(css, { allowTokenDefinitions: true });
    expect(violations).toHaveLength(0);
  });

  it('with matching prefixes, only matching tokens are skipped', () => {
    const violations = checkNoHardcodedPx(css, {
      allowTokenDefinitions: true,
      allowedTokenPrefixes: ['--vr-', '--vc-'],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('--custom-gap');
  });

  it('with non-matching prefixes, nothing is skipped', () => {
    const violations = checkNoHardcodedPx(css, {
      allowTokenDefinitions: true,
      allowedTokenPrefixes: ['--foo-'],
    });
    expect(violations).toHaveLength(2);
  });

  it('color check respects prefixes', () => {
    const violations = checkNoHardcodedColor(css, {
      allowTokenDefinitions: true,
      allowedTokenPrefixes: ['--vr-'],
    });
    expect(violations.some(v => v.includes('--vc-primary'))).toBe(true);
    expect(violations.some(v => v.includes('--vr-'))).toBe(false);
  });

  it('named color check respects prefixes', () => {
    const namedCss = `:root {\n  --vr-accent: red;\n  --other-color: blue;\n}`;
    const violations = checkNoNamedColor(namedCss, {
      allowTokenDefinitions: true,
      allowedTokenPrefixes: ['--vr-'],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('--other-color');
  });

  it('empty prefixes array skips all (same as no prefixes)', () => {
    const violations = checkNoHardcodedPx(css, {
      allowTokenDefinitions: true,
      allowedTokenPrefixes: [],
    });
    expect(violations).toHaveLength(0);
  });

  it('non-token lines are never skipped regardless of prefixes', () => {
    const mixedCss = `:root {\n  --vr-gap: 8px;\n}\n.box {\n  padding: 10px;\n}`;
    const violations = checkNoHardcodedPx(mixedCss, {
      allowTokenDefinitions: true,
      allowedTokenPrefixes: ['--vr-'],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('padding');
  });
});

describe('guardrail-config', () => {
  describe('findConfigFile', () => {
    it('finds .valentino.json in directory', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), '{}');
        const result = findConfigFile(dir);
        expect(result).toBe(join(dir, '.valentino.json'));
        unlinkSync(join(dir, '.valentino.json'));
      });
    });

    it('finds valentino.config.json in directory', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, 'valentino.config.json'), '{}');
        const result = findConfigFile(dir);
        expect(result).toBe(join(dir, 'valentino.config.json'));
        unlinkSync(join(dir, 'valentino.config.json'));
      });
    });

    it('prefers .valentino.json over valentino.config.json', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), '{"source":"dot"}');
        writeFileSync(join(dir, 'valentino.config.json'), '{"source":"named"}');
        const result = findConfigFile(dir);
        expect(result).toBe(join(dir, '.valentino.json'));
        unlinkSync(join(dir, '.valentino.json'));
        unlinkSync(join(dir, 'valentino.config.json'));
      });
    });

    it('walks up directories', () => {
      withTempDir(dir => {
        const sub = join(dir, 'sub');
        mkdirSync(sub);
        writeFileSync(join(dir, '.valentino.json'), '{}');
        const result = findConfigFile(sub);
        expect(result).toBe(join(dir, '.valentino.json'));
        unlinkSync(join(dir, '.valentino.json'));
      });
    });

    it('returns undefined if no config found', () => {
      withTempDir(dir => {
        expect(findConfigFile(dir)).toBeUndefined();
      });
    });
  });

  describe('loadTokenConfig', () => {
    it('loads allowedTokenPrefixes from config', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), JSON.stringify({
          allowedTokenPrefixes: ['--vr-', '--vc-'],
        }));
        const config = loadTokenConfig(dir);
        expect(config).toBeDefined();
        expect(config!.allowedTokenPrefixes).toEqual(['--vr-', '--vc-']);
        unlinkSync(join(dir, '.valentino.json'));
      });
    });

    it('loads tokenDefinitionSelectors from config', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), JSON.stringify({
          tokenDefinitionSelectors: [':root', '.theme-dark'],
        }));
        const config = loadTokenConfig(dir);
        expect(config!.tokenDefinitionSelectors).toEqual([':root', '.theme-dark']);
        unlinkSync(join(dir, '.valentino.json'));
      });
    });

    it('returns undefined for missing config', () => {
      withTempDir(dir => {
        expect(loadTokenConfig(dir)).toBeUndefined();
      });
    });

    it('returns undefined for invalid JSON', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), 'not json');
        expect(loadTokenConfig(dir)).toBeUndefined();
        unlinkSync(join(dir, '.valentino.json'));
      });
    });

    it('filters non-string values from arrays', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), JSON.stringify({
          allowedTokenPrefixes: ['--vr-', 123, null, '--vc-'],
        }));
        const config = loadTokenConfig(dir);
        expect(config!.allowedTokenPrefixes).toEqual(['--vr-', '--vc-']);
        unlinkSync(join(dir, '.valentino.json'));
      });
    });
  });

  describe('resolveGuardrailOptions', () => {
    it('returns undefined when allowTokenDefs is false', () => {
      withTempDir(dir => {
        expect(resolveGuardrailOptions(false, dir)).toBeUndefined();
      });
    });

    it('returns allowTokenDefinitions=true with prefixes from config', () => {
      withTempDir(dir => {
        writeFileSync(join(dir, '.valentino.json'), JSON.stringify({
          allowedTokenPrefixes: ['--vr-'],
        }));
        const result = resolveGuardrailOptions(true, dir);
        expect(result).toEqual({
          allowTokenDefinitions: true,
          allowedTokenPrefixes: ['--vr-'],
        });
        unlinkSync(join(dir, '.valentino.json'));
      });
    });

    it('returns allowTokenDefinitions=true without prefixes when no config', () => {
      withTempDir(dir => {
        const result = resolveGuardrailOptions(true, dir);
        expect(result).toEqual({
          allowTokenDefinitions: true,
          allowedTokenPrefixes: undefined,
        });
      });
    });
  });
});

describe('report with allowedTokenPrefixes', () => {
  it('passes only authorized token prefixes through report', () => {
    withTempDir(dir => {
      const css = `:root {\n  --vr-spacing: 24px;\n  --custom-gap: 16px;\n}`;
      const file = join(dir, 'test.css');
      writeFileSync(file, css);

      const report = generateReport(file, {
        allowTokenDefinitions: true,
        allowedTokenPrefixes: ['--vr-'],
      });
      const section = report.sections.find(s => s.name === 'CSS Guardrails');
      expect(section!.violations).toBe(1);
      expect(section!.details[0]).toContain('--custom-gap');

      unlinkSync(file);
    });
  });

  it('passes all tokens without prefixes', () => {
    withTempDir(dir => {
      const css = `:root {\n  --vr-spacing: 24px;\n  --custom-gap: 16px;\n}`;
      const file = join(dir, 'test.css');
      writeFileSync(file, css);

      const report = generateReport(file, { allowTokenDefinitions: true });
      const section = report.sections.find(s => s.name === 'CSS Guardrails');
      expect(section!.violations).toBe(0);

      unlinkSync(file);
    });
  });
});

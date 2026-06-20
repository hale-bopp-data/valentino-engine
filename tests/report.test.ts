import { describe, it, expect } from 'vitest';
import { generateReport } from '../src/core/report.js';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function withTempFile(ext: string, content: string, fn: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'valentino-report-'));
  const file = join(dir, `test${ext}`);
  writeFileSync(file, content, 'utf-8');
  try {
    fn(file);
  } finally {
    unlinkSync(file);
  }
}

describe('generateReport', () => {
  it('reports violations in HTML without allowTokenDefinitions', () => {
    const html = `<html><head><style>
:root {
  --vr-spacing-xl: 24px;
  --vc-primary: #1a73e8;
}
</style></head><body></body></html>`;

    withTempFile('.html', html, (path) => {
      const report = generateReport(path);
      expect(report.passed).toBe(false);
      const htmlSection = report.sections.find(s => s.name === 'HTML Audit');
      expect(htmlSection).toBeDefined();
      expect(htmlSection!.status).toBe('fail');
    });
  });

  it('HTML Audit section respects allowTokenDefinitions', () => {
    const html = `<html><head><style>
:root {
  --vr-spacing-xl: 24px;
  --vc-primary: #1a73e8;
}
</style></head><body></body></html>`;

    withTempFile('.html', html, (path) => {
      const report = generateReport(path, { allowTokenDefinitions: true });
      const htmlSection = report.sections.find(s => s.name === 'HTML Audit');
      expect(htmlSection).toBeDefined();
      expect(htmlSection!.status).toBe('pass');
      expect(htmlSection!.violations).toBe(0);
    });
  });

  it('CSS Guardrails section respects allowTokenDefinitions', () => {
    const html = `<html><head><style>
:root {
  --vr-spacing-xl: 24px;
  --vc-primary: #1a73e8;
}
</style></head><body></body></html>`;

    withTempFile('.html', html, (path) => {
      const report = generateReport(path, { allowTokenDefinitions: true });
      const cssSection = report.sections.find(s => s.name === 'CSS Guardrails');
      expect(cssSection).toBeDefined();
      expect(cssSection!.status).toBe('pass');
    });
  });

  it('both sections pass with allowTokenDefinitions on token-only HTML', () => {
    const html = `<html><head><style>
:root {
  --vr-spacing-xl: 24px;
  --vc-primary: #1a73e8;
  --vc-secondary: navy;
}
</style></head><body></body></html>`;

    withTempFile('.html', html, (path) => {
      const report = generateReport(path, { allowTokenDefinitions: true });
      const htmlSection = report.sections.find(s => s.name === 'HTML Audit');
      const cssSection = report.sections.find(s => s.name === 'CSS Guardrails');
      expect(htmlSection!.status).toBe('pass');
      expect(cssSection!.status).toBe('pass');
      expect(report.passed).toBe(true);
    });
  });

  it('still flags non-token violations with allowTokenDefinitions', () => {
    const html = `<html><head><style>
:root { --spacing: 24px; }
.box { padding: 10px; }
</style></head><body></body></html>`;

    withTempFile('.html', html, (path) => {
      const report = generateReport(path, { allowTokenDefinitions: true });
      expect(report.passed).toBe(false);
      const htmlSection = report.sections.find(s => s.name === 'HTML Audit');
      expect(htmlSection!.violations).toBeGreaterThan(0);
    });
  });

  it('works on CSS files', () => {
    const css = `:root {\n  --spacing: 24px;\n}\n.box { padding: 10px; }`;

    withTempFile('.css', css, (path) => {
      const withFlag = generateReport(path, { allowTokenDefinitions: true });
      const withoutFlag = generateReport(path);
      expect(withFlag.totalViolations).toBeLessThan(withoutFlag.totalViolations);
    });
  });

  it('passes clean HTML with no style tags', () => {
    withTempFile('.html', '<html><body><p>hello</p></body></html>', (path) => {
      const report = generateReport(path);
      expect(report.passed).toBe(true);
    });
  });
});

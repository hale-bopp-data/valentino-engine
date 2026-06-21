import { describe, it, expect } from 'vitest';
import { chooseProfile, buildAdvisory, formatAdvisory } from './audit-advisory.js';
import type { VisualAuditViolation } from './visual-audit.js';

describe('chooseProfile', () => {
  it('picks dashboard when there are multiple grid/widget signals', () => {
    expect(chooseProfile({ grids: 5, appShell: 4, sections: 0, hero: 0 })).toBe('dashboard');
  });

  it('picks spa for an app shell without sections/hero', () => {
    expect(chooseProfile({ grids: 0, appShell: 3, sections: 0, hero: 0 })).toBe('spa');
  });

  it('falls back to landing for editorial pages', () => {
    expect(chooseProfile({ grids: 0, appShell: 1, sections: 6, hero: 1 })).toBe('landing');
  });
});

describe('buildAdvisory', () => {
  const mk = (type: VisualAuditViolation['type'], severity: VisualAuditViolation['severity'], message: string): VisualAuditViolation =>
    ({ type, severity, message });

  it('groups, prioritizes and counts findings', () => {
    const advisory = buildAdvisory({
      violations: [mk('overflow', 'error', 'Page-level horizontal overflow')],
      warnings: [
        mk('contrast', 'warning', 'Low contrast 1.00:1 on H2'),
        mk('contrast', 'warning', 'Low contrast 1.00:1 on P'),
        mk('missing-element', 'warning', 'Interactive element without accessible label'),
        mk('collision', 'warning', 'Bounding box collision between element #1 and #2'),
        mk('collision', 'warning', 'Bounding box collision between element #1 and #3'),
      ],
    }, 'dashboard');

    expect(advisory.detectedProfile).toBe('dashboard');
    expect(advisory.errorCount).toBe(1);
    expect(advisory.warningCount).toBe(5);

    // first recommendation must be high priority (overflow or label), never low
    expect(advisory.recommendations[0].priority).toBe('high');
    // sorted: no low before high/medium
    const order = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < advisory.recommendations.length; i++) {
      expect(order[advisory.recommendations[i].priority]).toBeGreaterThanOrEqual(order[advisory.recommendations[i - 1].priority]);
    }

    const contrast = advisory.recommendations.find(r => r.category === 'contrast');
    expect(contrast?.count).toBe(2);
    const collision = advisory.recommendations.find(r => r.category === 'collision');
    expect(collision?.priority).toBe('low');
    expect(collision?.count).toBe(2);

    expect(advisory.summary).toContain('1 errori critici');
  });

  it('returns no recommendations for a clean result', () => {
    const advisory = buildAdvisory({ violations: [], warnings: [] });
    expect(advisory.recommendations).toHaveLength(0);
    expect(advisory.summary).toContain('0 azioni');
  });
});

describe('formatAdvisory', () => {
  it('renders the COSA FARE block with detected profile', () => {
    const advisory = buildAdvisory({
      violations: [],
      warnings: [{ type: 'contrast', severity: 'warning', message: 'Low contrast on H1', selector: 'h1' }],
    }, 'spa');
    const out = formatAdvisory(advisory);
    expect(out).toContain('COSA FARE');
    expect(out).toContain('profilo auto-rilevato: spa');
    expect(out).toContain('contrast');
  });
});

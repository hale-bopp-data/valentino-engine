import { describe, it, expect } from 'vitest';
import {
  mapNoteType,
  mapNoteSeverity,
  mapNoteOutcome,
  suggestedDirectionFor,
  violationToNote,
  auditResultToNotes,
  responsiveResultToNotes,
  seedSessionFromAudit,
  isResponsiveResult,
} from '../src/core/audit-to-notes.js';
import { exportSessionMarkdown, validateSession, validateNote } from '../src/core/review-notes.js';
import type { VisualAuditViolation, VisualAuditResult, ResponsiveAuditResult } from '../src/core/visual-audit.js';

function v(
  type: VisualAuditViolation['type'],
  severity: VisualAuditViolation['severity'],
  message: string,
  selector?: string,
): VisualAuditViolation {
  return { type, severity, message, selector };
}

function result(
  violations: VisualAuditViolation[],
  warnings: VisualAuditViolation[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any = 'responsive',
  viewport?: { width: number; height: number },
): VisualAuditResult {
  return {
    passed: violations.length === 0,
    available: true,
    violations,
    warnings,
    elementCount: 0,
    durationMs: 1,
    summary: 'x',
    profile,
    viewport,
  } as VisualAuditResult;
}

function responsive(viewports: VisualAuditResult[]): ResponsiveAuditResult {
  return { viewports, passed: true, summary: 'x', durationMs: 1 } as ResponsiveAuditResult;
}

describe('audit-to-notes — mapping', () => {
  it('maps note type by violation type', () => {
    expect(mapNoteType(v('contrast', 'warning', 'low contrast'))).toBe('contrast');
    expect(mapNoteType(v('overflow', 'error', 'overflow'))).toBe('structural');
    expect(mapNoteType(v('collision', 'warning', 'collision'))).toBe('structural');
    expect(mapNoteType(v('missing-element', 'warning', 'Interactive element without accessible label'))).toBe('interaction');
    expect(mapNoteType(v('missing-element', 'warning', 'No data table found'))).toBe('structural');
  });

  it('maps severity error->blocking, warning->minor', () => {
    expect(mapNoteSeverity(v('overflow', 'error', 'x'))).toBe('blocking');
    expect(mapNoteSeverity(v('contrast', 'warning', 'x'))).toBe('minor');
  });

  it('maps a sensible default triage outcome', () => {
    expect(mapNoteOutcome(v('overflow', 'error', 'x'))).toBe('developer-review');
    expect(mapNoteOutcome(v('missing-element', 'warning', 'x'))).toBe('content-config');
    expect(mapNoteOutcome(v('contrast', 'warning', 'x'))).toBe('local-refinement');
  });

  it('provides actionable directions', () => {
    expect(suggestedDirectionFor(v('overflow', 'error', 'x'))).toContain('max-width');
    expect(suggestedDirectionFor(v('contrast', 'warning', 'x'))).toContain('4.5');
  });
});

describe('audit-to-notes — violationToNote', () => {
  it('maps a violation into a captured note', () => {
    const note = violationToNote(v('overflow', 'error', 'Horizontal overflow', 'div.main'), { pageId: 'home' });
    expect(note.comment).toBe('Horizontal overflow');
    expect(note.type).toBe('structural');
    expect(note.severity).toBe('blocking');
    expect(note.triageOutcome).toBe('developer-review');
    expect(note.state).toBe('captured');
    expect(note.targetLabel).toBe('div.main');
    expect(note.pageId).toBe('home');
    expect(note.suggestedDirection).toContain('max-width');
    expect(note.tags).toContain('auto-audit');
    expect(validateNote(note)).toHaveLength(0);
  });
});

describe('audit-to-notes — auditResultToNotes', () => {
  it('golden: converts violations + warnings into notes (pageId defaults to profile)', () => {
    const r = result(
      [v('overflow', 'error', 'Page overflow', 'html')],
      [
        v('contrast', 'warning', 'Low contrast 2.1:1', 'p'),
        v('missing-element', 'warning', 'Interactive element without accessible label', 'button'),
      ],
      'dashboard',
    );
    const notes = auditResultToNotes(r);
    expect(notes).toHaveLength(3);
    expect(notes[0].severity).toBe('blocking');
    expect(notes[1].type).toBe('contrast');
    expect(notes[2].type).toBe('interaction');
    expect(notes.every((n) => n.pageId === 'dashboard')).toBe(true);
  });

  it('edge: empty audit yields no notes', () => {
    expect(auditResultToNotes(result([], []))).toEqual([]);
  });

  it('failure: malformed audit result throws (fail-loud)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => auditResultToNotes({ violations: [] } as any)).toThrow(/malformed/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => auditResultToNotes(null as any)).toThrow();
  });
});

describe('audit-to-notes — responsive', () => {
  it('flattens viewports and tags each note with its breakpoint', () => {
    const r = responsive([
      result([v('overflow', 'error', 'desktop overflow', 'main')], [], 'responsive', { width: 1440, height: 900 }),
      result([], [v('collision', 'warning', 'mobile collision')], 'responsive', { width: 390, height: 844 }),
    ]);
    const notes = responsiveResultToNotes(r);
    expect(notes).toHaveLength(2);
    expect(notes[0].tags).toContain('viewport:1440x900');
    expect(notes[1].tags).toContain('viewport:390x844');
  });

  it('failure: malformed responsive result throws', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => responsiveResultToNotes({} as any)).toThrow(/malformed/);
  });

  it('isResponsiveResult discriminates the two shapes', () => {
    expect(isResponsiveResult(responsive([]))).toBe(true);
    expect(isResponsiveResult(result([], []))).toBe(false);
  });
});

describe('audit-to-notes — seedSessionFromAudit', () => {
  it('seeds a valid review session from a single audit result', () => {
    const r = result([v('overflow', 'error', 'overflow', 'html')], [v('contrast', 'warning', 'low contrast', 'p')], 'spa');
    const session = seedSessionFromAudit(r, { name: 'home-audit' });
    expect(session.sessionName).toBe('home-audit');
    expect(session.status).toBe('draft');
    expect(session.notes).toHaveLength(2);
    expect(validateSession(session)).toHaveLength(0);

    const md = exportSessionMarkdown(session);
    expect(md).toContain('Review Session: home-audit');
    expect(md).toContain('direction:');
  });

  it('auto-detects a responsive result', () => {
    const r = responsive([
      result([v('overflow', 'error', 'x', 'main')], [], 'responsive', { width: 768, height: 1024 }),
    ]);
    const session = seedSessionFromAudit(r);
    expect(session.notes).toHaveLength(1);
    expect(session.notes[0].tags).toContain('viewport:768x1024');
  });

  it('failure: invalid input throws (fail-loud)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => seedSessionFromAudit(null as any)).toThrow();
  });
});

/**
 * Bridge: Visual QA Guardrail (visual-audit) -> review-notes (#3089, Feature #3080).
 *
 * Closes the loop between the AUTOMATED auditor and the HUMAN review surface
 * (the engine `review-notes` model + the portal Workbench, which share the same
 * note schema and markdown export): the audit pre-populates a review session
 * that a human then triages and exports.
 *
 * Pure + deterministic: no DOM, no I/O. Fail-loud on malformed input.
 */

import type { VisualAuditViolation, VisualAuditResult, ResponsiveAuditResult } from './visual-audit.js';
import type { NoteRecord, NoteType, NoteSeverity, NoteOutcome, ReviewMode, ReviewSession } from './review-notes.js';
import { createNote, createSession, addNote } from './review-notes.js';

/** Map an audit violation type to a review-notes NoteType. */
export function mapNoteType(v: VisualAuditViolation): NoteType {
  if (v.type === 'contrast') return 'contrast';
  if (v.type === 'missing-element' && /label|aria|accessible|interactive/i.test(v.message)) return 'interaction';
  return 'structural';
}

/** Map an audit severity (error/warning) to a review-notes NoteSeverity. */
export function mapNoteSeverity(v: VisualAuditViolation): NoteSeverity {
  return v.severity === 'error' ? 'blocking' : 'minor';
}

/** Default triage outcome for an auto-seeded note (human refines later). */
export function mapNoteOutcome(v: VisualAuditViolation): NoteOutcome {
  if (v.severity === 'error') return 'developer-review';
  if (v.type === 'missing-element') return 'content-config';
  return 'local-refinement';
}

const DIRECTION_BY_TYPE: Record<VisualAuditViolation['type'], string> = {
  overflow: 'Constrain width: max-width / overflow-x on the container, min-width:0 on flex/grid children.',
  collision: 'Resolve the overlap: review positioning, z-index and spacing of the colliding regions.',
  contrast: 'Raise text contrast to >=4.5:1 (stronger text token or adjusted foreground/background).',
  'missing-element': 'Add the missing element/landmark/label (e.g. aria-label, nav landmark, or the expected region).',
};

/** Actionable direction string for the reviewer, derived from the violation type. */
export function suggestedDirectionFor(v: VisualAuditViolation): string {
  return DIRECTION_BY_TYPE[v.type] ?? 'Review and address the reported issue.';
}

export interface AuditToNotesOptions {
  /** Page identifier for the notes (defaults to the audit profile). */
  pageId?: string;
  /** Section label for the notes. */
  section?: string;
  /** Tags applied to every generated note (default: ['auto-audit']). */
  tags?: string[];
}

/** Convert a single audit violation/warning into a captured review note. */
export function violationToNote(v: VisualAuditViolation, opts: AuditToNotesOptions = {}): NoteRecord {
  return createNote(v.message, {
    type: mapNoteType(v),
    severity: mapNoteSeverity(v),
    triageOutcome: mapNoteOutcome(v),
    state: 'captured',
    targetLabel: v.selector,
    section: opts.section,
    pageId: opts.pageId,
    suggestedDirection: suggestedDirectionFor(v),
    tags: opts.tags ?? ['auto-audit'],
  });
}

/** Convert a single-viewport audit result (violations + warnings) into notes. */
export function auditResultToNotes(result: VisualAuditResult, opts: AuditToNotesOptions = {}): NoteRecord[] {
  if (!result || !Array.isArray(result.violations) || !Array.isArray(result.warnings)) {
    throw new Error('auditResultToNotes: malformed audit result (expected { violations: [], warnings: [] })');
  }
  const pageId = opts.pageId ?? result.profile;
  const findings = [...result.violations, ...result.warnings];
  return findings.map((v) => violationToNote(v, { pageId, section: opts.section, tags: opts.tags }));
}

/** Convert a responsive (multi-viewport) audit result into notes, tagged per breakpoint. */
export function responsiveResultToNotes(result: ResponsiveAuditResult, opts: AuditToNotesOptions = {}): NoteRecord[] {
  if (!result || !Array.isArray(result.viewports)) {
    throw new Error('responsiveResultToNotes: malformed responsive result (expected { viewports: [] })');
  }
  const notes: NoteRecord[] = [];
  for (const vp of result.viewports) {
    const label = vp.viewport ? `${vp.viewport.width}x${vp.viewport.height}` : 'viewport';
    notes.push(
      ...auditResultToNotes(vp, {
        pageId: opts.pageId ?? vp.profile,
        section: opts.section ?? label,
        tags: [...(opts.tags ?? ['auto-audit']), `viewport:${label}`],
      }),
    );
  }
  return notes;
}

/** True when the result is a responsive (multi-viewport) audit result. */
export function isResponsiveResult(result: VisualAuditResult | ResponsiveAuditResult): result is ResponsiveAuditResult {
  return Array.isArray((result as ResponsiveAuditResult).viewports);
}

export interface SeedSessionOptions extends AuditToNotesOptions {
  /** Session name (default: 'audit-seed'). */
  name?: string;
  /** Review mode (default: 'full'). */
  mode?: ReviewMode;
}

/**
 * Seed a full review session from an audit result (single or responsive).
 * The returned session is ready for human triage and markdown export.
 */
export function seedSessionFromAudit(
  result: VisualAuditResult | ResponsiveAuditResult,
  opts: SeedSessionOptions = {},
): ReviewSession {
  if (!result || typeof result !== 'object') {
    throw new Error('seedSessionFromAudit: missing or invalid audit result');
  }
  const { name, mode, ...noteOpts } = opts;
  const notes = isResponsiveResult(result)
    ? responsiveResultToNotes(result, noteOpts)
    : auditResultToNotes(result, noteOpts);

  let session = createSession(name ?? 'audit-seed', mode ?? 'full');
  for (const note of notes) session = addNote(session, note);
  return session;
}

export type NoteType =
  | 'content' | 'clarity' | 'hierarchy' | 'cta'
  | 'contrast' | 'rhythm' | 'interaction' | 'structural';

export type NoteSeverity = 'minor' | 'important' | 'blocking';

export type NoteOutcome =
  | 'local-refinement' | 'content-config'
  | 'developer-review' | 'blocked-core' | 'not-now';

export type NoteState = 'captured' | 'triaged' | 'accepted' | 'blocked' | 'deferred' | 'done';

export type ReviewMode = 'visual' | 'content' | 'accessibility' | 'full';

export type SessionStatus = 'draft' | 'triage' | 'closed';

export interface NoteRecord {
  id: string;
  comment: string;
  type: NoteType;
  severity: NoteSeverity;
  triageOutcome: NoteOutcome;
  state: NoteState;
  pageId?: string;
  targetLabel?: string;
  section?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSession {
  sessionName: string;
  mode: ReviewMode;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  notes: NoteRecord[];
}

const NOTE_TYPES: NoteType[] = ['content', 'clarity', 'hierarchy', 'cta', 'contrast', 'rhythm', 'interaction', 'structural'];
const SEVERITIES: NoteSeverity[] = ['minor', 'important', 'blocking'];
const OUTCOMES: NoteOutcome[] = ['local-refinement', 'content-config', 'developer-review', 'blocked-core', 'not-now'];
const STATES: NoteState[] = ['captured', 'triaged', 'accepted', 'blocked', 'deferred', 'done'];

let counter = 0;
function generateId(): string {
  return `note-${Date.now()}-${++counter}`;
}

export function createNote(
  comment: string,
  opts: Partial<Omit<NoteRecord, 'id' | 'comment' | 'createdAt' | 'updatedAt'>> = {},
): NoteRecord {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    comment,
    type: opts.type ?? 'content',
    severity: opts.severity ?? 'minor',
    triageOutcome: opts.triageOutcome ?? 'local-refinement',
    state: opts.state ?? 'captured',
    pageId: opts.pageId,
    targetLabel: opts.targetLabel,
    section: opts.section,
    tags: opts.tags,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateNote(note: NoteRecord, patch: Partial<Pick<NoteRecord, 'comment' | 'type' | 'severity' | 'triageOutcome' | 'state' | 'tags'>>): NoteRecord {
  return {
    ...note,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function createSession(name: string, mode: ReviewMode = 'full'): ReviewSession {
  const now = new Date().toISOString();
  return {
    sessionName: name,
    mode,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    notes: [],
  };
}

export function addNote(session: ReviewSession, note: NoteRecord): ReviewSession {
  return {
    ...session,
    notes: [...session.notes, note],
    updatedAt: new Date().toISOString(),
  };
}

export function updateSessionStatus(session: ReviewSession, status: SessionStatus): ReviewSession {
  return {
    ...session,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateNote(note: Partial<NoteRecord>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!note.comment?.trim()) errors.push({ field: 'comment', message: 'Comment is required' });
  if (note.type && !NOTE_TYPES.includes(note.type)) errors.push({ field: 'type', message: `Invalid type: ${note.type}` });
  if (note.severity && !SEVERITIES.includes(note.severity)) errors.push({ field: 'severity', message: `Invalid severity: ${note.severity}` });
  if (note.triageOutcome && !OUTCOMES.includes(note.triageOutcome)) errors.push({ field: 'triageOutcome', message: `Invalid outcome: ${note.triageOutcome}` });
  if (note.state && !STATES.includes(note.state)) errors.push({ field: 'state', message: `Invalid state: ${note.state}` });
  return errors;
}

export function validateSession(session: Partial<ReviewSession>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!session.sessionName?.trim()) errors.push({ field: 'sessionName', message: 'Session name is required' });
  return errors;
}

function severityIcon(severity: NoteSeverity): string {
  if (severity === 'blocking') return 'BLOCKING';
  if (severity === 'important') return 'IMPORTANT';
  return 'minor';
}

export function exportSessionMarkdown(session: ReviewSession): string {
  const lines: string[] = [];
  lines.push(`# Review Session: ${session.sessionName}`);
  lines.push('');
  lines.push(`- **Mode:** ${session.mode}`);
  lines.push(`- **Status:** ${session.status}`);
  lines.push(`- **Created:** ${session.createdAt}`);
  lines.push(`- **Updated:** ${session.updatedAt}`);
  lines.push(`- **Notes:** ${session.notes.length}`);
  lines.push('');

  const blocking = session.notes.filter(n => n.severity === 'blocking');
  const important = session.notes.filter(n => n.severity === 'important');
  const minor = session.notes.filter(n => n.severity === 'minor');

  if (blocking.length > 0) {
    lines.push('## BLOCKING');
    lines.push('');
    for (const n of blocking) lines.push(formatNoteLine(n));
    lines.push('');
  }

  if (important.length > 0) {
    lines.push('## IMPORTANT');
    lines.push('');
    for (const n of important) lines.push(formatNoteLine(n));
    lines.push('');
  }

  if (minor.length > 0) {
    lines.push('## Minor');
    lines.push('');
    for (const n of minor) lines.push(formatNoteLine(n));
    lines.push('');
  }

  if (session.notes.length === 0) {
    lines.push('No notes in this session.');
    lines.push('');
  }

  lines.push('---');
  lines.push(`Exported by valentino-engine review-notes`);
  return lines.join('\n');
}

function formatNoteLine(note: NoteRecord): string {
  const parts: string[] = [];
  parts.push(`- **[${note.type}]** ${note.comment}`);
  const meta: string[] = [];
  if (note.section) meta.push(`section: ${note.section}`);
  if (note.targetLabel) meta.push(`target: ${note.targetLabel}`);
  if (note.pageId) meta.push(`page: ${note.pageId}`);
  meta.push(`state: ${note.state}`);
  meta.push(`outcome: ${note.triageOutcome}`);
  if (note.tags?.length) meta.push(`tags: ${note.tags.join(', ')}`);
  parts.push(`  _${meta.join(' | ')}_`);
  return parts.join('\n');
}

export function parseSessionJson(json: string): ReviewSession {
  return JSON.parse(json) as ReviewSession;
}

export function sessionStats(session: ReviewSession): {
  total: number;
  blocking: number;
  important: number;
  minor: number;
  byState: Record<NoteState, number>;
  byType: Record<NoteType, number>;
} {
  const byState = {} as Record<NoteState, number>;
  const byType = {} as Record<NoteType, number>;
  for (const s of STATES) byState[s] = 0;
  for (const t of NOTE_TYPES) byType[t] = 0;

  for (const n of session.notes) {
    byState[n.state]++;
    byType[n.type]++;
  }

  return {
    total: session.notes.length,
    blocking: session.notes.filter(n => n.severity === 'blocking').length,
    important: session.notes.filter(n => n.severity === 'important').length,
    minor: session.notes.filter(n => n.severity === 'minor').length,
    byState,
    byType,
  };
}

export { NOTE_TYPES, SEVERITIES, OUTCOMES, STATES };

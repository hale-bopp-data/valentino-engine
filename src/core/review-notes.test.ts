import { describe, it, expect } from 'vitest';
import {
  createNote, updateNote, createSession, addNote,
  updateSessionStatus, validateNote, validateSession,
  exportSessionMarkdown, sessionStats, parseSessionJson,
  NOTE_TYPES, SEVERITIES, OUTCOMES, STATES,
} from './review-notes.js';

describe('createNote', () => {
  it('creates note with defaults', () => {
    const note = createNote('Fix contrast on hero');
    expect(note.comment).toBe('Fix contrast on hero');
    expect(note.type).toBe('content');
    expect(note.severity).toBe('minor');
    expect(note.state).toBe('captured');
    expect(note.id).toBeTruthy();
    expect(note.createdAt).toBeTruthy();
  });

  it('creates note with custom fields', () => {
    const note = createNote('Blocking issue', {
      type: 'contrast',
      severity: 'blocking',
      section: 'hero',
      tags: ['wcag', 'a11y'],
    });
    expect(note.type).toBe('contrast');
    expect(note.severity).toBe('blocking');
    expect(note.section).toBe('hero');
    expect(note.tags).toEqual(['wcag', 'a11y']);
  });
});

describe('updateNote', () => {
  it('updates fields and timestamp', () => {
    const note = createNote('test');
    const updated = updateNote(note, { severity: 'blocking', state: 'triaged' });
    expect(updated.severity).toBe('blocking');
    expect(updated.state).toBe('triaged');
    expect(updated.comment).toBe('test');
    expect(updated.updatedAt).toBeTruthy();
    expect(updated.id).toBe(note.id);
  });
});

describe('createSession', () => {
  it('creates session with defaults', () => {
    const session = createSession('S436 review');
    expect(session.sessionName).toBe('S436 review');
    expect(session.mode).toBe('full');
    expect(session.status).toBe('draft');
    expect(session.notes).toHaveLength(0);
  });

  it('creates session with custom mode', () => {
    const session = createSession('a11y check', 'accessibility');
    expect(session.mode).toBe('accessibility');
  });
});

describe('addNote', () => {
  it('adds note to session', () => {
    const session = createSession('test');
    const note = createNote('a note');
    const updated = addNote(session, note);
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].comment).toBe('a note');
  });

  it('does not mutate original session', () => {
    const session = createSession('test');
    addNote(session, createNote('note'));
    expect(session.notes).toHaveLength(0);
  });
});

describe('updateSessionStatus', () => {
  it('updates status', () => {
    const session = createSession('test');
    const updated = updateSessionStatus(session, 'triage');
    expect(updated.status).toBe('triage');
  });
});

describe('validateNote', () => {
  it('accepts valid note', () => {
    const errors = validateNote({ comment: 'ok', type: 'content', severity: 'minor' });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty comment', () => {
    const errors = validateNote({ comment: '' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('comment');
  });

  it('rejects invalid type', () => {
    const errors = validateNote({ comment: 'ok', type: 'invalid' as any });
    expect(errors.some(e => e.field === 'type')).toBe(true);
  });

  it('rejects invalid severity', () => {
    const errors = validateNote({ comment: 'ok', severity: 'bad' as any });
    expect(errors.some(e => e.field === 'severity')).toBe(true);
  });
});

describe('validateSession', () => {
  it('accepts valid session', () => {
    expect(validateSession({ sessionName: 'S436' })).toHaveLength(0);
  });

  it('rejects empty name', () => {
    const errors = validateSession({ sessionName: '' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('exportSessionMarkdown', () => {
  it('exports empty session', () => {
    const session = createSession('empty');
    const md = exportSessionMarkdown(session);
    expect(md).toContain('# Review Session: empty');
    expect(md).toContain('No notes');
  });

  it('groups notes by severity', () => {
    let session = createSession('test');
    session = addNote(session, createNote('block it', { severity: 'blocking', type: 'contrast' }));
    session = addNote(session, createNote('fix later', { severity: 'minor', type: 'content' }));
    session = addNote(session, createNote('check this', { severity: 'important', type: 'hierarchy' }));
    const md = exportSessionMarkdown(session);
    expect(md).toContain('## BLOCKING');
    expect(md).toContain('## IMPORTANT');
    expect(md).toContain('## Minor');
    expect(md.indexOf('BLOCKING')).toBeLessThan(md.indexOf('IMPORTANT'));
  });

  it('includes note metadata', () => {
    let session = createSession('test');
    session = addNote(session, createNote('check hero', {
      section: 'hero',
      targetLabel: 'h1.title',
      pageId: 'home',
      tags: ['ux'],
    }));
    const md = exportSessionMarkdown(session);
    expect(md).toContain('section: hero');
    expect(md).toContain('target: h1.title');
    expect(md).toContain('page: home');
    expect(md).toContain('tags: ux');
  });
});

describe('sessionStats', () => {
  it('returns zeros for empty session', () => {
    const stats = sessionStats(createSession('empty'));
    expect(stats.total).toBe(0);
    expect(stats.blocking).toBe(0);
  });

  it('counts by severity', () => {
    let session = createSession('test');
    session = addNote(session, createNote('a', { severity: 'blocking' }));
    session = addNote(session, createNote('b', { severity: 'blocking' }));
    session = addNote(session, createNote('c', { severity: 'minor' }));
    const stats = sessionStats(session);
    expect(stats.total).toBe(3);
    expect(stats.blocking).toBe(2);
    expect(stats.minor).toBe(1);
  });

  it('counts by type and state', () => {
    let session = createSession('test');
    session = addNote(session, createNote('a', { type: 'contrast', state: 'triaged' }));
    session = addNote(session, createNote('b', { type: 'contrast', state: 'done' }));
    const stats = sessionStats(session);
    expect(stats.byType.contrast).toBe(2);
    expect(stats.byState.triaged).toBe(1);
    expect(stats.byState.done).toBe(1);
  });
});

describe('parseSessionJson', () => {
  it('round-trips session', () => {
    let session = createSession('rt');
    session = addNote(session, createNote('test note', { severity: 'important' }));
    const json = JSON.stringify(session);
    const parsed = parseSessionJson(json);
    expect(parsed.sessionName).toBe('rt');
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0].severity).toBe('important');
  });
});

describe('constants', () => {
  it('exports all enums', () => {
    expect(NOTE_TYPES).toHaveLength(8);
    expect(SEVERITIES).toHaveLength(3);
    expect(OUTCOMES).toHaveLength(5);
    expect(STATES).toHaveLength(6);
  });
});

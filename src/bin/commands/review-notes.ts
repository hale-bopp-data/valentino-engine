import { readFileSync, writeFileSync } from 'fs';
import {
  createSession, createNote, addNote, updateSessionStatus,
  exportSessionMarkdown, parseSessionJson, sessionStats,
} from '../../core/review-notes.js';
import type { ReviewMode, NoteRecord } from '../../core/review-notes.js';
import { seedSessionFromAudit } from '../../core/audit-to-notes.js';

export function runReviewNotes(args: string[]): void {
    const subcommand = args[0];

    if (subcommand === 'new') {
        const name = args[1];
        const modeIdx = args.indexOf('--mode');
        const mode = (modeIdx >= 0 ? args[modeIdx + 1] : 'full') as ReviewMode;
        const outIdx = args.indexOf('--out');
        const out = outIdx >= 0 ? args[outIdx + 1] : undefined;

        if (!name) {
            console.error('Usage: valentino review-notes new <name> [--mode visual|content|accessibility|full] [--out file.json]');
            process.exit(1);
        }

        const session = createSession(name, mode);
        const json = JSON.stringify(session, null, 2);

        if (out) {
            writeFileSync(out, json, 'utf-8');
            console.log(`Session created: ${out}`);
        } else {
            console.log(json);
        }
        return;
    }

    if (subcommand === 'add') {
        const file = args[1];
        const comment = args.find((a, i) => i > 1 && !a.startsWith('-') && args[i - 1] !== '--type' && args[i - 1] !== '--severity' && args[i - 1] !== '--section');
        if (!file || !comment) {
            console.error('Usage: valentino review-notes add <session.json> "comment" [--type content] [--severity minor] [--section hero]');
            process.exit(1);
        }

        const typeIdx = args.indexOf('--type');
        const sevIdx = args.indexOf('--severity');
        const secIdx = args.indexOf('--section');

        const note = createNote(comment, {
            type: typeIdx >= 0 ? args[typeIdx + 1] as any : undefined,
            severity: sevIdx >= 0 ? args[sevIdx + 1] as any : undefined,
            section: secIdx >= 0 ? args[secIdx + 1] : undefined,
        });

        const session = parseSessionJson(readFileSync(file, 'utf-8'));
        const updated = addNote(session, note);
        writeFileSync(file, JSON.stringify(updated, null, 2), 'utf-8');
        console.log(`Note added: "${comment}" (${note.severity}/${note.type})`);
        return;
    }

    if (subcommand === 'export') {
        const file = args[1];
        if (!file) {
            console.error('Usage: valentino review-notes export <session.json> [--out file.md]');
            process.exit(1);
        }

        const session = parseSessionJson(readFileSync(file, 'utf-8'));
        const md = exportSessionMarkdown(session);
        const outIdx = args.indexOf('--out');

        if (outIdx >= 0 && args[outIdx + 1]) {
            writeFileSync(args[outIdx + 1], md, 'utf-8');
            console.log(`Exported to ${args[outIdx + 1]}`);
        } else {
            console.log(md);
        }
        return;
    }

    if (subcommand === 'stats') {
        const file = args[1];
        if (!file) {
            console.error('Usage: valentino review-notes stats <session.json>');
            process.exit(1);
        }

        const session = parseSessionJson(readFileSync(file, 'utf-8'));
        const stats = sessionStats(session);
        console.log(`Session: ${session.sessionName} (${session.status})`);
        console.log(`  Total: ${stats.total} | Blocking: ${stats.blocking} | Important: ${stats.important} | Minor: ${stats.minor}`);
        return;
    }

    if (subcommand === 'from-audit') {
        const file = args[1];
        if (!file) {
            console.error('Usage: valentino review-notes from-audit <audit.json> [--out session.json] [--name <name>] [--mode visual|content|accessibility|full]');
            process.exit(1);
        }

        const outIdx = args.indexOf('--out');
        const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
        const nameIdx = args.indexOf('--name');
        const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
        const modeIdx = args.indexOf('--mode');
        const mode = modeIdx >= 0 ? (args[modeIdx + 1] as ReviewMode) : undefined;

        let audit: unknown;
        try {
            audit = JSON.parse(readFileSync(file, 'utf-8'));
        } catch (err) {
            console.error(`Failed to read/parse audit JSON "${file}": ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }

        let session;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            session = seedSessionFromAudit(audit as any, { name, mode });
        } catch (err) {
            console.error(`Cannot seed session from audit: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }

        const json = JSON.stringify(session, null, 2);
        if (out) {
            writeFileSync(out, json, 'utf-8');
            console.log(`Seeded session with ${session.notes.length} note(s) from audit: ${out}`);
        } else {
            console.log(json);
        }
        return;
    }

    console.error(`Usage: valentino review-notes <new|add|export|stats|from-audit> [args]`);
    process.exit(1);
}

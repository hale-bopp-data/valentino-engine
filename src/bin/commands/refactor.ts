import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { previewRefactor, formatProposal } from '../../core/refactor.js';
import { createBackup, writeFixed } from '../../core/backup.js';

interface RefactorArgs {
    file: string | undefined;
    dryRun: boolean;
    apply: boolean;
    noBackup: boolean;
    force: boolean;
}

function parseArgs(args: string[]): RefactorArgs {
    let file: string | undefined;
    let dryRun = false;
    let apply = false;
    let noBackup = false;
    let force = false;

    for (const arg of args) {
        if (arg === '--dry-run') dryRun = true;
        else if (arg === '--apply') apply = true;
        else if (arg === '--no-backup') noBackup = true;
        else if (arg === '--force') force = true;
        else if (!arg.startsWith('-')) file = file ?? arg;
    }

    return { file, dryRun, apply, noBackup, force };
}

function promptUser(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

export async function runRefactor(args: string[]): Promise<void> {
    const opts = parseArgs(args);
    if (!opts.file) {
        console.error('Usage: valentino refactor <file> [--dry-run] [--apply] [--no-backup] [--force]');
        process.exit(1);
    }

    const content = readFileSync(opts.file, 'utf-8');
    const proposal = previewRefactor(content, opts.file);

    console.log(formatProposal(proposal, opts.file));

    if (proposal.hunks.length === 0) return;

    if (!proposal.safe && !opts.force) {
        console.log('\nRefactor BLOCKED: self-referential tokens would be created.');
        console.log('Use --force to override (not recommended).');
        process.exit(1);
    }

    if (opts.dryRun) {
        console.log('\n(dry-run) No changes applied.');
        return;
    }

    let shouldApply = opts.apply;

    if (!shouldApply && process.stdin.isTTY) {
        const answer = await promptUser('\nApply changes? [y/N] ');
        shouldApply = answer === 'y' || answer === 'yes';
    }

    if (!shouldApply) {
        console.log('No changes applied.');
        return;
    }

    if (!opts.noBackup) {
        const { backupPath } = createBackup(opts.file);
        console.log(`\n📦 Backup: ${backupPath}`);
    }

    writeFixed(opts.file, proposal.proposed);
    console.log(`✅ ${proposal.fixCount} line(s) refactored in ${opts.file}`);
}

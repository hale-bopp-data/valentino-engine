import { readFileSync } from 'fs';
import { runVisualAudit, runResponsiveAudit, formatVisualAudit, formatResponsiveAudit, EXIT_CODES } from '../../core/visual-audit.js';
import { isValidProfile } from '../../core/spa-profile.js';
import type { AuditProfile } from '../../core/spa-profile.js';

function isUrl(input: string): boolean {
    return /^https?:\/\//i.test(input);
}

export async function runVisualAuditCmd(args: string[]): Promise<void> {
    const source = args.find(a => !a.startsWith('-'));
    const responsive = args.includes('--responsive');
    const json = args.includes('--json');
    const debug = args.includes('--debug');
    const profileArg = args.find(a => a.startsWith('--profile'))?.split('=')[1]
        || (args.includes('--profile') ? args[args.indexOf('--profile') + 1] : undefined);
    const profile: AuditProfile | 'auto' =
        profileArg === 'auto' ? 'auto'
        : profileArg && isValidProfile(profileArg) ? profileArg : 'auto';

    const getFlagValue = (name: string): string | undefined => {
        const eq = args.find(a => a.startsWith(`${name}=`));
        if (eq) return eq.slice(name.length + 1);
        const i = args.indexOf(name);
        if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('-')) return args[i + 1];
        return undefined;
    };
    const waitForSelector = getFlagValue('--wait-for');
    const timeoutRaw = getFlagValue('--timeout');
    const settleRaw = getFlagValue('--settle');
    const navTimeoutMs = timeoutRaw && /^\d+$/.test(timeoutRaw) ? parseInt(timeoutRaw, 10) : undefined;
    const settleMs = settleRaw && /^\d+$/.test(settleRaw) ? parseInt(settleRaw, 10) : undefined;
    const auditOpts = { profile, debug, waitForSelector, navTimeoutMs, settleMs };

    if (!source) {
        console.error('Usage: valentino visual-audit <file.html|URL> [--responsive] [--json] [--debug] [--profile auto|landing|spa|dashboard] [--wait-for <selector>] [--timeout <ms>] [--settle <ms>]');
        process.exit(EXIT_CODES.TOOL_ERROR);
    }

    try {
        const htmlOrUrl = isUrl(source) ? source : readFileSync(source, 'utf-8');

        if (responsive) {
            const result = await runResponsiveAudit(htmlOrUrl, auditOpts);
            if (json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(formatResponsiveAudit(result, source));
            }
            if (!result.viewports[0]?.available) process.exit(EXIT_CODES.NO_BROWSER);
            if (!result.passed) process.exit(EXIT_CODES.VIOLATIONS);
        } else {
            const result = await runVisualAudit(htmlOrUrl, auditOpts);
            if (json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(formatVisualAudit(result, source));
            }
            if (!result.available) process.exit(EXIT_CODES.NO_BROWSER);
            if (!result.passed) process.exit(EXIT_CODES.VIOLATIONS);
        }
    } catch (err) {
        console.error(`Visual audit error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(EXIT_CODES.TOOL_ERROR);
    }
}

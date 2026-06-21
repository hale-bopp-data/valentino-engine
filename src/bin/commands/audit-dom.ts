import { runAuditDom, runMultiViewportAuditDom, formatAuditDom, auditDomToJson, EXIT_CODES } from '../../core/audit-dom.js';

export async function runAuditDomCmd(args: string[]): Promise<void> {
    const url = args.find(a => !a.startsWith('-'));
    const json = args.includes('--json');
    const responsive = args.includes('--responsive');

    const getFlagValue = (name: string): string | undefined => {
        const eq = args.find(a => a.startsWith(`${name}=`));
        if (eq) return eq.slice(name.length + 1);
        const i = args.indexOf(name);
        if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('-')) return args[i + 1];
        return undefined;
    };
    const screenshotDir = getFlagValue('--screenshot-dir');
    const screenshot = !args.includes('--no-screenshot');
    const domOpts = { screenshot, screenshotDir };

    if (!url) {
        console.error('Usage: valentino audit-dom <url> [--json] [--responsive] [--screenshot-dir <dir>] [--no-screenshot]');
        process.exit(EXIT_CODES.TOOL_ERROR);
    }

    if (!/^https?:\/\//i.test(url)) {
        console.error('audit-dom requires a URL (http:// or https://)');
        process.exit(EXIT_CODES.TOOL_ERROR);
    }

    try {
        if (responsive) {
            const result = await runMultiViewportAuditDom(url, domOpts);
            if (json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                for (const vp of result.viewports) {
                    console.log(formatAuditDom(vp, `${url} [${vp.viewport?.width}x${vp.viewport?.height}]`));
                }
                console.log(result.summary);
            }
            if (!result.viewports[0]?.available) process.exit(EXIT_CODES.NO_BROWSER);
            if (!result.passed) process.exit(EXIT_CODES.VIOLATIONS);
        } else {
            const result = await runAuditDom(url, domOpts);
            if (json) {
                console.log(JSON.stringify(auditDomToJson(result), null, 2));
            } else {
                console.log(formatAuditDom(result, url));
            }
            if (!result.available) process.exit(EXIT_CODES.NO_BROWSER);
            if (!result.passed) process.exit(EXIT_CODES.VIOLATIONS);
        }
    } catch (err) {
        console.error(`audit-dom error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(EXIT_CODES.TOOL_ERROR);
    }
}

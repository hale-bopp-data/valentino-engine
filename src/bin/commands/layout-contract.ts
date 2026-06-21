import { readFileSync, writeFileSync } from 'fs';
import {
    initLayoutContract,
    verifyLayoutContract,
    formatLayoutContract,
    formatLayoutVerify,
    layoutContractToJson,
} from '../../core/layout-contract.js';
import type { LayoutContract } from '../../core/layout-contract.js';

function isUrl(input: string): boolean {
    return /^https?:\/\//i.test(input);
}

export async function runLayoutContract(args: string[]): Promise<void> {
    const subcommand = args[0];
    if (subcommand !== 'init' && subcommand !== 'verify') {
        console.error('Usage: valentino layout-contract <init|verify> <file.html|URL> [--out <file.json>] [--contract <file.json>] [--viewport WxH] [--json]');
        process.exit(2);
    }

    const flagValues = new Set(['--out', '--contract', '--viewport']);
    const source = args.find((a, i) => i > 0 && !a.startsWith('-') && !flagValues.has(args[i - 1]));
    if (!source) {
        console.error('Error: HTML file or URL required.');
        process.exit(2);
    }

    const getFlag = (name: string): string | undefined => {
        const i = args.indexOf(name);
        return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
    };
    const json = args.includes('--json');

    let viewportWidth: number | undefined;
    let viewportHeight: number | undefined;
    const vp = getFlag('--viewport');
    if (vp && /^\d+x\d+$/.test(vp)) {
        const [w, h] = vp.split('x').map(n => parseInt(n, 10));
        viewportWidth = w;
        viewportHeight = h;
    }

    const htmlOrUrl = isUrl(source) ? source : readFileSync(source, 'utf-8');
    const opts = { viewportWidth, viewportHeight };

    if (subcommand === 'init') {
        const contract = await initLayoutContract(htmlOrUrl, opts);
        if (!contract) {
            console.error('Failed to generate layout contract. Playwright may not be installed.');
            process.exit(3);
        }

        const out = getFlag('--out');
        if (out) {
            writeFileSync(out, JSON.stringify(contract, null, 2), 'utf-8');
            console.log(`Layout contract written to ${out}`);
        }

        console.log(json ? JSON.stringify(contract, null, 2) : formatLayoutContract(contract));
        return;
    }

    // verify
    const contractFile = getFlag('--contract');
    if (!contractFile) {
        console.error('Error: --contract <file.json> required for verify.');
        process.exit(2);
    }

    const contract: LayoutContract = JSON.parse(readFileSync(contractFile, 'utf-8'));
    const result = await verifyLayoutContract(htmlOrUrl, contract, opts);

    console.log(json ? JSON.stringify(layoutContractToJson(result, source), null, 2) : formatLayoutVerify(result));

    if (!result.available) process.exit(3);
    if (!result.passed) process.exit(1);
}

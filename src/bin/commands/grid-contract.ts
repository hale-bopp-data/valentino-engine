import { readFileSync, writeFileSync } from 'fs';
import { initGridContract, verifyGridContract, formatGridContract, formatGridVerify } from '../../core/grid-contract.js';
import type { GridContract } from '../../core/grid-contract.js';

export async function runGridContract(args: string[]): Promise<void> {
    const subcommand = args[0];
    if (subcommand !== 'init' && subcommand !== 'verify') {
        console.error('Usage: valentino grid-contract <init|verify> <file.html> [--selector <css>] [--contract <file.json>] [--out <file.json>]');
        process.exit(1);
    }

    const file = args.find((a, i) => i > 0 && !a.startsWith('-') && args[i - 1] !== '--selector' && args[i - 1] !== '--contract' && args[i - 1] !== '--out');
    if (!file) {
        console.error('Error: HTML file required.');
        process.exit(1);
    }

    const selectorIdx = args.indexOf('--selector');
    const selector = selectorIdx >= 0 ? args[selectorIdx + 1] : 'main';

    const html = readFileSync(file, 'utf-8');

    if (subcommand === 'init') {
        const contract = await initGridContract(html, selector);
        if (!contract) {
            console.error('Failed to generate grid contract. Playwright may not be installed.');
            process.exit(1);
        }

        const outIdx = args.indexOf('--out');
        if (outIdx >= 0 && args[outIdx + 1]) {
            writeFileSync(args[outIdx + 1], JSON.stringify(contract, null, 2), 'utf-8');
            console.log(`Grid contract written to ${args[outIdx + 1]}`);
        }

        console.log(formatGridContract(contract));
        return;
    }

    const contractIdx = args.indexOf('--contract');
    if (contractIdx < 0 || !args[contractIdx + 1]) {
        console.error('Error: --contract <file.json> required for verify.');
        process.exit(1);
    }

    const contract: GridContract = JSON.parse(readFileSync(args[contractIdx + 1], 'utf-8'));
    const result = await verifyGridContract(html, contract);
    console.log(formatGridVerify(result));

    if (!result.passed) process.exit(1);
}

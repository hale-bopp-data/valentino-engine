import { readFileSync } from 'fs';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from '../../core/guardrails.js';

export function runAudit(args: string[]): void {
    const file = args[0];
    if (!file) {
        console.error('Usage: valentino audit <path-to-css-file>');
        process.exit(1);
    }
    const css = readFileSync(file, 'utf-8');
    const all = [
        ...checkNoHardcodedPx(css),
        ...checkNoHardcodedColor(css),
        ...checkNoNamedColor(css),
    ];
    if (all.length === 0) {
        console.log('✅ No guardrail violations found.');
    } else {
        console.log(`❌ ${all.length} violation(s) found:\n`);
        all.forEach(v => console.log('  •', v));
        process.exit(1);
    }
}

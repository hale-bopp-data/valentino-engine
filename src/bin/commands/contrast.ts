import { checkWcagContrast } from '../../core/contrast.js';
import type { ContrastLevel } from '../../core/contrast.js';

export function runContrast(args: string[]): void {
    const fg = args[0];
    const bg = args[1];
    const level = (args[2] as ContrastLevel) || 'AA';

    if (!fg || !bg) {
        console.error('Usage: valentino contrast <foreground> <background> [AA|AAA]');
        process.exit(1);
    }

    const result = checkWcagContrast(fg, bg, level);

    if (result.ratio === 0) {
        console.error('❌ Could not parse colors. Use #hex or rgb(r,g,b) format.');
        process.exit(1);
    }

    const status = result.passes ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} — ${result.ratio}:1 (${level} requires ${level === 'AAA' ? '7.0' : '4.5'}:1)`);
    console.log(`  Foreground: ${fg}`);
    console.log(`  Background: ${bg}`);

    if (!result.passes) process.exit(1);
}

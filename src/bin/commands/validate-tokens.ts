import { readFileSync } from 'fs';
import { validateTokens } from '../../core/validate-tokens.js';

export function runValidateTokens(args: string[]): void {
    const file = args[0];
    if (!file) {
        console.error('Usage: valentino validate-tokens <path-to-css-file>');
        process.exit(1);
    }
    const css = readFileSync(file, 'utf-8');
    const result = validateTokens(css);
    console.log(`Scanned: ${result.tokenCount} CSS custom properties\n`);
    if (result.valid) {
        console.log('✅ All tokens resolve correctly. No cycles or unresolved references.');
    } else {
        console.log(`❌ ${result.violations.length} violation(s) found:\n`);
        result.violations.forEach(v => {
            const icon = v.type === 'self-reference' ? '🔄' : v.type === 'cycle' ? '♻️' : '❓';
            console.log(`  ${icon} [${v.type}] ${v.detail}`);
        });
        process.exit(1);
    }
}

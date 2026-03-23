import { readFileSync } from 'fs';
import { validatePageSpec } from '../../core/page-spec.js';

export function runValidate(args: string[]): void {
    const file = args[0];
    if (!file) {
        console.error('Usage: valentino validate <path-to-pagespec.json>');
        process.exit(1);
    }
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    const valid = validatePageSpec(json);
    if (valid) {
        console.log('✅ PageSpec is valid (V1).');
    } else {
        console.error('❌ PageSpec is invalid — requires version: "1", id (string), sections (array).');
        process.exit(1);
    }
}

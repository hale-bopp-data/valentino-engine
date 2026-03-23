import { readFileSync } from 'fs';
import { validatePageSpec } from '../../core/page-spec.js';
import { resolvePageSpecWithCatalog } from '../../core/catalog.js';
import type { PageSpecV1, ValentinoCatalogV1 } from '../../core/types.js';

export function runCatalogResolve(args: string[]): void {
    const specFile = args[0];
    const catalogIdx = args.indexOf('--catalog');
    const catalogFile = catalogIdx >= 0 ? args[catalogIdx + 1] : undefined;

    if (!specFile || !catalogFile) {
        console.error('Usage: valentino catalog resolve <spec.json> --catalog <catalog.json>');
        process.exit(1);
    }

    const specJson = JSON.parse(readFileSync(specFile, 'utf-8'));
    if (!validatePageSpec(specJson)) {
        console.error('❌ spec file is not a valid PageSpecV1.');
        process.exit(1);
    }

    const catalog: ValentinoCatalogV1 = JSON.parse(readFileSync(catalogFile, 'utf-8'));
    const resolved = resolvePageSpecWithCatalog(specJson as PageSpecV1, catalog);

    console.log(JSON.stringify(resolved, null, 2));
}

import { readFileSync } from 'fs';
import { resolvePageIdByRoute } from '../../core/manifest.js';
import type { PagesManifestV1 } from '../../core/types.js';

export function runManifestResolve(args: string[]): void {
    const manifestFile = args[0];
    const routeIdx = args.indexOf('--route');
    const route = routeIdx >= 0 ? args[routeIdx + 1] : undefined;

    if (!manifestFile || !route) {
        console.error('Usage: valentino manifest resolve <manifest.json> --route /path');
        process.exit(1);
    }

    const manifest: PagesManifestV1 = JSON.parse(readFileSync(manifestFile, 'utf-8'));
    const pageId = resolvePageIdByRoute(manifest, route);

    if (pageId) {
        console.log(`✅ Route "${route}" → pageId: "${pageId}"`);
    } else {
        console.error(`❌ No page found for route "${route}"`);
        process.exit(1);
    }
}

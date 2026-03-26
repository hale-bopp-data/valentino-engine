/**
 * CLI command: valentino llms <manifest.json> [options]
 * Generates llms.txt and llms-full.txt from a pages manifest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { generateLlmsTxt, generateLlmsFullTxt } from '../../core/llms-generator.js';
import type { PagesManifestV1, PageSpecV1 } from '../../core/types.js';

function loadJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function flattenKeys(obj: Record<string, any>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenKeys(value, fullKey));
        } else if (typeof value === 'string') {
            result[fullKey] = value;
        }
    }
    return result;
}

export function runLlms(args: string[]): void {
    const manifestPath = args.find((a) => !a.startsWith('--'));
    if (!manifestPath) {
        console.error('Usage: valentino llms <manifest.json> [--content content.json] [--site "Name"] [--tagline "..."] [--base-url https://...] [--out-dir ./public] [--specs-dir ./pages]');
        process.exit(1);
    }

    // Parse options
    const getOpt = (flag: string): string | undefined => {
        const idx = args.indexOf(flag);
        return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
    };

    const contentPath = getOpt('--content');
    const siteName = getOpt('--site') || 'Site';
    const tagline = getOpt('--tagline');
    const baseUrl = getOpt('--base-url');
    const outDir = getOpt('--out-dir') || '.';
    const specsDir = getOpt('--specs-dir');
    const capsRaw = getOpt('--capabilities');

    // Load manifest
    const manifest = loadJson<PagesManifestV1>(resolve(manifestPath));

    // Content resolver
    let contentMap: Record<string, string> = {};
    if (contentPath) {
        const raw = loadJson<Record<string, any>>(resolve(contentPath));
        contentMap = flattenKeys(raw);
    }
    const resolveContent = (key: string) => contentMap[key];

    // Load page specs if dir provided
    let specsById: Map<string, PageSpecV1> | undefined;
    if (specsDir) {
        specsById = new Map();
        for (const page of manifest.pages) {
            try {
                const specPath = resolve(specsDir, page.spec.replace(/^\/pages\//, ''));
                const spec = loadJson<PageSpecV1>(specPath);
                specsById.set(page.id, spec);
            } catch {
                // Spec not found — skip
            }
        }
    }

    // Capabilities
    const capabilities = capsRaw
        ? capsRaw.split(';').map((s) => s.trim()).filter(Boolean)
        : undefined;

    const options = { siteName, tagline, baseUrl, capabilities, resolveContent, specsById };

    // Generate
    const llmsTxt = generateLlmsTxt(manifest, options);
    const llmsFullTxt = generateLlmsFullTxt(manifest, options);

    // Write
    const outLlms = resolve(outDir, 'llms.txt');
    const outFull = resolve(outDir, 'llms-full.txt');
    writeFileSync(outLlms, llmsTxt, 'utf-8');
    writeFileSync(outFull, llmsFullTxt, 'utf-8');

    const llmsLines = llmsTxt.split('\n').length;
    const fullLines = llmsFullTxt.split('\n').length;
    console.log(`✅ Generated ${outLlms} (${llmsLines} lines)`);
    console.log(`✅ Generated ${outFull} (${fullLines} lines)`);
}

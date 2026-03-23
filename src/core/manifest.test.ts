import { describe, it, expect } from 'vitest';
import { normalizePathname, resolvePageIdByRoute } from './manifest.js';
import type { PagesManifestV1 } from './types.js';

describe('normalizePathname', () => {
    it('returns / for empty string', () => {
        expect(normalizePathname('')).toBe('/');
    });

    it('keeps / as is', () => {
        expect(normalizePathname('/')).toBe('/');
    });

    it('strips trailing slash', () => {
        expect(normalizePathname('/products/')).toBe('/products');
    });

    it('does not strip from root /', () => {
        expect(normalizePathname('/')).toBe('/');
    });

    it('keeps paths without trailing slash', () => {
        expect(normalizePathname('/about')).toBe('/about');
    });
});

describe('resolvePageIdByRoute', () => {
    const manifest: PagesManifestV1 = {
        version: '1',
        pages: [
            { id: 'home', route: '/', spec: 'pages/home.json' },
            { id: 'pricing', route: '/pricing', spec: 'pages/pricing.json' },
            { id: 'demo', route: '/demo', spec: 'pages/demo.json' },
        ],
    };

    it('resolves root to home', () => {
        expect(resolvePageIdByRoute(manifest, '/')).toBe('home');
    });

    it('resolves /pricing to pricing', () => {
        expect(resolvePageIdByRoute(manifest, '/pricing')).toBe('pricing');
    });

    it('resolves /pricing/ (trailing slash) to pricing', () => {
        expect(resolvePageIdByRoute(manifest, '/pricing/')).toBe('pricing');
    });

    it('returns null for unknown route', () => {
        expect(resolvePageIdByRoute(manifest, '/unknown')).toBeNull();
    });

    it('returns null for empty manifest', () => {
        expect(resolvePageIdByRoute({ version: '1', pages: [] }, '/')).toBeNull();
    });
});

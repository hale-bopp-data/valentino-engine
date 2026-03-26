/**
 * Media — Pure types and resolver for media assets.
 * Migrated from easyway-portal runtime-pages.ts (PBI #606).
 * No DOM, no I/O — pure functions only.
 * The consumer is responsible for loading the manifest (fetch/fs).
 */

export type MediaAsset = {
    key: string;
    file: string;
    alt?: string;
    type?: string;
    tags?: string[];
    width?: number;
    height?: number;
};

export type MediaManifest = {
    version: string;
    assets: MediaAsset[];
};

/** Resolve a media asset URL by key from an already-loaded manifest. */
export function resolveMediaUrl(manifest: MediaManifest, key: string): string | null {
    const asset = manifest.assets.find((a) => a.key === key);
    return asset ? asset.file : null;
}

/** Resolve a full media asset object by key from an already-loaded manifest. */
export function resolveMediaAsset(manifest: MediaManifest, key: string): MediaAsset | null {
    return manifest.assets.find((a) => a.key === key) || null;
}

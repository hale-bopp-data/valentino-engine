/**
 * PageSpec validation — validates against the real PageSpecV1 type.
 * The old PageSpec/LayoutSpec/ComponentSpec/ActionSpec interfaces have been
 * replaced by the full type system in types.ts.
 *
 * @deprecated Use validatePageSpecV1 for richer validation with structured errors.
 */

import type { PageSpecV1 } from './types.js';

/**
 * Basic runtime validation for PageSpecV1.
 * Returns true if the spec has the required shape.
 */
export function validatePageSpec(spec: unknown): spec is PageSpecV1 {
    if (typeof spec !== 'object' || spec === null) return false;
    const s = spec as Record<string, unknown>;
    return (
        s.version === '1' &&
        typeof s.id === 'string' &&
        Array.isArray(s.sections)
    );
}

/**
 * Extension Registry — Plugin system for valentino-engine consumers.
 * Allows custom section types, guardrails, status values, content/media resolvers,
 * and editor panels to be registered by the consumer without modifying the engine.
 *
 * PBI #606 — Extension points for valentino-engine as standalone product.
 */
import type { SectionSpec } from './types.js';
import type { CmsWarning } from './guardrails-cms.js';

// ---------------------------------------------------------------------------
// Extension point types
// ---------------------------------------------------------------------------

/** Custom section renderer — consumer provides how to render unknown section types. */
export type CustomSectionRenderer = (section: SectionSpec, container: unknown) => void;

/** Custom guardrail — consumer provides additional validation rules. */
export type CustomGuardrail = (context: GuardrailContext) => CmsWarning[];

export type GuardrailContext = {
    manifest: unknown;
    specs?: Map<string, unknown>;
    redirectRules?: unknown[];
    [key: string]: unknown;
};

/** Custom content resolver — consumer provides how to load content by key. */
export type ContentResolver = (key: string, lang?: string) => string | undefined;

/** Custom media resolver — consumer provides how to resolve media by key. */
export type MediaResolver = (key: string) => { url: string; alt?: string } | null;

/** Custom editor panel definition. */
export type EditorPanelDef = {
    id: string;
    label: string;
    sectionTypes: string[];  // Which section types this panel applies to
    render: (section: SectionSpec, container: unknown) => void;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type ExtensionRegistry = {
    sectionRenderers: Map<string, CustomSectionRenderer>;
    guardrails: Map<string, CustomGuardrail>;
    customStatuses: Set<string>;
    contentResolver: ContentResolver | null;
    mediaResolver: MediaResolver | null;
    editorPanels: Map<string, EditorPanelDef>;
};

/** Create a fresh, empty registry. */
export function createExtensionRegistry(): ExtensionRegistry {
    return {
        sectionRenderers: new Map(),
        guardrails: new Map(),
        customStatuses: new Set(),
        contentResolver: null,
        mediaResolver: null,
        editorPanels: new Map(),
    };
}

// ---------------------------------------------------------------------------
// Registration API
// ---------------------------------------------------------------------------

/** Register a custom section renderer for a given section type. */
export function registerSectionRenderer(
    registry: ExtensionRegistry,
    sectionType: string,
    renderer: CustomSectionRenderer,
): void {
    registry.sectionRenderers.set(sectionType, renderer);
}

/** Register a custom guardrail rule. */
export function registerGuardrail(
    registry: ExtensionRegistry,
    name: string,
    guardrail: CustomGuardrail,
): void {
    registry.guardrails.set(name, guardrail);
}

/** Register a custom page status value beyond draft/published/scheduled. */
export function registerCustomStatus(
    registry: ExtensionRegistry,
    status: string,
): void {
    registry.customStatuses.add(status);
}

/** Set the content resolver (replaces any existing one). */
export function setContentResolver(
    registry: ExtensionRegistry,
    resolver: ContentResolver,
): void {
    registry.contentResolver = resolver;
}

/** Set the media resolver (replaces any existing one). */
export function setMediaResolver(
    registry: ExtensionRegistry,
    resolver: MediaResolver,
): void {
    registry.mediaResolver = resolver;
}

/** Register an editor panel for specific section types. */
export function registerEditorPanel(
    registry: ExtensionRegistry,
    panel: EditorPanelDef,
): void {
    registry.editorPanels.set(panel.id, panel);
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

/** Check if a section type has a custom renderer. */
export function hasCustomRenderer(registry: ExtensionRegistry, sectionType: string): boolean {
    return registry.sectionRenderers.has(sectionType);
}

/** Get a custom renderer for a section type (or undefined). */
export function getCustomRenderer(registry: ExtensionRegistry, sectionType: string): CustomSectionRenderer | undefined {
    return registry.sectionRenderers.get(sectionType);
}

/** Run all custom guardrails and return combined warnings. */
export function runCustomGuardrails(registry: ExtensionRegistry, context: GuardrailContext): CmsWarning[] {
    const warnings: CmsWarning[] = [];
    for (const guardrail of registry.guardrails.values()) {
        warnings.push(...guardrail(context));
    }
    return warnings;
}

/** Get editor panels applicable to a given section type. */
export function getEditorPanels(registry: ExtensionRegistry, sectionType: string): EditorPanelDef[] {
    return [...registry.editorPanels.values()].filter((p) => p.sectionTypes.includes(sectionType));
}

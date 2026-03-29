/**
 * Video Import — Extract key frames → multi-frame LLM analysis → PageSpecV1.
 * Feature #784 (Il Sarto Copia), PBI #787.
 *
 * Frame extraction happens client-side (browser canvas).
 * Server receives frames as base64 images and combines analysis.
 *
 * Pure functions + async LLM. No ffmpeg, no DOM on server.
 */

import type { PageSpecV1, SectionSpec } from './types.js';
import { validatePageSpec } from './page-spec.js';
import { COCKPIT_SECTION_TYPES } from './cockpit-api.js';
import type { VisionLlmCallback, VisualImportResult, VisualImportOptions } from './visual-import.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VideoImportResult = VisualImportResult & {
    /** Number of frames analyzed */
    frameCount: number;
    /** Sections found per frame */
    frameAnalysis?: Array<{ frameIndex: number; sections: string[] }>;
};

export type VideoImportOptions = VisualImportOptions & {
    /** Maximum frames to analyze (default: 5) */
    maxFrames?: number;
};

export type FrameData = {
    /** Base64-encoded image */
    base64: string;
    /** MIME type */
    mimeType: string;
    /** Timestamp in seconds */
    timestamp: number;
};

// ---------------------------------------------------------------------------
// Multi-frame analysis prompt
// ---------------------------------------------------------------------------

const MULTI_FRAME_SYSTEM_PROMPT = `You are Valentino's Video Import engine. You analyze multiple screenshots (frames) from a video/walkthrough and generate a SINGLE cohesive PageSpecV1 JSON that captures the complete page structure.

RULES:
1. Return ONLY valid JSON — no markdown, no explanation
2. Combine information across ALL frames into ONE unified page spec
3. Earlier frames typically show the top of the page (hero, header)
4. Later frames show content further down (features, CTA, footer)
5. Deduplicate: if the same section appears in multiple frames, include it once
6. Preserve visual hierarchy: hero first, content middle, CTA/footer last
7. You can ONLY use these section types: ${COCKPIT_SECTION_TYPES.join(', ')}
8. Set presentation tokens (surface, rhythmProfile) on each section
9. Use descriptive i18n keys: "page.<context>.<section>.<field>"`;

// ---------------------------------------------------------------------------
// Single frame analysis
// ---------------------------------------------------------------------------

const FRAME_ANALYSIS_PROMPT = `Analyze this screenshot frame and list the sections you see.
Return JSON: { "sections": [{ "type": "section-type", "titleKey": "extracted title or key", "order": N }] }
Only use types from: ${COCKPIT_SECTION_TYPES.join(', ')}
Return ONLY JSON.`;

async function analyzeFrame(
    frame: FrameData,
    llm: VisionLlmCallback,
): Promise<{ sections: Array<{ type: string; titleKey?: string; order?: number }> }> {
    try {
        const raw = await llm(FRAME_ANALYSIS_PROMPT, `Frame at ${frame.timestamp}s`, frame.base64, frame.mimeType);
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return { sections: [] };
    }
}

// ---------------------------------------------------------------------------
// Multi-frame composition
// ---------------------------------------------------------------------------

async function composeFromFrames(
    frames: FrameData[],
    llm: VisionLlmCallback,
    options: VideoImportOptions,
): Promise<VideoImportResult> {
    const warnings: string[] = [];
    const maxFrames = options.maxFrames || 5;
    const selectedFrames = frames.length > maxFrames
        ? selectKeyFrames(frames, maxFrames)
        : frames;

    if (selectedFrames.length === 0) {
        return {
            success: false,
            spec: null,
            warnings: ['No frames to analyze'],
            frameCount: 0,
        };
    }

    // Strategy: if only 1 frame, use single-image import
    if (selectedFrames.length === 1) {
        const { importFromImage } = await import('./visual-import.js');
        const result = await importFromImage(
            selectedFrames[0].base64,
            selectedFrames[0].mimeType,
            llm,
            options,
        );
        return {
            ...result,
            frameCount: 1,
            frameAnalysis: result.detectedSections
                ? [{ frameIndex: 0, sections: result.detectedSections }]
                : undefined,
        };
    }

    // Multi-frame: analyze each frame individually first
    const frameAnalysis: Array<{ frameIndex: number; sections: string[] }> = [];
    for (let i = 0; i < selectedFrames.length; i++) {
        const analysis = await analyzeFrame(selectedFrames[i], llm);
        const sections = analysis.sections
            .filter(s => COCKPIT_SECTION_TYPES.includes(s.type))
            .map(s => s.type);
        frameAnalysis.push({ frameIndex: i, sections });
    }

    // Build multi-frame composition prompt with all frames
    const frameDescriptions = frameAnalysis.map((fa, i) =>
        `Frame ${i + 1} (${selectedFrames[i].timestamp}s): ${fa.sections.join(', ') || 'no sections detected'}`
    ).join('\n');

    const compositionPrompt = [
        `Compose a unified PageSpecV1 from ${selectedFrames.length} video frames.`,
        `Page ID: "${options.id}"`,
        options.language ? `Language: ${options.language}` : '',
        '',
        'Frame analysis:',
        frameDescriptions,
        '',
        'Generate the complete PageSpecV1 combining all frames. Return ONLY JSON.',
    ].join('\n');

    // Send first frame as visual reference + text context
    try {
        const raw = await llm(
            MULTI_FRAME_SYSTEM_PROMPT,
            compositionPrompt,
            selectedFrames[0].base64,
            selectedFrames[0].mimeType,
        );

        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        let parsed: unknown;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return {
                success: false,
                spec: null,
                warnings: ['LLM returned invalid JSON for multi-frame composition'],
                frameCount: selectedFrames.length,
                frameAnalysis,
            };
        }

        const rawObj = parsed as Record<string, unknown>;
        const spec: PageSpecV1 = {
            version: '1',
            id: options.id,
            profile: (rawObj.profile as any) || undefined,
            sections: [],
        };

        if (Array.isArray(rawObj.sections)) {
            for (const section of rawObj.sections) {
                if (typeof section !== 'object' || section === null) continue;
                const s = section as Record<string, unknown>;
                if (!s.type || !COCKPIT_SECTION_TYPES.includes(s.type as string)) {
                    if (s.type) warnings.push(`Skipped unknown type: ${s.type}`);
                    continue;
                }
                spec.sections.push(section as SectionSpec);
            }
        }

        if (spec.sections.length === 0) {
            warnings.push('No valid sections — adding default hero');
            spec.sections.push({
                type: 'hero',
                titleKey: `page.${options.id}.hero.title`,
                presentation: { surface: 'shell-dark', rhythmProfile: 'hero' },
            });
        }

        if (!validatePageSpec(spec)) {
            warnings.push('Generated spec failed validation');
        }

        return {
            success: true,
            spec,
            warnings,
            detectedSections: spec.sections.map(s => s.type),
            frameCount: selectedFrames.length,
            frameAnalysis,
        };
    } catch (err) {
        return {
            success: false,
            spec: null,
            warnings: [`Multi-frame composition failed: ${err instanceof Error ? err.message : String(err)}`],
            frameCount: selectedFrames.length,
            frameAnalysis,
        };
    }
}

// ---------------------------------------------------------------------------
// Frame selection — pick evenly spaced key frames
// ---------------------------------------------------------------------------

function selectKeyFrames(frames: FrameData[], count: number): FrameData[] {
    if (frames.length <= count) return frames;
    const step = (frames.length - 1) / (count - 1);
    const selected: FrameData[] = [];
    for (let i = 0; i < count; i++) {
        selected.push(frames[Math.round(i * step)]);
    }
    return selected;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import from video frames → PageSpecV1.
 *
 * Frame extraction happens client-side (browser canvas + video element).
 * This function receives pre-extracted frames as base64 images.
 *
 * @param frames - Array of extracted video frames
 * @param llm - Vision LLM callback
 * @param options - Import options
 */
export async function importFromVideo(
    frames: FrameData[],
    llm: VisionLlmCallback,
    options: VideoImportOptions,
): Promise<VideoImportResult> {
    return composeFromFrames(frames, llm, options);
}

/** Exported for testing */
export { selectKeyFrames };

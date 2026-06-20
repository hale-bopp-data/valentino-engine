/**
 * Image Provider — bridged image generation (external endpoint).
 * PBI #1671 (Image bridge, provider pattern G16).
 *
 * Valentino NON genera immagini. Prepara il contesto (token, dimensioni, palette),
 * chiama un endpoint esterno configurato dall'utente, riceve l'immagine e la piazza.
 *
 * Default: placeholder SVG inline generato dai design token (zero dipendenze).
 */

export type ImageProviderConfig = {
    /** Provider name or URL (e.g., 'nanobanana', 'https://api.openai.com/v1/images/generations') */
    endpoint?: string;
    /** Token for the external service */
    token?: string;
    /** Model identifier (e.g., 'dall-e-3', 'stable-diffusion-xl') */
    model?: string;
    /** Image width (pixels) */
    width?: number;
    /** Image height (pixels) */
    height?: number;
};

export type ImageGenerationRequest = {
    /** Text prompt describing the desired image */
    prompt: string;
    /** Design context: colors, dimensions, mood */
    context?: {
        primaryColor?: string;
        backgroundColor?: string;
        accentColor?: string;
        textColor?: string;
        width?: number;
        height?: number;
        style?: 'corporate' | 'landing' | 'minimal';
    };
};

export type ImageResult = {
    /** URL of generated image (if external provider) */
    url?: string;
    /** Base64-encoded image (if returned inline) */
    base64?: string;
    /** SVG markup (if using default placeholder) */
    svg?: string;
    /** MIME type */
    mimeType: string;
    /** Provider that generated the image */
    provider: string;
};

// ─── Default: SVG placeholder from design tokens ───────────────────────────

function generatePlaceholderSvg(context: ImageGenerationRequest['context'] = {}): string {
    const {
        primaryColor = '#1a73e8',
        backgroundColor = '#0a0a0a',
        accentColor = '#34a853',
        textColor = '#ffffff',
        width = 1200,
        height = 630,
        style = 'corporate',
    } = context;

    const isDark = backgroundColor === '#0a0a0a' || backgroundColor.startsWith('#0') || backgroundColor === '#000000';

    // Simple SVG banner with gradient
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        '  <defs>',
        `    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
        `      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.3" />`,
        `      <stop offset="100%" style="stop-color:${backgroundColor};stop-opacity:1" />`,
        '    </linearGradient>',
        `    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">`,
        `      <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.4" />`,
        `      <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0" />`,
        '    </linearGradient>',
        '  </defs>',
        `  <rect width="${width}" height="${height}" fill="url(#bg)" />`,
        style !== 'minimal' ? `  <rect x="0" y="${height - 4}" width="${width}" height="4" fill="url(#accent)" />` : '',
        `  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle"`,
        `        font-family="system-ui, sans-serif" font-size="36" font-weight="600"`,
        `        fill="${textColor}" opacity="0.6">`,
        '    placeholder',
        '  </text>',
        '</svg>',
    ].join('\n');
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generate an image via external endpoint or fallback to placeholder SVG.
 * Pure function — caller provides the config.
 */
export async function generateImage(
    request: ImageGenerationRequest,
    config: ImageProviderConfig = {},
): Promise<ImageResult> {
    // Default: SVG placeholder (zero dependencies)
    if (!config.endpoint) {
        return {
            svg: generatePlaceholderSvg(request.context),
            mimeType: 'image/svg+xml',
            provider: 'valentino-placeholder',
        };
    }

    // External endpoint: call configured provider
    try {
        const body = JSON.stringify({
            prompt: request.prompt,
            model: config.model || 'default',
            n: 1,
            size: `${config.width || request.context?.width || 1200}x${config.height || request.context?.height || 630}`,
            response_format: 'url',
        });

        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
            },
            body,
        });

        if (!response.ok) {
            throw new Error(`Image provider returned ${response.status}`);
        }

        const data = await response.json() as any;
        const url = data?.data?.[0]?.url || data?.url || data?.image_url;

        if (url) {
            return { url, mimeType: 'image/png', provider: config.endpoint };
        }

        // Provider returned base64
        const b64 = data?.data?.[0]?.b64_json || data?.image || data?.base64;
        if (b64) {
            return { base64: b64, mimeType: 'image/png', provider: config.endpoint };
        }

        throw new Error('Image provider returned no image data');
    } catch (e) {
        // Fallback to placeholder on error
        return {
            svg: generatePlaceholderSvg(request.context),
            mimeType: 'image/svg+xml',
            provider: `valentino-placeholder(fallback: ${String(e)})`,
        };
    }
}

/**
 * Generate placeholder SVG (synchronous, no network).
 * Useful for instant preview without external API.
 */
export function generatePlaceholder(context: ImageGenerationRequest['context'] = {}): string {
    return generatePlaceholderSvg(context);
}

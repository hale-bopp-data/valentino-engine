import { generateImage, generatePlaceholder, type ImageGenerationRequest, type ImageProviderConfig } from '../../core/providers/image.js';

export function runImageGenerate(args: string[]): void {
    const promptIdx = args.indexOf('--prompt');
    const endpointIdx = args.indexOf('--endpoint');
    const tokenIdx = args.indexOf('--token');
    const modelIdx = args.indexOf('--model');
    const widthIdx = args.indexOf('--width');
    const heightIdx = args.indexOf('--height');
    const primaryIdx = args.indexOf('--primary-color');
    const bgIdx = args.indexOf('--bg-color');
    const accentIdx = args.indexOf('--accent-color');
    const styleIdx = args.indexOf('--style');
    const outputIdx = args.indexOf('--output');

    const prompt = promptIdx >= 0 ? args[promptIdx + 1] : undefined;
    const endpoint = endpointIdx >= 0 ? args[endpointIdx + 1] : undefined;
    const token = tokenIdx >= 0 ? args[tokenIdx + 1] : undefined;
    const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
    const width = widthIdx >= 0 ? parseInt(args[widthIdx + 1]) : undefined;
    const height = heightIdx >= 0 ? parseInt(args[heightIdx + 1]) : undefined;
    const primaryColor = primaryIdx >= 0 ? args[primaryIdx + 1] : undefined;
    const bgColor = bgIdx >= 0 ? args[bgIdx + 1] : undefined;
    const accentColor = accentIdx >= 0 ? args[accentIdx + 1] : undefined;
    const style = styleIdx >= 0 ? args[styleIdx + 1] as 'corporate' | 'landing' | 'minimal' : 'corporate';
    const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

    if (!prompt) {
        console.error('Usage: valentino image generate --prompt "description" ...');
        process.exit(1);
    }

    async function run() {
        try {
            const request: ImageGenerationRequest = {
                prompt: prompt!,
                context: {
                    primaryColor: primaryColor || '#1a73e8',
                    backgroundColor: bgColor || '#0a0a0a',
                    accentColor: accentColor || '#34a853',
                    textColor: '#ffffff',
                    width: width || 1200,
                    height: height || 630,
                    style: style || 'corporate',
                },
            };

            const config: ImageProviderConfig = {
                endpoint,
                token,
                model,
                width: width || 1200,
                height: height || 630,
            };

            const result = await generateImage(request, config);

            if (outputPath && result.svg) {
                const fs = await import('fs');
                fs.writeFileSync(outputPath, result.svg);
                console.log(`SVG written to ${outputPath}`);
            }

            console.log(JSON.stringify({
                provider: result.provider,
                mimeType: result.mimeType,
                isPlaceholder: !!result.svg,
                url: result.url,
                svgPreview: result.svg ? result.svg.substring(0, 200) + '...' : undefined,
            }, null, 2));
        } catch (e) {
            console.error('Image generation failed:', e);
            process.exit(1);
        }
    }

    run();
}

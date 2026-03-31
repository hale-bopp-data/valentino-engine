/**
 * valentino spool <source> [--out <file>]
 *
 * Analyze an existing site's CSS and generate Valentino-compatible custom tokens.
 * Source can be a local directory or a URL (http/https).
 * 80% automatic extraction, 20% operator refinement.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spool, spoolFromUrl } from '../../core/spool.js';
import type { SpoolOutput } from '../../core/spool.js';

function isUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}

export function runSpool(args: string[]): void {
  if (!args[0]) {
    console.error('Usage: valentino spool <source> [--out <file>]');
    console.error('  <source> can be a local directory or a URL (http/https)');
    console.error('  Analyzes CSS and generates custom-tokens.css');
    process.exit(1);
  }

  const source = args[0];
  let outFile: string | null = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outFile = args[++i];
    }
  }

  console.log(`\n🧵 Valentino Spool — analyzing ${source}...\n`);

  const run = async () => {
    let result: SpoolOutput;
    if (isUrl(source)) {
      result = await spoolFromUrl(source);
    } else {
      result = spool(source);
    }
    return result;
  };

  run().then((result) => {
    const a = result.analysis;
    printReport(a, result, outFile);
  }).catch((err) => {
    console.error(`  ✗ ${(err as Error).message}`);
    process.exit(1);
  });
}

function printReport(a: SpoolOutput['analysis'], result: SpoolOutput, outFile: string | null): void {

    // Report
    console.log(`  Files:    ${a.cssFiles.length} CSS files, ${a.totalLines} lines`);
    console.log(`  Colors:   ${a.colors.length} unique (top 20 shown)`);
    console.log(`  Sections: ~${a.sectionCount} detected`);
    console.log(`  Hero:     ${a.hasHero ? '✓' : '✗'}  Grid: ${a.hasGrid ? '✓' : '✗'}  Form: ${a.hasForm ? '✓' : '✗'}`);
    console.log(`  Template: ${a.suggestedTemplate}`);
    console.log('');

    if (a.darkestBg) {
      console.log(`  Darkest bg:  ${a.darkestBg.value} (lum ${a.darkestBg.luminance.toFixed(3)})`);
    }
    if (a.lightestBg) {
      console.log(`  Lightest bg: ${a.lightestBg.value} (lum ${a.lightestBg.luminance.toFixed(3)})`);
    }
    if (a.accents.length > 0) {
      console.log(`  Accents:     ${a.accents.map(c => c.value).join(', ')}`);
    }
    console.log('');

    // Output
    if (outFile) {
      const absOut = resolve(outFile);
      writeFileSync(absOut, result.customTokensCss, 'utf-8');
      console.log(`  ✓ Written: ${absOut}`);
    } else {
      console.log('--- custom-tokens.css ---');
      console.log(result.customTokensCss);
      console.log('--- end ---');
      console.log('\n  Use --out <file> to write to disk.');
    }

    // Next steps
    console.log(`
Next steps:
  1. Import tokens + your custom overrides + base + template:
     @import '@hale-bopp/valentino-engine/css/tokens.css';
     @import './custom-tokens.css';
     @import '@hale-bopp/valentino-engine/css/framework.base.css';
     @import '@hale-bopp/valentino-engine/css/framework.${a.suggestedTemplate !== 'unknown' ? a.suggestedTemplate : 'corporate'}.css';
  2. Map your HTML sections to <div class="valentino-section-shell" data-surface="..." data-rhythm-profile="...">
  3. Run: valentino theme-audit custom-tokens.css — to verify contrast
  4. Run: valentino audit your-styles.css — to check guardrails
`);
}

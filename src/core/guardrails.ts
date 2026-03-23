/**
 * Core Guardrails — the 10 Sovereign Laws of Valentino Engine.
 * Each law is a programmatic check, not just documentation.
 */

export const GUARDRAILS = {
  /** G1: No hardcoded px values in component overrides */
  NO_HARDCODED_PX: /(?<!\d)(\d+)px(?!\s*[/*])/,

  /** G2: No RGBA or HEX hardcoded colors */
  NO_HARDCODED_COLOR: /#[0-9a-fA-F]{3,8}|rgba?\(/,

  /** G3: No direct DOM style manipulation */
  NO_INLINE_STYLE: /\.style\.(padding|margin|color|background)\s*=/,
} as const;

export function checkNoHardcodedPx(css: string): string[] {
  const violations: string[] = [];
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    if (GUARDRAILS.NO_HARDCODED_PX.test(line)) {
      violations.push(`Line ${i + 1}: Hardcoded px detected — use --valentino-rhythm-* variables. "${line.trim()}"`);
    }
  });
  return violations;
}

export function checkNoHardcodedColor(css: string): string[] {
  const violations: string[] = [];
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    if (GUARDRAILS.NO_HARDCODED_COLOR.test(line)) {
      violations.push(`Line ${i + 1}: Hardcoded color detected — use CSS root variables. "${line.trim()}"`);
    }
  });
  return violations;
}

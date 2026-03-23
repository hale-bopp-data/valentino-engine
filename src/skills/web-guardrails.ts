export const webGuardrailsSkill = {
  name: 'valentino-web-guardrails',
  description: 'Enforce ARIA, semantic HTML, and performance compliance on all generated components.',
  rules: [
    'Every interactive element must have an aria-label or labelKey',
    'Images must have alt text',
    'Avoid layout-triggering CSS properties (width, height) in animations',
    'Respect OPS vs Product UI boundary',
  ],
} as const;

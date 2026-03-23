export const designGuidelinesSkill = {
  name: 'web-design-guidelines',
  description: 'Provide a unified baseline for web ergonomics, typography, and responsive layouts.',
  rules: [
    'Mobile-first layout architecture',
    'Use only CSS token variables for font sizes (--text-step-*)',
    'No hardcoded container widths — use fluid max-width with clamp()',
    'Spacing scales must follow the 8-point grid system via CSS variables',
  ],
} as const;

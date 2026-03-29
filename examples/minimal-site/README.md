# Minimal Site — valentino-engine example

A minimal site that demonstrates `@hale-bopp/valentino-engine` as a standalone npm dependency.
No EasyWay infrastructure required. No framework. Just JSON + validation.

## Quick Start (5 minutes)

```bash
# Install
npm install

# Validate all pages
npm run check

# Validate a single page
npx valentino validate pages/home.json

# Run probes (rhythm, hero contract, integrity)
npx valentino probe all pages/home.json

# Check WCAG contrast
npx valentino contrast "#1a1a2e" "#ffffff" AA
```

## What's inside

```
minimal-site/
  package.json         <- depends on @hale-bopp/valentino-engine
  pages/
    home.json          <- home page spec (hero + cards + cta)
    about.json         <- about page spec (hero + how-it-works)
  README.md            <- this file
```

## How it works

Each page is a JSON file following the `PageSpecV1` schema. The engine validates:

- **Schema**: section types, required fields, presentation tokens
- **WCAG**: contrast ratios on surface combinations
- **Rhythm**: section alternation patterns
- **Hero contract**: first-fold constraints
- **CMS guardrails**: draft/published states, redirects, SEO completeness

You compose pages by writing JSON. The engine ensures they're correct.

## Rendering

valentino-engine is **spec-only** — it validates and resolves, but never touches the DOM.
To render, pick your framework (Web Components, React, Vue, plain HTML) and map sections to components.

```typescript
import { resolvePresentation, type PageSpecV1 } from '@hale-bopp/valentino-engine';

const spec: PageSpecV1 = JSON.parse(fs.readFileSync('pages/home.json', 'utf-8'));

for (const section of spec.sections) {
  const presentation = resolvePresentation(section);
  // render section with your framework of choice
}
```

## Inspired by

This example is inspired by [EasyWay](https://github.com/hale-bopp-data), where valentino-engine was born.
The DNA stays. The dependency doesn't.

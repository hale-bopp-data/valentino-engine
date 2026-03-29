# Contributing to Valentino Engine

Thank you for your interest in contributing! Valentino Engine is an open source project and we welcome contributions from everyone.

## Getting Started

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/valentino-engine.git
cd valentino-engine
npm install
npm run build
npm test
```

## Development

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Test the CLI locally
node dist/bin/valentino.js validate examples/minimal-site/pages/home.json
node dist/bin/valentino.js probe all examples/minimal-site/pages/home.json
```

## Project Structure

```
src/
  bin/              CLI entry point and commands
  core/             Engine logic (types, validation, probes, guardrails)
  mcp/              Model Context Protocol server
examples/
  minimal-consumer/ API usage example (TypeScript)
  minimal-site/     Standalone project example (JSON page specs)
```

## What We Accept

- Bug fixes with test coverage
- New validation probes (rhythm, accessibility, structure)
- New guardrails (design token enforcement, anti-patterns)
- Documentation improvements
- New examples showing different use cases
- Performance improvements to validation pipeline

## What We Don't Accept

- Framework-specific rendering code (Valentino is spec-only, framework-agnostic)
- Breaking changes to PageSpecV1 without RFC discussion
- External dependencies beyond `zod` and `@modelcontextprotocol/sdk`
- Changes that compromise sovereignty (vendor lock-in, cloud-only features)

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(probes): add animation duration probe
fix(contrast): handle transparent background correctly
docs: update getting started guide
test: add edge cases for rhythm probe
```

## Pull Request Process

1. Fork and create a feature branch (`feat/my-feature` or `fix/my-bug`)
2. Write tests for new functionality
3. Ensure all tests pass: `npm test`
4. Ensure validation works: `node dist/bin/valentino.js validate examples/minimal-site/pages/home.json`
5. Open a PR against `main` with a clear description

## Code of Conduct

Be respectful, constructive, and collaborative. We're building something sovereign and antifragile — that applies to the community too.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

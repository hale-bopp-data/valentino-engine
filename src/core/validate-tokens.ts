export interface TokenViolation {
  type: 'self-reference' | 'cycle' | 'unresolved';
  token: string;
  detail: string;
}

export interface ValidateTokensResult {
  valid: boolean;
  violations: TokenViolation[];
  tokenCount: number;
}

const CUSTOM_PROP_DECL_RE = /(--[\w-]+)\s*:\s*([^;]+)/g;
const VAR_REF_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*[^)]*)?\)/g;

export function parseTokenDeclarations(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  let match;
  CUSTOM_PROP_DECL_RE.lastIndex = 0;
  while ((match = CUSTOM_PROP_DECL_RE.exec(css)) !== null) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

export function extractVarReferences(value: string): string[] {
  const refs: string[] = [];
  let match;
  VAR_REF_RE.lastIndex = 0;
  while ((match = VAR_REF_RE.exec(value)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function detectCycles(tokens: Map<string, string>): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const graph = new Map<string, string[]>();

  for (const [name, value] of tokens) {
    graph.set(name, extractVarReferences(value));
  }

  for (const [name, refs] of graph) {
    if (refs.includes(name)) {
      violations.push({
        type: 'self-reference',
        token: name,
        detail: `${name} references itself: ${tokens.get(name)}`,
      });
      continue;
    }

    const visited = new Set<string>();
    const stack = [...refs];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === name) {
        violations.push({
          type: 'cycle',
          token: name,
          detail: `${name} has a circular dependency chain`,
        });
        break;
      }
      if (!visited.has(current)) {
        visited.add(current);
        const nextRefs = graph.get(current);
        if (nextRefs) stack.push(...nextRefs);
      }
    }
  }

  return violations;
}

function detectUnresolved(tokens: Map<string, string>): TokenViolation[] {
  const violations: TokenViolation[] = [];
  for (const [name, value] of tokens) {
    const refs = extractVarReferences(value);
    for (const ref of refs) {
      if (!tokens.has(ref)) {
        violations.push({
          type: 'unresolved',
          token: name,
          detail: `${name} references undefined token ${ref}`,
        });
      }
    }
  }
  return violations;
}

export function validateTokens(css: string): ValidateTokensResult {
  const tokens = parseTokenDeclarations(css);
  const violations = [
    ...detectCycles(tokens),
    ...detectUnresolved(tokens),
  ];
  return {
    valid: violations.length === 0,
    violations,
    tokenCount: tokens.size,
  };
}

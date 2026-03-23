import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkNoHardcodedPx, checkNoHardcodedColor, checkNoNamedColor } from '../core/guardrails.js';
import { validatePageSpec } from '../core/page-spec.js';
import { premiumDesignSkill, webGuardrailsSkill, designGuidelinesSkill } from '../skills/index.js';

const server = new McpServer({
  name: 'valentino-engine',
  version: '0.1.0',
});

// --- Audit Tools ---

server.tool(
  'valentino_audit_css',
  'Audit a CSS string for hardcoded px values and hardcoded colors. Returns violations list.',
  {
    css: z.string().describe('CSS content to audit'),
  },
  async ({ css }) => {
    const pxViolations = checkNoHardcodedPx(css);
    const colorViolations = checkNoHardcodedColor(css);
    const namedColorViolations = checkNoNamedColor(css);
    const violations = [...pxViolations, ...colorViolations, ...namedColorViolations];
    const result = violations.length === 0
      ? { valid: true, message: 'No guardrail violations found.' }
      : { valid: false, violations };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'valentino_validate_pagespec',
  'Validate a Runtime PageSpec JSON against the Valentino Engine contract.',
  {
    spec: z.string().describe('PageSpec JSON string to validate'),
  },
  async ({ spec }) => {
    try {
      const parsed = JSON.parse(spec);
      const valid = validatePageSpec(parsed);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ valid, message: valid ? 'PageSpec is valid.' : 'PageSpec is missing required fields (id, version, components).' }, null, 2),
        }],
      };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ valid: false, message: `Invalid JSON: ${String(e)}` }, null, 2) }] };
    }
  },
);

// --- Skill Tools ---

server.tool(
  'valentino_get_skill',
  'Get the rules for a Valentino Engine design skill.',
  {
    skill: z.enum(['premium-design', 'web-guardrails', 'design-guidelines']).describe('Skill name'),
  },
  async ({ skill }) => {
    const map = {
      'premium-design': premiumDesignSkill,
      'web-guardrails': webGuardrailsSkill,
      'design-guidelines': designGuidelinesSkill,
    };
    return { content: [{ type: 'text', text: JSON.stringify(map[skill], null, 2) }] };
  },
);

server.tool(
  'valentino_list_guardrails',
  'List all 10 Sovereign Guardrails of Valentino Engine.',
  {},
  async () => {
    const guardrails = [
      '1. WhatIf di Layout — Never generate code without a conceptual wireframe first',
      '2. Component Boundary & Fallbacks — All API bridges must include Error Boundaries',
      '3. Design Token System — No magic numbers or hardcoded hex/rgba values',
      '4. L3 Audit before Commit — Check for dependency bloat and ARIA compliance',
      '5. Escalation to GEDI — Consult GEDI on architectural trade-offs',
      '6. Zero UI-Debt — Always scan for reusable components before creating new ones',
      '7. Electrical Socket Pattern — Colors via CSS root variables only',
      '8. Testudo Formation — Respect parent container padding, no inline overrides',
      '9. Tangible Legacy — No redundant CSS blocks; use utility classes',
      '10. Visual Live Audit — Use MCP browser_screenshot or npm run test:e2e:valentino',
    ];
    return { content: [{ type: 'text', text: guardrails.join('\n') }] };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('valentino-engine MCP server running on stdio');
  process.stdin.resume();
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});

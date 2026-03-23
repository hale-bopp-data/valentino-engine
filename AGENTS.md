# Agents that use Valentino Engine

## Direct MCP Integration

| Agent | Level | How it uses Valentino Engine |
|-------|-------|-----------------------------|
| **Agent Valentino** | L3 | Primary consumer — validates page specs, audits CSS, runs probes |
| **Agent Valentino Design** | L1 | CRO review — uses contrast checker, hero contract validation |
| **Agent Scrummaster** | L2 | Sprint QA — runs `probe all` on changed page specs |
| **Agent GEDI** | L1 | Architectural review — consulted by probes via escalation |

## CLI Usage

Any agent with shell access can invoke:

```bash
npx @hale-bopp/valentino audit <file.css>
npx @hale-bopp/valentino probe all <spec.json>
npx @hale-bopp/valentino contrast "#000" "#fff" AA
```

## MCP Configuration

```json
{
  "mcp_servers": {
    "valentino-engine": {
      "command": "npx",
      "args": ["@hale-bopp/valentino-engine", "mcp"]
    }
  }
}
```

## 13 MCP Tools

| Tool | Description |
|------|-------------|
| `valentino_audit_css` | Audit CSS for hardcoded px, hex/rgba, and named colors |
| `valentino_validate_pagespec` | Validate PageSpecV1 contract |
| `valentino_check_contrast` | WCAG 2.1 contrast ratio check |
| `valentino_probe_rhythm` | Section sequence rhythm validation |
| `valentino_probe_hero` | Hero contract enforcement |
| `valentino_probe_integrity` | Per-type structural validation |
| `valentino_probe_all` | All probes combined |
| `valentino_resolve_catalog` | Resolve spec with catalog |
| `valentino_resolve_route` | Resolve URL route to page ID |
| `valentino_get_skill` | Get design skill rules |
| `valentino_list_guardrails` | List 10 Sovereign Guardrails |

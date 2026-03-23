export function runGuardrails(): void {
    const guardrails = [
        '1. WhatIf di Layout — Wireframe first, code second',
        '2. Component Boundary & Fallbacks — Error Boundaries on all API bridges',
        '3. Design Token System — No hardcoded colors or px values',
        '4. L3 Audit before Commit — ARIA, performance, and dependency check',
        '5. Escalation to GEDI — Consult GEDI on architectural trade-offs',
        '6. Zero UI-Debt — Reuse before creating',
        '7. Electrical Socket Pattern — CSS root variables for all colors',
        '8. Testudo Formation — No inline padding/margin overrides on containers',
        '9. Tangible Legacy — No redundant CSS blocks',
        '10. Visual Live Audit — Use MCP browser_screenshot or npm run test:e2e:valentino',
    ];
    console.log('\n🛡️  Valentino Engine — 10 Sovereign Guardrails\n');
    guardrails.forEach(g => console.log(' ', g));
    console.log();
}

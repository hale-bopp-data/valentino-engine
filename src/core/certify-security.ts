export interface SecurityViolation {
  type: 'inline-style' | 'token-override' | 'event-handler';
  severity: 'critical' | 'warning';
  line: number;
  element?: string;
  detail: string;
}

export interface SecurityCertification {
  certified: boolean;
  violations: SecurityViolation[];
  summary: {
    inlineStyleCount: number;
    tokenOverrideCount: number;
    eventHandlerCount: number;
  };
}

const CRITICAL_ELEMENTS = new Set([
  'form', 'input', 'button', 'a', 'nav', 'header', 'footer',
  'select', 'textarea', 'label', 'iframe', 'script', 'object', 'embed',
]);

const INLINE_STYLE_RE = /<(\w[\w-]*)\b[^>]*\bstyle\s*=\s*"([^"]*)"/gi;

const EVENT_HANDLER_RE = /<(\w[\w-]*)\b[^>]*\b(on\w+)\s*=\s*"[^"]*"/gi;

const CSS_BLOCK_RE = /([^{}]+)\{([^}]*)\}/g;

const CUSTOM_PROP_RE = /(--[\w-]+)\s*:/g;

function lineAt(text: string, index: number): number {
  return text.substring(0, index).split('\n').length;
}

export function checkInlineStyles(html: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  INLINE_STYLE_RE.lastIndex = 0;
  let match;
  while ((match = INLINE_STYLE_RE.exec(html)) !== null) {
    const element = match[1].toLowerCase();
    const severity = CRITICAL_ELEMENTS.has(element) ? 'critical' as const : 'warning' as const;
    violations.push({
      type: 'inline-style',
      severity,
      line: lineAt(html, match.index),
      element,
      detail: `Inline style on <${element}>: "${match[2].length > 60 ? match[2].substring(0, 57) + '...' : match[2]}"`,
    });
  }
  return violations;
}

export function checkEventHandlers(html: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  EVENT_HANDLER_RE.lastIndex = 0;
  let match;
  while ((match = EVENT_HANDLER_RE.exec(html)) !== null) {
    const element = match[1].toLowerCase();
    violations.push({
      type: 'event-handler',
      severity: 'critical',
      line: lineAt(html, match.index),
      element,
      detail: `Inline event handler ${match[2]} on <${element}>`,
    });
  }
  return violations;
}

export function checkTokenOverrides(css: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  CSS_BLOCK_RE.lastIndex = 0;
  let match;
  while ((match = CSS_BLOCK_RE.exec(css)) !== null) {
    const selector = match[1].trim();
    const body = match[2];
    const blockStart = match.index;

    const isRoot = /^:root$|^html$/i.test(selector);
    if (isRoot) continue;

    CUSTOM_PROP_RE.lastIndex = 0;
    let propMatch;
    while ((propMatch = CUSTOM_PROP_RE.exec(body)) !== null) {
      const token = propMatch[1];
      const lineInBody = body.substring(0, propMatch.index).split('\n').length - 1;
      const absoluteLine = lineAt(css, blockStart) + lineInBody;
      violations.push({
        type: 'token-override',
        severity: 'warning',
        line: absoluteLine,
        detail: `Token ${token} overridden in "${selector}" (outside :root)`,
      });
    }
  }
  return violations;
}

export function certifySecurity(html: string): SecurityCertification {
  const inlineViolations = checkInlineStyles(html);
  const eventViolations = checkEventHandlers(html);

  const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const cssBlocks: string[] = [];
  let m;
  styleTagRe.lastIndex = 0;
  while ((m = styleTagRe.exec(html)) !== null) {
    cssBlocks.push(m[1]);
  }
  const css = cssBlocks.join('\n');
  const tokenViolations = checkTokenOverrides(css);

  const violations = [...inlineViolations, ...eventViolations, ...tokenViolations];

  return {
    certified: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
    summary: {
      inlineStyleCount: inlineViolations.length,
      tokenOverrideCount: tokenViolations.length,
      eventHandlerCount: eventViolations.length,
    },
  };
}

export function certifySecurityCss(css: string): SecurityCertification {
  const tokenViolations = checkTokenOverrides(css);

  return {
    certified: tokenViolations.filter(v => v.severity === 'critical').length === 0,
    violations: tokenViolations,
    summary: {
      inlineStyleCount: 0,
      tokenOverrideCount: tokenViolations.length,
      eventHandlerCount: 0,
    },
  };
}

export function formatCertification(cert: SecurityCertification, filePath: string): string {
  const lines: string[] = [];
  const { summary } = cert;

  lines.push(`Security audit: ${filePath}`);
  lines.push(`  Inline styles: ${summary.inlineStyleCount}`);
  lines.push(`  Token overrides: ${summary.tokenOverrideCount}`);
  lines.push(`  Event handlers: ${summary.eventHandlerCount}`);
  lines.push('');

  if (cert.violations.length === 0) {
    lines.push('CERTIFIED: UI surface is governance-controlled.');
    return lines.join('\n');
  }

  const critical = cert.violations.filter(v => v.severity === 'critical');
  const warnings = cert.violations.filter(v => v.severity === 'warning');

  if (critical.length > 0) {
    lines.push(`CRITICAL (${critical.length}):`);
    for (const v of critical) {
      lines.push(`  line ${v.line}: [${v.type}] ${v.detail}`);
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push(`WARNING (${warnings.length}):`);
    for (const v of warnings) {
      lines.push(`  line ${v.line}: [${v.type}] ${v.detail}`);
    }
    lines.push('');
  }

  if (cert.certified) {
    lines.push('CERTIFIED (warnings only — no critical violations).');
  } else {
    lines.push('NOT CERTIFIED: critical violations found.');
  }

  return lines.join('\n');
}

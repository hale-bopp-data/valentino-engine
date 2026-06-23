export interface SecurityViolation {
  type: 'inline-style' | 'token-override' | 'event-handler'
    | 'missing-alt' | 'missing-aria' | 'heading-order' | 'focus-management';
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
    missingAltCount: number;
    missingAriaCount: number;
    headingOrderCount: number;
    focusManagementCount: number;
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

const INTERACTIVE_CONTAINER_RE = /<(button|a|select|textarea)\b([^>]*)(?:>([\s\S]*?)<\/\1>|\/>)/gi;

const INPUT_TAG_RE = /<input\b([^>]*)>/gi;

const ATTR_RE = /\s([\w-]+)\s*=\s*"([^"]*)"/gi;

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let am;
  while ((am = ATTR_RE.exec(attrString)) !== null) {
    attrs[am[1].toLowerCase()] = am[2];
  }
  return attrs;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function attrsHaveAccessibleName(attrs: Record<string, string>): boolean {
  if ('aria-label' in attrs && attrs['aria-label'].trim() !== '') return true;
  if ('aria-labelledby' in attrs) return true;
  if ('title' in attrs && attrs.title.trim() !== '') return true;
  if ('placeholder' in attrs && attrs.placeholder.trim() !== '') return true;
  return false;
}

export function checkMissingAlt(html: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const imgRe = /<img\b([^>]*)>/gi;
  imgRe.lastIndex = 0;
  let match;
  while ((match = imgRe.exec(html)) !== null) {
    const attrs = parseAttrs(match[1]);
    if (!('alt' in attrs)) {
      violations.push({
        type: 'missing-alt',
        severity: 'critical',
        line: lineAt(html, match.index),
        element: 'img',
        detail: `<img> without alt attribute (src="${(attrs.src || '').substring(0, 50)}")`,
      });
    }
  }
  return violations;
}

export function checkMissingAria(html: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  INPUT_TAG_RE.lastIndex = 0;
  let match;
  while ((match = INPUT_TAG_RE.exec(html)) !== null) {
    const attrs = parseAttrs(match[1]);
    const inputType = (attrs.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'image'].includes(inputType)) continue;
    if (attrsHaveAccessibleName(attrs)) continue;
    violations.push({
      type: 'missing-aria',
      severity: 'critical',
      line: lineAt(html, match.index),
      element: 'input',
      detail: `<input> without accessible name (no aria-label, title, or placeholder)`,
    });
  }

  INTERACTIVE_CONTAINER_RE.lastIndex = 0;
  while ((match = INTERACTIVE_CONTAINER_RE.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttrs(match[2]);
    const innerText = match[3] !== undefined ? stripTags(match[3]) : '';

    if (tag === 'a' && !('href' in attrs)) continue;

    if (attrsHaveAccessibleName(attrs) || innerText !== '') continue;

    violations.push({
      type: 'missing-aria',
      severity: 'critical',
      line: lineAt(html, match.index),
      element: tag,
      detail: `<${tag}> without accessible name (no aria-label, text content, title, or placeholder)`,
    });
  }
  return violations;
}

export function checkHeadingOrder(html: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const headingRe = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings: { level: number; line: number; index: number }[] = [];
  headingRe.lastIndex = 0;
  let match;
  while ((match = headingRe.exec(html)) !== null) {
    const level = parseInt(match[1][1], 10);
    headings.push({ level, line: lineAt(html, match.index), index: match.index });
  }

  let h1Count = 0;
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.level === 1) {
      h1Count++;
      if (h1Count > 1) {
        violations.push({
          type: 'heading-order',
          severity: 'warning',
          line: h.line,
          detail: `Multiple <h1> found (${h1Count}); page should have a single <h1>`,
        });
      }
    }
    if (i > 0) {
      const prev = headings[i - 1];
      if (h.level > prev.level + 1) {
        violations.push({
          type: 'heading-order',
          severity: 'warning',
          line: h.line,
          detail: `Heading skips level: <h${prev.level}> followed by <h${h.level}> (should not skip levels)`,
        });
      }
    }
  }
  return violations;
}

export function checkFocusManagement(html: string): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const tabindexRe = /<(\w[\w-]*)\b([^>]*?)\btabindex\s*=\s*"([^"]*)"/gi;
  tabindexRe.lastIndex = 0;
  let match;
  while ((match = tabindexRe.exec(html)) !== null) {
    const value = parseInt(match[3].trim(), 10);
    if (!isNaN(value) && value > 0) {
      violations.push({
        type: 'focus-management',
        severity: 'warning',
        line: lineAt(html, match.index),
        element: match[1].toLowerCase(),
        detail: `tabindex="${value}" on <${match[1]}> — positive tabindex breaks natural tab order (use 0 or -1)`,
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

  const missingAltViolations = checkMissingAlt(html);
  const missingAriaViolations = checkMissingAria(html);
  const headingOrderViolations = checkHeadingOrder(html);
  const focusViolations = checkFocusManagement(html);

  const violations = [
    ...inlineViolations, ...eventViolations, ...tokenViolations,
    ...missingAltViolations, ...missingAriaViolations,
    ...headingOrderViolations, ...focusViolations,
  ];

  return {
    certified: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
    summary: {
      inlineStyleCount: inlineViolations.length,
      tokenOverrideCount: tokenViolations.length,
      eventHandlerCount: eventViolations.length,
      missingAltCount: missingAltViolations.length,
      missingAriaCount: missingAriaViolations.length,
      headingOrderCount: headingOrderViolations.length,
      focusManagementCount: focusViolations.length,
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
      missingAltCount: 0,
      missingAriaCount: 0,
      headingOrderCount: 0,
      focusManagementCount: 0,
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
  lines.push(`  Missing alt: ${summary.missingAltCount}`);
  lines.push(`  Missing aria: ${summary.missingAriaCount}`);
  lines.push(`  Heading order: ${summary.headingOrderCount}`);
  lines.push(`  Focus management: ${summary.focusManagementCount}`);
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

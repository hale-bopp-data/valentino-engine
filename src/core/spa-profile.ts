import type { VisualAuditViolation } from './visual-audit.js';

export const AUDIT_PROFILES = ['landing', 'spa', 'dashboard', 'chat', 'data-table', 'form'] as const;
export type AuditProfile = typeof AUDIT_PROFILES[number];

export interface ProfileConfig {
  label: string;
  rhythmRules: {
    heroFirst: boolean;
    surfaceMonotony: boolean;
    consecutiveRhythm: boolean;
    spacerBetweenSameSurface: boolean;
  };
  visualSelectors: string;
  visualChecks: string[];
}

const LANDING_CONFIG: ProfileConfig = {
  label: 'Landing / Editorial',
  rhythmRules: {
    heroFirst: true,
    surfaceMonotony: true,
    consecutiveRhythm: true,
    spacerBetweenSameSurface: true,
  },
  visualSelectors: 'section, [data-section-index], main > *, header, nav, footer, .container, .wrapper, article, aside',
  visualChecks: ['overflow', 'collision', 'contrast'],
};

const SPA_CONFIG: ProfileConfig = {
  label: 'SPA / App Operative',
  rhythmRules: {
    heroFirst: false,
    surfaceMonotony: false,
    consecutiveRhythm: false,
    spacerBetweenSameSurface: false,
  },
  visualSelectors: 'nav, aside, main, [role=navigation], [role=main], [role=complementary], [role=tabpanel], [role=toolbar], [role=tablist], [role=dialog], .sidebar, .panel, .workspace, .dashboard, form, header, footer, section, article',
  visualChecks: ['overflow', 'collision', 'contrast', 'sidebar-ratio', 'form-labels', 'tab-a11y', 'nav-landmark'],
};

const DASHBOARD_CONFIG: ProfileConfig = {
  label: 'Dashboard / Analytics',
  rhythmRules: {
    heroFirst: false,
    surfaceMonotony: false,
    consecutiveRhythm: false,
    spacerBetweenSameSurface: false,
  },
  visualSelectors: 'nav, aside, main, [role=navigation], [role=main], [role=complementary], [role=tabpanel], [role=toolbar], [role=grid], [role=table], .sidebar, .panel, .widget, .card, .dashboard, .workspace, table, form, header, footer, section',
  visualChecks: ['overflow', 'collision', 'contrast', 'sidebar-ratio', 'form-labels', 'nav-landmark'],
};

const CHAT_CONFIG: ProfileConfig = {
  label: 'Chat / Conversational',
  rhythmRules: {
    heroFirst: false,
    surfaceMonotony: false,
    consecutiveRhythm: false,
    spacerBetweenSameSurface: false,
  },
  visualSelectors: 'main, [role=log], [role=main], [aria-live], .messages, .message-list, .chat-messages, .conversation, .composer, .chat-input, form, header, footer, nav',
  visualChecks: ['overflow', 'collision', 'contrast', 'form-labels', 'nav-landmark', 'chat-layout'],
};

const DATA_TABLE_CONFIG: ProfileConfig = {
  label: 'Data Table / Grid',
  rhythmRules: {
    heroFirst: false,
    surfaceMonotony: false,
    consecutiveRhythm: false,
    spacerBetweenSameSurface: false,
  },
  visualSelectors: 'main, table, [role=table], [role=grid], thead, tbody, tr, [role=row], .table, .data-grid, .table-wrapper, nav, header, footer, aside',
  visualChecks: ['overflow', 'collision', 'contrast', 'nav-landmark', 'data-table-layout'],
};

const FORM_CONFIG: ProfileConfig = {
  label: 'Form / Data Entry',
  rhythmRules: {
    heroFirst: false,
    surfaceMonotony: false,
    consecutiveRhythm: false,
    spacerBetweenSameSurface: false,
  },
  visualSelectors: 'main, form, fieldset, [role=form], .form, .form-group, .field, label, input, select, textarea, button, header, footer, section',
  visualChecks: ['overflow', 'collision', 'contrast', 'form-labels', 'nav-landmark'],
};

const PROFILES: Record<AuditProfile, ProfileConfig> = {
  landing: LANDING_CONFIG,
  spa: SPA_CONFIG,
  dashboard: DASHBOARD_CONFIG,
  chat: CHAT_CONFIG,
  'data-table': DATA_TABLE_CONFIG,
  form: FORM_CONFIG,
};

export function getProfileConfig(profile: AuditProfile): ProfileConfig {
  return PROFILES[profile];
}

export function isValidProfile(value: string): value is AuditProfile {
  return (AUDIT_PROFILES as readonly string[]).includes(value);
}

export function buildSpaAuditScript(profile: AuditProfile): string {
  const config = PROFILES[profile];
  const checks = config.visualChecks;

  const sidebarCheck = checks.includes('sidebar-ratio') ? `
  document.querySelectorAll('aside, [role=complementary], .sidebar, nav:not(header nav)').forEach(el => {
    const rect = el.getBoundingClientRect();
    const ratio = rect.width / window.innerWidth;
    if (ratio > 0.35) {
      warnings.push({
        type: 'overflow',
        severity: 'warning',
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(' ')[0] : ''),
        message: 'Sidebar width ratio ' + (ratio * 100).toFixed(0) + '% exceeds 35% of viewport (' + Math.round(rect.width) + 'px / ' + window.innerWidth + 'px)',
      });
    }
  });` : '';

  const formLabelsCheck = checks.includes('form-labels') ? `
  const interactiveEls = document.querySelectorAll('input:not([type=hidden]), select, textarea, button, [role=button], [role=checkbox], [role=radio], [role=switch], [role=combobox]');
  let unlabeled = 0;
  interactiveEls.forEach(el => {
    const hasAriaLabel = el.getAttribute('aria-label');
    const hasAriaLabelledBy = el.getAttribute('aria-labelledby');
    const hasTitle = el.getAttribute('title');
    const hasPlaceholder = el.getAttribute('placeholder');
    const id = el.getAttribute('id');
    const hasAssociatedLabel = id ? document.querySelector('label[for="' + id + '"]') : false;
    const hasWrappingLabel = el.closest('label');
    const hasTextContent = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' ? el.textContent && el.textContent.trim().length > 0 : false;
    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasAssociatedLabel && !hasWrappingLabel && !hasTextContent) {
      unlabeled++;
      const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(' ')[0] : '');
      warnings.push({
        type: 'missing-element',
        severity: 'warning',
        selector: sel,
        message: 'Interactive element without accessible label: ' + sel + (hasPlaceholder ? ' (has placeholder but no label)' : ''),
      });
    }
  });
  meta.interactiveCount = interactiveEls.length;
  meta.unlabeledCount = unlabeled;` : '';

  const tabA11yCheck = checks.includes('tab-a11y') ? `
  document.querySelectorAll('[role=tablist]').forEach(tablist => {
    const tabs = tablist.querySelectorAll('[role=tab]');
    if (tabs.length === 0) {
      violations.push({
        type: 'missing-element',
        severity: 'error',
        selector: 'tablist',
        message: 'Element with role=tablist has no child elements with role=tab',
      });
    }
    tabs.forEach(tab => {
      const controls = tab.getAttribute('aria-controls');
      if (controls && !document.getElementById(controls)) {
        warnings.push({
          type: 'missing-element',
          severity: 'warning',
          selector: 'tab[aria-controls=' + controls + ']',
          message: 'Tab references aria-controls="' + controls + '" but no matching element found',
        });
      }
    });
  });` : '';

  const navLandmarkCheck = checks.includes('nav-landmark') ? `
  const navCount = document.querySelectorAll('nav, [role=navigation]').length;
  if (navCount === 0) {
    warnings.push({
      type: 'missing-element',
      severity: 'warning',
      selector: 'document',
      message: 'No navigation landmark found (nav or [role=navigation])',
    });
  }
  meta.navLandmarkCount = navCount;
  meta.mainLandmarkCount = document.querySelectorAll('main, [role=main]').length;` : '';

  const chatLayoutCheck = checks.includes('chat-layout') ? `
  const messageLists = document.querySelectorAll('[role=log], [aria-live], .messages, .message-list, .chat-messages, .conversation, [data-message-list]');
  meta.messageListCount = messageLists.length;
  if (messageLists.length === 0) {
    warnings.push({
      type: 'missing-element',
      severity: 'warning',
      selector: 'document',
      message: 'No scrollable message list found (expected [role=log], [aria-live], .messages, .message-list)',
    });
  }
  messageLists.forEach(list => {
    const ls = window.getComputedStyle(list);
    const canScrollY = ls.overflowY === 'auto' || ls.overflowY === 'scroll' || list.scrollHeight > list.clientHeight + 2;
    if (!canScrollY && list.scrollHeight > window.innerHeight) {
      warnings.push({
        type: 'overflow',
        severity: 'warning',
        selector: list.tagName.toLowerCase() + (list.className && typeof list.className === 'string' && list.className.trim() ? '.' + list.className.trim().split(' ')[0] : ''),
        message: 'Message list taller than viewport but not vertically scrollable (overflowY=' + ls.overflowY + ')',
      });
    }
  });
  const composers = document.querySelectorAll('form, [role=textbox], textarea, .composer, .chat-input, [data-composer]');
  meta.composerCount = composers.length;
  let composerPinned = false;
  composers.forEach(c => {
    const cs = window.getComputedStyle(c);
    const rect = c.getBoundingClientRect();
    const nearBottom = rect.bottom >= window.innerHeight - 12 && rect.bottom <= window.innerHeight + 12;
    if (cs.position === 'fixed' || cs.position === 'sticky' || nearBottom) composerPinned = true;
  });
  meta.composerPinned = composerPinned;
  if (composers.length > 0 && !composerPinned) {
    warnings.push({
      type: 'missing-element',
      severity: 'warning',
      selector: 'composer',
      message: 'Chat composer is not pinned to the bottom (no fixed/sticky position and not at viewport bottom)',
    });
  }
  const bubbles = document.querySelectorAll('.message, .bubble, .msg, [data-message], [role=listitem]');
  meta.bubbleCount = bubbles.length;
  bubbles.forEach(b => {
    const rect = b.getBoundingClientRect();
    if (b.scrollWidth > b.clientWidth + 2 || rect.right > window.innerWidth + 2) {
      warnings.push({
        type: 'overflow',
        severity: 'warning',
        selector: b.tagName.toLowerCase() + (b.className && typeof b.className === 'string' && b.className.trim() ? '.' + b.className.trim().split(' ')[0] : ''),
        message: 'Chat message bubble overflows horizontally (scrollWidth=' + b.scrollWidth + ', clientWidth=' + b.clientWidth + ')',
      });
    }
  });` : '';

  const dataTableLayoutCheck = checks.includes('data-table-layout') ? `
  const tables = document.querySelectorAll('table, [role=table], [role=grid]');
  meta.tableCount = tables.length;
  if (tables.length === 0) {
    warnings.push({
      type: 'missing-element',
      severity: 'warning',
      selector: 'document',
      message: 'No data table found (expected table, [role=table] or [role=grid])',
    });
  }
  let tableRows = 0;
  tables.forEach(table => {
    const sel = table.tagName.toLowerCase() + (table.id ? '#' + table.id : '') + (table.className && typeof table.className === 'string' && table.className.trim() ? '.' + table.className.trim().split(' ')[0] : '');
    const rows = table.querySelectorAll('tr, [role=row]');
    tableRows += rows.length;
    const headerCells = table.querySelectorAll('th, [role=columnheader]');
    let stickyHeader = false;
    const thead = table.querySelector('thead');
    if (thead && window.getComputedStyle(thead).position === 'sticky') stickyHeader = true;
    headerCells.forEach(th => {
      if (window.getComputedStyle(th).position === 'sticky') stickyHeader = true;
    });
    if (headerCells.length > 0 && rows.length > 10 && !stickyHeader) {
      warnings.push({
        type: 'missing-element',
        severity: 'warning',
        selector: sel,
        message: 'Data table with ' + rows.length + ' rows has no sticky header (thead/th position:sticky) - header scrolls out of view',
      });
    }
    if (table.scrollWidth > table.clientWidth + 2) {
      const parent = table.parentElement;
      const ps = parent ? window.getComputedStyle(parent) : null;
      const wrapped = !!ps && (ps.overflowX === 'auto' || ps.overflowX === 'scroll');
      if (!wrapped) {
        warnings.push({
          type: 'overflow',
          severity: 'warning',
          selector: sel,
          message: 'Wide data table not wrapped in a horizontally scrollable container (parent overflowX=' + (ps ? ps.overflowX : 'none') + ')',
        });
      }
    }
    if (rows.length > 1) {
      const sampleRow = rows[1] || rows[0];
      const rh = sampleRow.getBoundingClientRect().height;
      if (rh > 0 && rh < 18) {
        warnings.push({
          type: 'collision',
          severity: 'warning',
          selector: sel,
          message: 'Data table row height ' + Math.round(rh) + 'px is very cramped (<18px) - density risk',
        });
      }
    }
  });
  meta.tableRowCount = tableRows;` : '';

  return `
(threshold) => {
  const violations = [];
  const warnings = [];
  const meta = {};

  const sections = document.querySelectorAll('${config.visualSelectors}');
  sections.forEach((el, i) => {
    if (el.scrollWidth > el.clientWidth + 2) {
      violations.push({
        type: 'overflow',
        severity: 'error',
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(' ')[0] : ''),
        message: 'Horizontal overflow: scrollWidth=' + el.scrollWidth + ' > clientWidth=' + el.clientWidth,
      });
    }
  });

  const elements = Array.from(sections);
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i].getBoundingClientRect();
      const b = elements[j].getBoundingClientRect();
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 10 && overlapY > 10) {
        warnings.push({
          type: 'collision',
          severity: 'warning',
          message: 'Bounding box collision between element #' + i + ' and #' + j,
        });
      }
    }
  }

  if (document.documentElement.scrollWidth > window.innerWidth + 2) {
    violations.push({
      type: 'overflow',
      severity: 'error',
      selector: 'html',
      message: 'Page-level horizontal overflow: scrollWidth=' + document.documentElement.scrollWidth + ' > viewport=' + window.innerWidth,
    });
  }

  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  function contrastRatio(c1, c2) {
    const l1 = luminance(...c1), l2 = luminance(...c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function parseRgb(color) {
    const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
  }

  document.querySelectorAll('h1, h2, h3, h4, p, a, span, li, td, th, label, button').forEach(el => {
    const style = window.getComputedStyle(el);
    const fg = parseRgb(style.color);
    const bg = parseRgb(style.backgroundColor);
    if (fg && bg) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < threshold) {
        warnings.push({
          type: 'contrast',
          severity: 'warning',
          selector: el.tagName.toLowerCase(),
          message: 'Low contrast ' + ratio.toFixed(2) + ':1 (need >=' + threshold + ') on ' + el.tagName,
        });
      }
    }
  });
${sidebarCheck}${formLabelsCheck}${tabA11yCheck}${navLandmarkCheck}${chatLayoutCheck}${dataTableLayoutCheck}
  return { violations, warnings, elementCount: sections.length, meta };
}
`;
}

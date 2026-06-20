import type { VisualAuditViolation } from './visual-audit.js';

export type AuditProfile = 'landing' | 'spa' | 'dashboard';

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

const PROFILES: Record<AuditProfile, ProfileConfig> = {
  landing: LANDING_CONFIG,
  spa: SPA_CONFIG,
  dashboard: DASHBOARD_CONFIG,
};

export function getProfileConfig(profile: AuditProfile): ProfileConfig {
  return PROFILES[profile];
}

export function isValidProfile(value: string): value is AuditProfile {
  return value === 'landing' || value === 'spa' || value === 'dashboard';
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
${sidebarCheck}${formLabelsCheck}${tabA11yCheck}${navLandmarkCheck}
  return { violations, warnings, elementCount: sections.length, meta };
}
`;
}

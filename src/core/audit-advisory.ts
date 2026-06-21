import type { AuditProfile } from './spa-profile.js';
import type { VisualAuditViolation } from './visual-audit.js';

/**
 * Advisory layer — turns raw visual-audit findings into an adaptive, prioritized
 * "what to do" list (Valentino's "invisible hand": guides, does not just judge).
 */

export interface ProfileSignals {
  grids: number;
  appShell: number;
  sections: number;
  hero: number;
}

/** Pure heuristic: pick the most fitting profile from DOM signal counts. */
export function chooseProfile(s: ProfileSignals): AuditProfile {
  if (s.grids >= 2) return 'dashboard';
  if (s.appShell >= 2 && s.sections < 2) return 'spa';
  return 'landing';
}

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface Recommendation {
  priority: RecommendationPriority;
  category: string;
  count: number;
  action: string;
  examples: string[];
}

export interface AuditAdvisory {
  detectedProfile?: AuditProfile;
  errorCount: number;
  warningCount: number;
  recommendations: Recommendation[];
  summary: string;
}

type Findings = {
  violations: VisualAuditViolation[];
  warnings: VisualAuditViolation[];
};

function examplesOf(items: VisualAuditViolation[], limit = 3): string[] {
  return items.slice(0, limit).map(v => v.message + (v.selector ? ` (${v.selector})` : ''));
}

/**
 * Group raw findings into a small, prioritized, actionable set of recommendations.
 * Noise that is layout-by-design on app/dashboard pages (collisions, wide panels)
 * is demoted to low priority instead of drowning the real issues.
 */
export function buildAdvisory(result: Findings, detectedProfile?: AuditProfile): AuditAdvisory {
  const errors = result.violations ?? [];
  const warnings = result.warnings ?? [];
  const recs: Recommendation[] = [];

  const overflowErr = errors.filter(v => v.type === 'overflow');
  if (overflowErr.length > 0) {
    recs.push({
      priority: 'high',
      category: 'overflow',
      count: overflowErr.length,
      action: 'Elimina l\'overflow orizzontale: max-width/overflow-x sul contenitore e min-width:0 sui figli flex/grid.',
      examples: examplesOf(overflowErr),
    });
  }

  const structErr = errors.filter(v => v.type === 'missing-element');
  if (structErr.length > 0) {
    recs.push({
      priority: 'high',
      category: 'structure',
      count: structErr.length,
      action: 'Correggi gli elementi strutturali mancanti o rotti (es. tablist senza tab, sezioni attese assenti).',
      examples: examplesOf(structErr),
    });
  }

  const labelW = warnings.filter(v => v.type === 'missing-element' && /label/i.test(v.message));
  if (labelW.length > 0) {
    recs.push({
      priority: 'high',
      category: 'a11y-label',
      count: labelW.length,
      action: `Aggiungi aria-label o <label for> ai ${labelW.length} controlli interattivi senza etichetta accessibile.`,
      examples: examplesOf(labelW),
    });
  }

  const landmarkW = warnings.filter(v => v.type === 'missing-element' && /landmark|navigation/i.test(v.message));
  if (landmarkW.length > 0) {
    recs.push({
      priority: 'medium',
      category: 'landmark',
      count: landmarkW.length,
      action: 'Aggiungi i landmark mancanti (nav / main / role appropriati) per la navigazione assistiva.',
      examples: examplesOf(landmarkW),
    });
  }

  const contrastW = warnings.filter(v => v.type === 'contrast');
  if (contrastW.length > 0) {
    recs.push({
      priority: 'medium',
      category: 'contrast',
      count: contrastW.length,
      action: `Porta il contrasto a >=4.5:1 su ${contrastW.length} elementi (usa un token testo forte o rivedi foreground/background).`,
      examples: examplesOf(contrastW),
    });
  }

  const widthW = warnings.filter(v => v.type === 'overflow');
  if (widthW.length > 0) {
    recs.push({
      priority: 'low',
      category: 'layout-width',
      count: widthW.length,
      action: 'Verifica le larghezze di sidebar/pannelli larghi: su dashboard sono spesso volute, controlla solo se rompono il layout.',
      examples: examplesOf(widthW),
    });
  }

  const collisionW = warnings.filter(v => v.type === 'collision');
  if (collisionW.length > 0) {
    recs.push({
      priority: 'low',
      category: 'collision',
      count: collisionW.length,
      action: `${collisionW.length} collisioni di bounding-box: su layout a griglia/flex sono spesso by-design — controlla solo se c'e' un glitch visivo reale.`,
      examples: examplesOf(collisionW),
    });
  }

  const order: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);

  const high = recs.filter(r => r.priority === 'high').length;
  const med = recs.filter(r => r.priority === 'medium').length;
  const low = recs.filter(r => r.priority === 'low').length;

  return {
    detectedProfile,
    errorCount: errors.length,
    warningCount: warnings.length,
    recommendations: recs,
    summary: `Cosa fare: ${errors.length} errori critici, ${recs.length} azioni consigliate (${high} alta, ${med} media, ${low} bassa).`,
  };
}

export function formatAdvisory(advisory: AuditAdvisory): string {
  const lines: string[] = [];
  lines.push('COSA FARE (mano invisibile — guida, non solo giudica):');
  if (advisory.detectedProfile) {
    lines.push(`  profilo auto-rilevato: ${advisory.detectedProfile}`);
  }
  lines.push(`  ${advisory.summary}`);
  for (const r of advisory.recommendations) {
    lines.push(`  [${r.priority.toUpperCase()}] ${r.category} x${r.count} -> ${r.action}`);
    for (const ex of r.examples) {
      lines.push(`      es. ${ex}`);
    }
  }
  return lines.join('\n');
}

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { auditHtml } from '../../core/audit-html.js';
import { certifySecurity, certifySecurityCss } from '../../core/certify-security.js';
import { validatePageSpec } from '../../core/page-spec.js';
import { probeRhythm } from '../../core/rhythm.js';
import { probeHeroContract } from '../../core/hero-contract.js';
import { probeSectionIntegrity } from '../../core/section-integrity.js';
import { isValidProfile } from '../../core/spa-profile.js';
import type { AuditProfile } from '../../core/spa-profile.js';
import { runAuditDom, runMultiViewportAuditDom } from '../../core/audit-dom.js';
import { runVisualAudit } from '../../core/visual-audit.js';
import { createJsonOutput, printJson } from '../../core/json-output.js';
import type { JsonSection } from '../../core/json-output.js';
import type { HeroSection, PageSpecV1 } from '../../core/types.js';

function walkDir(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(current); } catch { continue; }
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const full = join(current, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { stack.push(full); }
      else if (st.isFile() && exts.includes(extname(entry).toLowerCase())) { results.push(full); }
    }
  }
  return results.sort();
}

function staticAuditForFile(file: string, profile: AuditProfile) {
  const sections: JsonSection[] = [];
  let allPassed = true;
  const ext = extname(file).toLowerCase();
  const rel = relative(process.cwd(), file);
  const content = readFileSync(file, 'utf-8');

  if (ext === '.html' || ext === '.htm') {
    const result = auditHtml(content);
    sections.push({ name: `audit-html (${rel})`, status: result.valid ? 'pass' : 'fail', violations: result.violations, warnings: [] });
    if (!result.valid) allPassed = false;
  }

  if (ext === '.html' || ext === '.htm') {
    const cert = certifySecurity(content);
    const critical = cert.violations.filter((v: any) => v.severity === 'critical');
    const warns = cert.violations.filter((v: any) => v.severity === 'warning');
    sections.push({ name: `certify (${rel})`, status: cert.certified ? (warns.length > 0 ? 'warn' : 'pass') : 'fail', violations: critical, warnings: warns });
    if (!cert.certified) allPassed = false;
  } else if (ext === '.css') {
    const cert = certifySecurityCss(content);
    const critical = cert.violations.filter((v: any) => v.severity === 'critical');
    const warns = cert.violations.filter((v: any) => v.severity === 'warning');
    sections.push({ name: `certify (${rel})`, status: cert.certified ? (warns.length > 0 ? 'warn' : 'pass') : 'fail', violations: critical, warnings: warns });
    if (!cert.certified) allPassed = false;
  }

  if (ext === '.json') {
    let spec: PageSpecV1;
    try { spec = JSON.parse(content); } catch { return { sections, passed: allPassed }; }
    if (!validatePageSpec(spec)) return { sections, passed: allPassed };
    const rhythm = probeRhythm(spec, { profile });
    sections.push({ name: `probe/rhythm (${rel})`, status: rhythm.valid ? 'pass' : 'fail', violations: rhythm.warnings, warnings: [] });
    if (!rhythm.valid) allPassed = false;
    const heroes = spec.sections.filter((s): s is HeroSection => s.type === 'hero');
    for (const hero of heroes) {
      const hr = probeHeroContract(hero);
      sections.push({ name: `probe/hero (${hero.titleKey})`, status: hr.valid ? 'pass' : 'fail', violations: hr.warnings, warnings: [] });
      if (!hr.valid) allPassed = false;
    }
    const integ = probeSectionIntegrity(spec.sections);
    sections.push({ name: `probe/integrity (${rel})`, status: integ.valid ? 'pass' : 'fail', violations: integ.warnings, warnings: [] });
    if (!integ.valid) allPassed = false;
  }

  return { sections, passed: allPassed };
}

export async function runFullAudit(args: string[]): Promise<void> {
  const url = args.find(a => /^https?:\/\//i.test(a));
  const json = args.includes('--json');
  const dirIdx = args.indexOf('--dir');
  const dirArg = dirIdx >= 0 && args[dirIdx + 1] ? args[dirIdx + 1] : undefined;
  const respFlag = args.includes('--responsive');
  const getFlagValue = (name: string): string | undefined => {
    const eq = args.find(a => a.startsWith(name + '='));
    if (eq) return eq.slice(name.length + 1);
    const i = args.indexOf(name);
    if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('-')) return args[i + 1];
    return undefined;
  };
  const profileArg = getFlagValue('--profile');
  const profile: AuditProfile = profileArg && isValidProfile(profileArg) ? profileArg : 'landing';

  const allSections: JsonSection[] = [];
  let allPassed = true;

  if (dirArg) {
    const htmlCssFiles = walkDir(dirArg, ['.html', '.htm', '.css']);
    const jsonFiles = walkDir(dirArg, ['.json']);
    const allFiles = [...htmlCssFiles, ...jsonFiles];
    if (allFiles.length === 0) { console.error('No HTML/CSS/JSON files found in ' + dirArg); process.exit(1); }
    for (const f of allFiles) {
      const { sections, passed } = staticAuditForFile(f, profile);
      allSections.push(...sections);
      if (!passed) allPassed = false;
    }
  }

  const file = !dirArg && !url ? args.filter(a => !a.startsWith('-') && a !== '--json' && a !== '--responsive').find(a => /\.(html?|css|json)$/i.test(a)) : undefined;
  if (file && !dirArg && !url) {
    const { sections, passed } = staticAuditForFile(file, profile);
    allSections.push(...sections);
    if (!passed) allPassed = false;
  }

  if (url) {
    try {
      if (respFlag) {
        const result = await runMultiViewportAuditDom(url, {});
        for (const vp of result.viewports) {
          const errors = vp.violations.filter((v: any) => v.severity === 'error');
          const warnings = vp.violations.filter((v: any) => v.severity === 'warning');
          allSections.push({ name: `audit-dom (${vp.viewport?.width}x${vp.viewport?.height})`, status: vp.passed ? (warnings.length > 0 ? 'warn' : 'pass') : 'fail', violations: errors, warnings });
          if (!vp.passed) allPassed = false;
        }
      } else {
        const result = await runAuditDom(url, {});
        const errors = result.violations.filter((v: any) => v.severity === 'error');
        const warnings = result.violations.filter((v: any) => v.severity === 'warning');
        allSections.push({ name: 'audit-dom', status: result.passed ? (warnings.length > 0 ? 'warn' : 'pass') : 'fail', violations: errors, warnings });
        if (!result.passed) allPassed = false;
      }
    } catch (err) {
      allSections.push({ name: 'audit-dom', status: 'fail', violations: [{ message: 'Error: ' + (err instanceof Error ? err.message : String(err)) }], warnings: [] });
      allPassed = false;
    }
    try {
      const vaResult = await runVisualAudit(url, { profile });
      const vaPassed = vaResult.phase === 'complete' && vaResult.violations.length === 0;
      allSections.push({ name: 'visual-audit', status: vaPassed ? 'pass' : 'fail', violations: vaResult.violations, warnings: vaResult.warnings || [] });
      if (!vaPassed) allPassed = false;
    } catch (err) {
      allSections.push({ name: 'visual-audit', status: 'fail', violations: [{ message: 'Error: ' + (err instanceof Error ? err.message : String(err)) }], warnings: [] });
      allPassed = false;
    }
  }

  if (!file && !dirArg && !url) {
    console.error('Usage: valentino full-audit <url> [--responsive] [--json] [--profile <name>]');
    console.error('       valentino full-audit --dir <directory> [--json] [--profile <name>]');
    console.error('       valentino full-audit <file.html|file.css|file.json> [--json]');
    process.exit(1);
  }

  if (json) {
    printJson(createJsonOutput({ tool: 'full-audit', file: file || dirArg || url, passed: allPassed, exitCode: allPassed ? 0 : 1, sections: allSections, summary: allPassed ? 'full-audit PASS' : 'full-audit FAIL' }));
    if (!allPassed) process.exit(1);
    return;
  }

  console.log('\nValentino Full Audit\n');
  for (const sec of allSections) {
    const icon = sec.status === 'fail' ? 'FAIL' : sec.status === 'warn' ? 'WARN' : sec.status === 'skip' ? 'SKIP' : 'PASS';
    console.log('  [' + icon + '] ' + sec.name);
    for (const v of [...sec.violations, ...sec.warnings]) {
      const detail = typeof v === 'object' && v !== null ? ((v as Record<string, unknown>).message || JSON.stringify(v)) : String(v);
      console.log('     - ' + detail);
    }
  }
  if (!allPassed) process.exit(1);
}

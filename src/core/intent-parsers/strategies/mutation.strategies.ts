import type { ParsedIntent, IntentMatcherStrategy } from '../types.js';
import type { PageSpecV1 } from '../../types.js';
import { hasWord, resolveSectionType, parseIndex } from '../utils.js';
import { buildMinimalSection } from '../section-builder.js';

export class AddSectionStrategy implements IntentMatcherStrategy {
    match(input: string, spec: PageSpecV1): ParsedIntent | null {
        if (!hasWord(input, 'aggiung', 'add', 'inserisc', 'insert', 'mett', 'put')) return null;

        const words = input.toLowerCase().split(/\s+/);
        let sectionType: string | null = null;
        for (const word of words) {
            const resolved = resolveSectionType(word);
            if (resolved) { sectionType = resolved; break; }
        }
        if (!sectionType) {
            for (let i = 0; i < words.length - 1; i++) {
                const combo = `${words[i]}-${words[i + 1]}`;
                const resolved = resolveSectionType(combo);
                if (resolved) { sectionType = resolved; break; }
            }
        }
        if (!sectionType) return null;

        let atIndex: number | undefined;
        const posMatch = input.match(/(?:posizione|position|alla|al|at|in)\s+(\d+|inizio|fine|start|end)/i);
        if (posMatch) {
            const posRaw = posMatch[1].toLowerCase();
            if (posRaw === 'fine' || posRaw === 'end') atIndex = undefined;
            else if (posRaw === 'inizio' || posRaw === 'start') atIndex = 0;
            else {
                const parsed = parseIndex(posRaw, spec.sections.length);
                if (parsed !== null) atIndex = parsed;
            }
        }

        const section = buildMinimalSection(sectionType);
        return {
            action: { action: 'add-section', section, atIndex },
            confidence: 'medium',
            description: `Add ${sectionType} section${atIndex != null ? ` at position ${atIndex}` : ''}`,
        };
    }
}

export class RemoveSectionStrategy implements IntentMatcherStrategy {
    match(input: string, spec: PageSpecV1): ParsedIntent | null {
        if (!hasWord(input, 'rimuov', 'remove', 'elimin', 'delete', 'togl')) return null;

        const idxMatch = input.match(/(?:sezion\w*|section)\s*#?\s*(\d+|prima|primo|second[oa]|terz[oa]|quart[oa]|quint[oa]|ultim[oa]|first|second|third|fourth|fifth|last)/i);
        if (idxMatch) {
            const idx = parseIndex(idxMatch[1], spec.sections.length);
            if (idx !== null && idx >= 0 && idx < spec.sections.length) {
                return {
                    action: { action: 'remove-section', sectionIndex: idx },
                    confidence: 'high',
                    description: `Remove section #${idx} (${spec.sections[idx].type})`,
                };
            }
        }

        const words = input.toLowerCase().split(/\s+/);
        for (let i = words.length - 1; i >= 0; i--) {
            const resolved = resolveSectionType(words[i]);
            if (resolved) {
                const idx = spec.sections.findIndex(s => s.type === resolved);
                if (idx !== -1) {
                    return {
                        action: { action: 'remove-section', sectionIndex: idx },
                        confidence: 'medium',
                        description: `Remove first ${resolved} section (#${idx})`,
                    };
                }
            }
        }
        return null;
    }
}

export class MoveSectionStrategy implements IntentMatcherStrategy {
    match(input: string, spec: PageSpecV1): ParsedIntent | null {
        const match = input.match(/\b(?:sposta\w*|move|muovi\w*)\b.*\b(?:sezion[ie]|section)\b\s*#?(\d+|prima|primo|second[oa]|terz[oa]|ultim[oa]|first|second|third|last).*?(?:posizione?\s*|position\s*|a\s+|to\s+)#?(\d+|prima|primo|second[oa]|terz[oa]|ultim[oa]|inizio|fine|first|last|start|end)/i);
        if (match) {
            const from = parseIndex(match[1], spec.sections.length);
            let to: number | null;
            const toRaw = match[2].toLowerCase();
            if (toRaw === 'inizio' || toRaw === 'start') to = 0;
            else if (toRaw === 'fine' || toRaw === 'end') to = spec.sections.length - 1;
            else to = parseIndex(match[2], spec.sections.length);

            if (from !== null && to !== null && from >= 0 && to >= 0) {
                return {
                    action: { action: 'move-section', fromIndex: from, toIndex: to },
                    confidence: 'medium',
                    description: `Move section from #${from} to #${to}`,
                };
            }
        }
        return null;
    }
}

export class EditSectionStrategy implements IntentMatcherStrategy {
    match(input: string, spec: PageSpecV1): ParsedIntent | null {
        const match = input.match(/\b(?:cambia\w*|change|modifica\w*|edit|aggiorna\w*|update|sett?a|set)\b.*?\b(?:(?:il|la|lo|the|l['']?)\s+)?(\w+)\b.*?\b(?:dell['']?|del|della|of\s+the|of)\s*([\w\s-]+?)(?:\s+(?:in|to|con|a|=)\s+(.+))?$/i);
        if (match) {
            const fieldRaw = match[1].toLowerCase();
            const targetRaw = match[2].trim();
            const value = match[3]?.trim();

            const sectionType = resolveSectionType(targetRaw);
            if (!sectionType || !value) return null;

            const idx = spec.sections.findIndex(s => s.type === sectionType);
            if (idx === -1) return null;

            const fieldMap: Record<string, string> = {
                'titolo': 'titleKey', 'title': 'titleKey',
                'sottotitolo': 'subtitleKey', 'subtitle': 'subtitleKey',
                'tagline': 'taglineKey',
                'descrizione': 'descKey', 'description': 'descKey',
                'superficie': 'presentation.surface', 'surface': 'presentation.surface',
                'tono': 'presentation.tone', 'tone': 'presentation.tone',
            };
            const field = fieldMap[fieldRaw] || fieldRaw;

            return {
                action: { action: 'edit-section', sectionIndex: idx, patch: { [field]: value } },
                confidence: 'medium',
                description: `Edit ${sectionType} section: set ${field} = "${value}"`,
            };
        }
        return null;
    }
}

export class EditPageStrategy implements IntentMatcherStrategy {
    match(input: string, _spec: PageSpecV1): ParsedIntent | null {
        const match = input.match(/\b(?:cambia\w*|change|sett?a|set)\b.*?\b(?:profilo|profile)\b.*?\b(?:pagina|page)\b.*?(?:in|to|=)\s+(.+)$/i);
        if (match) {
            return {
                action: { action: 'edit-page', patch: { profile: match[1].trim() as any } },
                confidence: 'medium',
                description: `Set page profile to "${match[1].trim()}"`,
            };
        }

        const titleMatch = input.match(/\b(?:cambia\w*|change|sett?a|set)\b.*?\b(?:titolo|title)\b.*?\b(?:pagina|page)\b.*?(?:in|to|=)\s+(.+)$/i);
        if (titleMatch) {
            return {
                action: { action: 'edit-page', patch: { titleKey: titleMatch[1].trim() } },
                confidence: 'medium',
                description: `Set page title to "${titleMatch[1].trim()}"`,
            };
        }
        return null;
    }
}

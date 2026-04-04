import { COCKPIT_SECTION_TYPES } from '../cockpit-api.js';

const SECTION_ALIASES: Record<string, string> = {
    // IT
    'eroe': 'hero', 'intestazione': 'hero', 'banner': 'hero',
    'carte': 'cards', 'schede': 'cards', 'card': 'cards',
    'confronto': 'comparison', 'comparazione': 'comparison',
    'azione': 'cta', 'chiamata': 'cta',
    'modulo': 'form', 'formulario': 'form',
    'manifesto': 'manifesto',
    'spaziatore': 'spacer', 'spazio': 'spacer',
    'statistiche': 'stats', 'numeri': 'stats', 'metriche': 'stats',
    'come funziona': 'how-it-works', 'passi': 'how-it-works', 'fasi': 'how-it-works',
    'consulente': 'advisor', 'consigliere': 'advisor',
    'diagramma': 'mermaid-diagram', 'grafico': 'mermaid-diagram',
    'lista dati': 'data-list', 'tabella': 'data-list',
    'azione form': 'action-form',
    'catalogo': 'valentino-catalog',
    // EN passthrough
    'hero': 'hero', 'cards': 'cards', 'comparison': 'comparison',
    'cta': 'cta', 'form': 'form', 'spacer': 'spacer',
    'stats': 'stats', 'how-it-works': 'how-it-works', 'advisor': 'advisor',
    'mermaid-diagram': 'mermaid-diagram', 'data-list': 'data-list',
    'action-form': 'action-form', 'valentino-catalog': 'valentino-catalog',
    'showcase-intro': 'showcase-intro', 'component-showcase': 'component-showcase',
    'agent-dashboard': 'agent-dashboard', 'agent-graph': 'agent-graph',
    'agent-list': 'agent-list', 'mermaid': 'mermaid-diagram',
};

export function resolveSectionType(raw: string): string | null {
    const normalized = raw.toLowerCase().trim();
    if (COCKPIT_SECTION_TYPES.includes(normalized)) return normalized;
    return SECTION_ALIASES[normalized] || null;
}

const WORD_NUMBERS: Record<string, number> = {
    'prima': 0, 'primo': 0, 'first': 0,
    'seconda': 1, 'secondo': 1, 'second': 1,
    'terza': 2, 'terzo': 2, 'third': 2,
    'quarta': 3, 'quarto': 3, 'fourth': 3,
    'quinta': 4, 'quinto': 4, 'fifth': 4,
    'ultima': -1, 'ultimo': -1, 'last': -1,
    'penultima': -2, 'penultimo': -2,
};

export function parseIndex(raw: string, totalSections: number): number | null {
    const trimmed = raw.trim().toLowerCase();

    // Word numbers
    if (trimmed in WORD_NUMBERS) {
        const val = WORD_NUMBERS[trimmed];
        return val < 0 ? totalSections + val : val;
    }

    // Numeric (1-based in user language → 0-based)
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
        return num > 0 ? num - 1 : num;
    }

    return null;
}

/** Helper: check if input contains any of the given words (prefix-match for IT conjugation) */
export function hasWord(input: string, ...prefixes: string[]): boolean {
    const lower = input.toLowerCase();
    return prefixes.some(p => new RegExp(`\\b${p}\\w*\\b`, 'i').test(lower));
}

export function hasAny(input: string, ...words: string[]): boolean {
    const lower = input.toLowerCase();
    return words.some(w => lower.includes(w));
}

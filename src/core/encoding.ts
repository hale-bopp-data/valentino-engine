/**
 * Encoding Guardrail — Mojibake detection and typographic validation.
 * Pure functions: takes content strings, returns warnings.
 * No I/O — consumer loads the content files.
 * PBI #629.
 */

export type EncodingWarning = {
    type: 'mojibake' | 'typography';
    severity: 'error' | 'warning';
    file: string;
    key: string;
    message: string;
    match: string;
};

// --- Mojibake patterns (Latin-1 / Windows-1252 misinterpretation) ---

type MojibakePattern = { pattern: RegExp; label: string; fix?: string };

const MOJIBAKE_PATTERNS: MojibakePattern[] = [
    { pattern: /Ã¨/g, label: 'è (Latin-1→UTF-8)', fix: 'è' },
    { pattern: /Ã©/g, label: 'é (Latin-1→UTF-8)', fix: 'é' },
    { pattern: /Ã /g, label: 'à (Latin-1→UTF-8)', fix: 'à' },
    { pattern: /Ã¹/g, label: 'ù (Latin-1→UTF-8)', fix: 'ù' },
    { pattern: /Ã²/g, label: 'ò (Latin-1→UTF-8)', fix: 'ò' },
    { pattern: /Ã¬/g, label: 'ì (Latin-1→UTF-8)', fix: 'ì' },
    { pattern: /Ã¶/g, label: 'ö (Latin-1→UTF-8)', fix: 'ö' },
    { pattern: /Ã¼/g, label: 'ü (Latin-1→UTF-8)', fix: 'ü' },
    { pattern: /Ã¤/g, label: 'ä (Latin-1→UTF-8)', fix: 'ä' },
    { pattern: /Ã±/g, label: 'ñ (Latin-1→UTF-8)', fix: 'ñ' },
    { pattern: /Ã§/g, label: 'ç (Latin-1→UTF-8)', fix: 'ç' },
    { pattern: /â€™/g, label: 'right single quote (Win-1252)', fix: '\u2019' },
    { pattern: /â€œ/g, label: 'left double quote (Win-1252)', fix: '\u201C' },
    { pattern: /â€\u009D/g, label: 'right double quote (Win-1252)', fix: '\u201D' },
];

// --- Typographic rules by language ---

type TypoRule = { pattern: RegExp; lang: string; label: string; suggestion: string };

const TYPO_RULES: TypoRule[] = [
    // Italian
    { pattern: /\bE'\s/g, lang: 'it', label: "E' instead of È", suggestion: 'Use È (capital E with accent)' },
    { pattern: /\bperche'\b/gi, lang: 'it', label: "perche' instead of perché", suggestion: 'Use perché' },
    { pattern: /\bperche\b(?!')/gi, lang: 'it', label: "perche without accent", suggestion: 'Use perché' },
    { pattern: /\bpiu'\b/gi, lang: 'it', label: "piu' instead of più", suggestion: 'Use più' },
    { pattern: /\bcioe'\b/gi, lang: 'it', label: "cioe' instead of cioè", suggestion: 'Use cioè' },
    { pattern: /\bpuo'\b/gi, lang: 'it', label: "puo' instead of può", suggestion: 'Use può' },
    { pattern: /\bgiacche'\b/gi, lang: 'it', label: "giacche' instead of giacché", suggestion: 'Use giacché' },
    // General typography
    { pattern: /\.\.\./g, lang: '*', label: 'ASCII ellipsis', suggestion: 'Use … (U+2026)' },
    { pattern: /--/g, lang: '*', label: 'double hyphen', suggestion: 'Use — (em dash) or – (en dash)' },
    { pattern: /\s'/g, lang: '*', label: "space before apostrophe", suggestion: 'Remove space before apostrophe' },
    { pattern: /"([^"]*)"/g, lang: '*', label: 'straight double quotes', suggestion: 'Use \u201C\u201D (curly quotes)' },
    // French
    { pattern: /\b(\w+)\s*\?/g, lang: 'fr', label: 'missing space before ?', suggestion: 'French requires a space before ?' },
    { pattern: /\b(\w+)\s*!/g, lang: 'fr', label: 'missing space before !', suggestion: 'French requires a space before !' },
    // German
    { pattern: /\bfuer\b/gi, lang: 'de', label: 'fuer instead of für', suggestion: 'Use für' },
    { pattern: /\bueber\b/gi, lang: 'de', label: 'ueber instead of über', suggestion: 'Use über' },
    // Spanish
    { pattern: /\banio\b/gi, lang: 'es', label: 'anio instead of año', suggestion: 'Use año' },
];

/**
 * Detect mojibake in content strings.
 * Returns errors for each mojibake pattern found.
 */
export function checkMojibake(
    contentByFile: Map<string, Map<string, string>>,
): EncodingWarning[] {
    const warnings: EncodingWarning[] = [];

    for (const [file, entries] of contentByFile) {
        for (const [key, value] of entries) {
            for (const { pattern, label } of MOJIBAKE_PATTERNS) {
                // Reset lastIndex for global patterns
                pattern.lastIndex = 0;
                const match = pattern.exec(value);
                if (match) {
                    warnings.push({
                        type: 'mojibake',
                        severity: 'error',
                        file,
                        key,
                        message: `Mojibake detected: ${label}`,
                        match: match[0],
                    });
                }
            }
        }
    }

    return warnings;
}

/**
 * Check typographic issues in content strings.
 * Filters rules by language ('*' matches all).
 */
export function checkTypography(
    contentByFile: Map<string, Map<string, string>>,
    lang?: string,
): EncodingWarning[] {
    const warnings: EncodingWarning[] = [];
    const applicableRules = TYPO_RULES.filter((r) =>
        r.lang === '*' || (lang && r.lang === lang)
    );

    for (const [file, entries] of contentByFile) {
        for (const [key, value] of entries) {
            for (const rule of applicableRules) {
                rule.pattern.lastIndex = 0;
                const match = rule.pattern.exec(value);
                if (match) {
                    warnings.push({
                        type: 'typography',
                        severity: 'warning',
                        file,
                        key,
                        message: `${rule.label} — ${rule.suggestion}`,
                        match: match[0],
                    });
                }
            }
        }
    }

    return warnings;
}

/**
 * Run all encoding checks (mojibake + typography).
 */
export function checkEncoding(
    contentByFile: Map<string, Map<string, string>>,
    lang?: string,
): EncodingWarning[] {
    return [
        ...checkMojibake(contentByFile),
        ...checkTypography(contentByFile, lang),
    ];
}

/** Exported constants for consumer use. */
export const MOJIBAKE_PATTERN_COUNT = MOJIBAKE_PATTERNS.length;
export const TYPO_RULE_COUNT = TYPO_RULES.length;

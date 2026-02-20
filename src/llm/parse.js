/**
 * parse.js — JSON parse/repair utility
 * @module llm/parse
 *
 * LLM sometimes breaks JSON-only constraint. This module provides
 * a robust parser chain:
 *   1. JSON.parse(raw)
 *   2. Strip ```json code fences
 *   3. Extract first { ... last }
 *   4. Remove trailing commas
 */

/**
 * Attempt to safely parse a JSON string from LLM output.
 * @param {string} raw
 * @returns {{ ok: true, data: any } | { ok: false, raw: string, error: string }}
 */
export function safeParseJSON(raw) {
    if (!raw || typeof raw !== 'string') {
        return { ok: false, raw: raw || '', error: 'Empty or non-string input' };
    }

    // Attempt 1: direct parse
    try {
        return { ok: true, data: JSON.parse(raw) };
    } catch (_) { }

    // Attempt 2: strip code fences
    let cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

    try {
        return { ok: true, data: JSON.parse(cleaned) };
    } catch (_) { }

    // Attempt 3: extract first { ... last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);

        try {
            return { ok: true, data: JSON.parse(cleaned) };
        } catch (_) { }

        // Attempt 4: remove trailing commas before } or ]
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        try {
            return { ok: true, data: JSON.parse(cleaned) };
        } catch (e) {
            return { ok: false, raw, error: e.message };
        }
    }

    return { ok: false, raw, error: 'No JSON object found in response' };
}

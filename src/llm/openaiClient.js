/**
 * openaiClient.js — OpenAI API fetch wrapper
 * @module llm/openaiClient
 *
 * Reads API key and model from localStorage.
 * Provides chatCompletion() that returns the content string + usage info.
 */

const LS_KEY_API = 'ttg.openai.apiKey';
const LS_KEY_MODEL = 'ttg.openai.model';
const LS_KEY_TEMP = 'ttg.openai.temperature';

const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_TEMP = 1;

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Get current settings from localStorage.
 */
export function getSettings() {
    return {
        apiKey: localStorage.getItem(LS_KEY_API) || '',
        model: localStorage.getItem(LS_KEY_MODEL) || DEFAULT_MODEL,
        temperature: parseFloat(localStorage.getItem(LS_KEY_TEMP)) || DEFAULT_TEMP,
    };
}

/**
 * Save settings to localStorage.
 */
export function saveSettings({ apiKey, model, temperature }) {
    if (apiKey !== undefined) localStorage.setItem(LS_KEY_API, apiKey);
    if (model !== undefined) localStorage.setItem(LS_KEY_MODEL, model);
    if (temperature !== undefined) localStorage.setItem(LS_KEY_TEMP, String(temperature));
}

/**
 * Check if API key is configured.
 * @returns {boolean}
 */
export function hasApiKey() {
    return !!localStorage.getItem(LS_KEY_API);
}

/**
 * Call OpenAI Chat Completions API.
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {Object} [options]
 * @param {boolean} [options.jsonMode=false] — set response_format to json_object
 * @param {string}  [options.model] — override model
 * @param {number}  [options.temperature] — override temperature
 * @returns {Promise<{ok:boolean, content?:string, usage?:Object, error?:string}>}
 */
export async function chatCompletion(messages, options = {}) {
    const settings = getSettings();
    const apiKey = settings.apiKey;

    if (!apiKey) {
        return { ok: false, error: 'API Key가 설정되지 않았습니다. Settings에서 입력해주세요.' };
    }

    const temp = options.temperature ?? settings.temperature;
    const body = {
        model: options.model || settings.model,
        messages,
    };

    // Only include temperature when it's not the default (1).
    // Some models (e.g. gpt-5-mini, o-series) reject non-default temperature.
    if (temp !== 1) {
        body.temperature = temp;
    }

    if (options.jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    // Debug: log request
    console.group('%c[LLM Request]', 'color: #7aa2ff; font-weight: bold');
    console.log('Model:', body.model);
    console.log('Temperature:', body.temperature);
    console.log('JSON Mode:', !!options.jsonMode);
    console.log('Messages:', JSON.parse(JSON.stringify(messages)));
    console.groupEnd();

    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errBody = await res.text();
            let errMsg = `API Error (${res.status})`;
            try {
                const errJson = JSON.parse(errBody);
                errMsg = errJson.error?.message || errMsg;
            } catch (_) { }
            console.error('[LLM Error]', errMsg);
            return { ok: false, error: errMsg };
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const usage = data.usage || null;

        // Debug: log response
        console.group('%c[LLM Response]', 'color: #66ff99; font-weight: bold');
        console.log('Content:', content);
        if (usage) {
            console.log(`Tokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
        }
        console.groupEnd();

        return { ok: true, content, usage };
    } catch (err) {
        console.error('[LLM Network Error]', err);
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

/**
 * openaiClient.js — OpenAI API fetch wrapper
 * @module llm/openaiClient
 *
 * Reads API key and model from localStorage.
 * Provides chatCompletion() that returns the content string + usage info.
 */

const LS_KEY_PROV = 'ttg.llm.provider';

const LS_KEY_API_OPENAI = 'ttg.openai.apiKey';
const LS_KEY_MODEL_OPENAI = 'ttg.openai.model';

const LS_KEY_API_GEMINI = 'ttg.gemini.apiKey';
const LS_KEY_MODEL_GEMINI = 'ttg.gemini.model';

const LS_KEY_TEMP = 'ttg.openai.temperature';

const DEFAULT_PROV = 'gemini';
const DEFAULT_MODEL_OPENAI = 'gpt-5-mini';
const DEFAULT_MODEL_GEMINI = 'gemini-2.0-flash';
const DEFAULT_TEMP = 1;

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Get current settings from localStorage.
 */
export function getSettings() {
    return {
        provider: localStorage.getItem(LS_KEY_PROV) || DEFAULT_PROV,
        openaiApiKey: localStorage.getItem(LS_KEY_API_OPENAI) || '',
        openaiModel: localStorage.getItem(LS_KEY_MODEL_OPENAI) || DEFAULT_MODEL_OPENAI,
        geminiApiKey: localStorage.getItem(LS_KEY_API_GEMINI) || '',
        geminiModel: localStorage.getItem(LS_KEY_MODEL_GEMINI) || DEFAULT_MODEL_GEMINI,
        temperature: parseFloat(localStorage.getItem(LS_KEY_TEMP)) || DEFAULT_TEMP,
    };
}

/**
 * Save settings to localStorage.
 */
export function saveSettings({ provider, apiKey, model, temperature }) {
    if (provider !== undefined) localStorage.setItem(LS_KEY_PROV, provider);

    // Save to the currently selected provider's slots
    if (provider === 'gemini') {
        if (apiKey !== undefined) localStorage.setItem(LS_KEY_API_GEMINI, apiKey);
        if (model !== undefined) localStorage.setItem(LS_KEY_MODEL_GEMINI, model);
    } else {
        if (apiKey !== undefined) localStorage.setItem(LS_KEY_API_OPENAI, apiKey);
        if (model !== undefined) localStorage.setItem(LS_KEY_MODEL_OPENAI, model);
    }

    if (temperature !== undefined) localStorage.setItem(LS_KEY_TEMP, String(temperature));
}

/**
 * Check if API key is configured.
 * @returns {boolean}
 */
export function hasApiKey() {
    const settings = getSettings();
    if (settings.provider === 'gemini') return !!settings.geminiApiKey;
    return !!settings.openaiApiKey;
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
    const provider = settings.provider;
    const apiKey = provider === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey;

    if (!apiKey) {
        return { ok: false, error: `${provider} API Key가 설정되지 않았습니다. 설정에서 입력해주세요.` };
    }

    if (provider === 'gemini') {
        return await geminiChatCompletion(apiKey, settings, messages, options);
    } else {
        return await openaiChatCompletion(apiKey, settings, messages, options);
    }
}

async function openaiChatCompletion(apiKey, settings, messages, options) {

    const temp = options.temperature ?? settings.temperature;
    const body = {
        model: options.model || settings.openaiModel,
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
        console.error('[OpenAI Network Error]', err);
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

/**
 * Call Gemini API using fetch
 */
async function geminiChatCompletion(apiKey, settings, messages, options) {
    const model = options.model || settings.geminiModel;
    const temp = options.temperature ?? settings.temperature;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Map OpenAI messages to Gemini format
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction = { parts: [{ text: msg.content }] };
        } else {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    }

    const body = {
        contents,
        generationConfig: {
            temperature: temp,
        }
    };

    if (systemInstruction) {
        body.systemInstruction = systemInstruction;
    }

    if (options.jsonMode) {
        body.generationConfig.responseMimeType = "application/json";
    }

    console.group('%c[Gemini Request]', 'color: #ba7aff; font-weight: bold');
    console.log('Model:', model);
    console.log('Temperature:', temp);
    console.log('JSON Mode:', !!options.jsonMode);
    console.groupEnd();

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errBody = await res.text();
                // 429 is Rate Limit or Quota Exceeded
                if (res.status === 429 && attempts < maxAttempts) {
                    console.warn(`[Gemini Rate Limit] 429 received. Retrying in 4 seconds... (Attempt ${attempts}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, 4000));
                    continue; // Retry
                }

                let errMsg = `Gemini API Error (${res.status})`;
                try {
                    const errJson = JSON.parse(errBody);
                    errMsg = errJson.error?.message || errMsg;
                } catch (_) { }
                console.error('[Gemini Error]', errMsg);
                return { ok: false, error: errMsg };
            }

            const data = await res.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const usage = data.usageMetadata ? {
                prompt_tokens: data.usageMetadata.promptTokenCount,
                completion_tokens: data.usageMetadata.candidatesTokenCount,
                total_tokens: data.usageMetadata.totalTokenCount
            } : null;

            console.group('%c[Gemini Response]', 'color: #c98cff; font-weight: bold');
            console.log('Content:', content);
            if (usage) {
                console.log(`Tokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
            }
            console.groupEnd();

            return { ok: true, content, usage };
        } catch (err) {
            console.error('[Gemini Network Error]', err);
            // Non-deterministic networks errors could be retried too, but let's stick to returning for now
            return { ok: false, error: `Network error: ${err.message}` };
        }
    }
}

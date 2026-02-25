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
const DEFAULT_MODEL_OPENAI = 'gpt-4o-mini';
const DEFAULT_MODEL_GEMINI = 'gemini-2.5-flash-lite';

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
    };
}

/**
 * Save settings to localStorage.
 */
export function saveSettings({ provider, openaiApiKey, openaiModel, geminiApiKey, geminiModel }) {
    if (provider !== undefined) localStorage.setItem(LS_KEY_PROV, provider);
    if (openaiApiKey !== undefined) localStorage.setItem(LS_KEY_API_OPENAI, openaiApiKey);
    if (openaiModel !== undefined) localStorage.setItem(LS_KEY_MODEL_OPENAI, openaiModel);
    if (geminiApiKey !== undefined) localStorage.setItem(LS_KEY_API_GEMINI, geminiApiKey);
    if (geminiModel !== undefined) localStorage.setItem(LS_KEY_MODEL_GEMINI, geminiModel);
}

/**
 * Check if the application has at least one valid API key.
 * @returns {boolean}
 */
export function hasAnyApiKey() {
    const settings = getSettings();
    return !!(settings.openaiApiKey || settings.geminiApiKey);
}

/**
 * Call Chat Completions API.
 * 
 * Logic:
 * 1. If opts.model belongs to a provider with a key, use that.
 * 2. If not, check if the other provider has a key. If so, fallback to its default model.
 * 3. Both are missing, return error.
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {Object} [options]
 * @param {boolean} [options.jsonMode=false]
 * @param {string}  [options.model] 
 * @param {number}  [options.temperature]
 * @returns {Promise<{ok:boolean, content?:string, usage?:Object, error?:string}>}
 */
export async function chatCompletion(messages, options = {}) {
    const settings = getSettings();

    // 1. Determine target provider and model
    let targetProvider = settings.provider;
    let targetModel = options.model;

    if (!targetModel) {
        // No explicit model requested -> use current provider's default
        targetModel = (targetProvider === 'gemini') ? DEFAULT_MODEL_GEMINI : DEFAULT_MODEL_OPENAI;
    } else {
        // Explicit model requested -> detect provider from name
        targetProvider = targetModel.startsWith('gemini') ? 'gemini' : 'openai';
    }

    let apiKey = (targetProvider === 'gemini') ? settings.geminiApiKey : settings.openaiApiKey;

    // Fallback logic
    if (!apiKey) {
        if (targetProvider === 'gemini' && settings.openaiApiKey) {
            targetProvider = 'openai';
            targetModel = DEFAULT_MODEL_OPENAI;
            apiKey = settings.openaiApiKey;
            console.log(`[LLM Fallback] Gemini key missing. Falling back to OpenAI (${targetModel}).`);
        } else if (targetProvider === 'openai' && settings.geminiApiKey) {
            targetProvider = 'gemini';
            targetModel = DEFAULT_MODEL_GEMINI;
            apiKey = settings.geminiApiKey;
            console.log(`[LLM Fallback] OpenAI key missing. Falling back to Gemini (${targetModel}).`);
        } else {
            return { ok: false, error: "API Key가 설정되지 않았습니다. 설정이나 초기화면에서 입력해주세요." };
        }
    }

    const finalOptions = { ...options, model: targetModel };

    if (targetProvider === 'gemini') {
        return await geminiChatCompletion(apiKey, settings, messages, finalOptions);
    } else {
        return await openaiChatCompletion(apiKey, settings, messages, finalOptions);
    }
}

async function openaiChatCompletion(apiKey, settings, messages, options) {
    const temp = options.temperature ?? 1;
    const body = {
        model: options.model,
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

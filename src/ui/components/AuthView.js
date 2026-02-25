/**
 * AuthView.js — Initial landing screen to get API keys from the user.
 * @module ui/components/AuthView
 */

import { getBrandIconHtml } from './BrandIcon.js';
import { saveSettings, getSettings } from '../../llm/apiClient.js';
import { showToast } from './Toast.js';

/**
 * Render the Auth screen into a container.
 * @param {HTMLElement} container
 * @param {Function} onComplete — callback when user provides keys and proceeds.
 */
export function renderAuthView(container, onComplete) {
    const settings = getSettings();

    container.innerHTML = `
        <div class="auth-view" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; padding:20px; text-align:center;">
            <div class="auth-header" style="margin-bottom: 40px;">
                ${getBrandIconHtml({ size: 80, className: 'auth-logo' })}
                <h1 style="font-size: 32px; font-weight: 700; margin-top: 16px; color: var(--text-primary);">Narrive</h1>
                <p style="color: var(--text-secondary); opacity: 0.8;">상상하는 모든 이야기가 시작되는 곳</p>
            </div>

            <div class="auth-card" style="background: var(--bg-surface); padding: 32px; border-radius: 16px; border: 1px solid var(--border); width: 100%; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <h2 style="font-size: 18px; margin-bottom: 24px; color: var(--text-primary);">API 키 설정</h2>
                
                <div class="form-group" style="text-align: left; margin-bottom: 20px;">
                    <label class="label" for="auth-gemini-key">Gemini API Key</label>
                    <input class="input" type="password" id="auth-gemini-key" placeholder="Google Gemini 키 입력" value="${settings.geminiApiKey || ''}" />
                    <p style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);"><a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--accent);">키 발급받기 (무료 권장)</a></p>
                </div>

                <div class="form-group" style="text-align: left; margin-bottom: 32px;">
                    <label class="label" for="auth-openai-key">OpenAI API Key</label>
                    <input class="input" type="password" id="auth-openai-key" placeholder="OpenAI 키 입력" value="${settings.openaiApiKey || ''}" />
                </div>

                <button class="btn btn-primary" id="btn-auth-save" style="width: 100%; padding: 14px; font-size: 16px;">
                    시작하기
                </button>
                
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 16px; opacity: 0.6;">입력하신 키는 브라우저 로컬 저장소에만 안전하게 보관됩니다.</p>
            </div>
        </div>
    `;

    const btnSave = container.querySelector('#btn-auth-save');
    const geminiInput = container.querySelector('#auth-gemini-key');
    const openaiInput = container.querySelector('#auth-openai-key');

    btnSave.addEventListener('click', () => {
        const geminiApiKey = geminiInput.value.trim();
        const openaiApiKey = openaiInput.value.trim();

        if (!geminiApiKey && !openaiApiKey) {
            showToast('Gemini 또는 OpenAI 키 중 하나는 입력해야 합니다.', 'error');
            return;
        }

        // Save keys
        saveSettings({
            geminiApiKey,
            openaiApiKey,
            provider: geminiApiKey ? 'gemini' : 'openai' // Set initial provider
        });

        showToast('인증에 성공했습니다. 모험을 준비합니다.', 'success');

        // Brief delay for visual feedback
        setTimeout(onComplete, 800);
    });
}

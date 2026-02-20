/**
 * SetupWizard.js — 2-step synopsis creation wizard
 * @module ui/components/SetupWizard
 *
 * Step 1: User enters background text → calls Prompt #1 → gets dynamic form
 * Step 2: User fills form → calls Prompt #2 → gets synopsis/opening/theme
 */

import { callPrompt1, callPrompt2 } from '../../llm/prompts.js';
import { renderForm } from './FormRenderer.js';
import { showToast } from './Toast.js';

/**
 * Render the Setup Wizard in the story container.
 * @param {Object} params
 * @param {HTMLElement} params.container — #story-container
 * @param {Function} params.onComplete — ({ title, systemSynopsis, openingText, themeColor, accentColor }) => void
 * @param {Function} params.onCancel
 */
export function renderSetupWizard({ container, onComplete, onCancel }) {
    let userBackground = '';
    let formInstance = null;

    showStep1();

    function showStep1() {
        container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-wizard__step">
          <h2 class="setup-wizard__title">✦ 새로운 모험</h2>
          <p class="setup-wizard__subtitle">어떤 이야기를 만들고 싶으신가요? 간단한 배경을 알려주세요.</p>
        </div>

        <div class="form-group">
          <label class="label" for="setup-background">배경 설명</label>
          <textarea class="textarea" id="setup-background" rows="5"
                    placeholder="예: 마법이 사라진 세계에서 마지막 마법사가 되어 세계를 구하는 이야기"></textarea>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-secondary" id="setup-cancel">취소</button>
          <button class="btn btn-primary" id="setup-next">다음 →</button>
        </div>
      </div>
    `;

        container.querySelector('#setup-cancel').addEventListener('click', onCancel);
        container.querySelector('#setup-next').addEventListener('click', handleStep1Submit);
    }

    async function handleStep1Submit() {
        const textarea = container.querySelector('#setup-background');
        userBackground = textarea.value.trim();

        if (!userBackground) {
            showToast('배경 설명을 입력해주세요.', 'error');
            return;
        }

        showLoading('이야기를 분석하고 있습니다...');

        const result = await callPrompt1(userBackground);

        if (!result.ok) {
            showError(result.error || 'LLM 호출 실패', () => showStep1());
            return;
        }

        showStep2(result.data);
    }

    function showStep2(formSchema) {
        container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-wizard__step">
          <h2 class="setup-wizard__title">${escapeHTML(formSchema.title || '상세 설정')}</h2>
          <p class="setup-wizard__subtitle">이야기를 더 풍성하게 만들기 위해 몇 가지 질문에 답해주세요.</p>
        </div>

        <div id="dynamic-form"></div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-secondary" id="setup-back">← 뒤로</button>
          <button class="btn btn-primary" id="setup-generate">생성 ✦</button>
        </div>
      </div>
    `;

        const formContainer = container.querySelector('#dynamic-form');
        formInstance = renderForm(formContainer, formSchema.questions || []);

        container.querySelector('#setup-back').addEventListener('click', showStep1);
        container.querySelector('#setup-generate').addEventListener('click', handleStep2Submit);
    }

    async function handleStep2Submit() {
        if (!formInstance) return;

        const formValues = formInstance.getValues();
        showLoading('시놉시스를 생성하고 있습니다...');

        const result = await callPrompt2(userBackground, formValues);

        if (!result.ok) {
            showError(result.error || 'LLM 호출 실패', () => showStep2({}));
            return;
        }

        const data = result.data;
        onComplete({
            title: data.title || '새 모험',
            systemSynopsis: data.systemSynopsis || '',
            openingText: data.openingText || '',
            themeColor: data.themeColor || '#0f111a',
            accentColor: data.accentColor || '#7aa2ff',
        });
    }

    function showLoading(message) {
        container.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>${escapeHTML(message)}</span>
      </div>
    `;
    }

    function showError(message, onRetry) {
        container.innerHTML = `
      <div class="retry-banner" style="max-width: 480px; margin: 60px auto;">
        <div class="retry-banner__msg">${escapeHTML(message)}</div>
        <button class="btn btn-secondary" id="retry-btn">재시도</button>
      </div>
    `;
        container.querySelector('#retry-btn').addEventListener('click', onRetry);
    }
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

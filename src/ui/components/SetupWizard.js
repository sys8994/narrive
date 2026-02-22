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
import { getRandomSeeds } from '../../core/seedManager.js';

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
    showLoading('새로운 시드를 찾고 있습니다...');

    getRandomSeeds(3)
      .then(seeds => {
        renderSeedPicker(seeds);
      })
      .catch(err => {
        console.error(err);
        renderSeedPicker([]); // fallback
      });
  }

  function renderSeedPicker(seeds) {
    let seedHtml = '';
    if (seeds.length > 0) {
      seedHtml = `
                <div class="seed-list" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                    ${seeds.map(s => `
                        <div class="seed-card" data-hook="${escapeHTML(s.hook)}" style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: border-color 0.2s; background: var(--bg-panel);">
                            <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px; color: var(--accent);">${escapeHTML(s.title)} <span style="font-size: 11px; opacity: 0.7; font-weight: normal; margin-left: 8px; color: var(--text-muted);">${escapeHTML(s.tone)}</span></div>
                            <div style="font-size: 14px; margin-bottom: 12px; line-height: 1.5; color: var(--text-primary);">${escapeHTML(s.hook)}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">${s.tags.map(t => `#${escapeHTML(t)}`).join(' ')}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: center; margin-bottom: 24px;">
                    <button class="btn btn-ghost" id="setup-refresh-seeds" style="font-size: 13px;">⟳ 다른 추천 보기</button>
                    <button class="btn btn-ghost" id="setup-manual-toggle" style="font-size: 13px; margin-left: 12px;">✏ 직접 입력하기</button>
                </div>
            `;
    }

    container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-wizard__step">
          <h2 class="setup-wizard__title">✦ 새로운 모험</h2>
          <p class="setup-wizard__subtitle">원하는 시작 이야기를 선택하거나 직접 입력해주세요.</p>
        </div>

        ${seedHtml}

        <div id="manual-input-section" style="${seeds.length > 0 ? 'display: none;' : 'display: block;'}">
            <div class="form-group">
            <label class="label" for="setup-background">배경 설명 (직접 입력)</label>
            <textarea class="textarea" id="setup-background" rows="4"
                        placeholder="예: 마법이 사라진 세계에서 마지막 마법사가 되어 세계를 구하는 이야기"></textarea>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                <button class="btn btn-secondary" id="setup-cancel-manual">취소</button>
                <button class="btn btn-primary" id="setup-next-manual">다음 →</button>
            </div>
        </div>
        
        <div id="seed-footer" style="display: flex; gap: 10px; justify-content: flex-end; ${seeds.length > 0 ? 'display: flex;' : 'display: none;'}">
          <button class="btn btn-secondary" id="setup-cancel">메인으로</button>
        </div>
      </div>
    `;

    // Event Listeners for Seed Picker
    if (seeds.length > 0) {
      container.querySelectorAll('.seed-card').forEach(card => {
        card.addEventListener('click', () => {
          handleSeedSelect(card.dataset.hook);
        });
      });

      container.querySelector('#setup-refresh-seeds').addEventListener('click', () => {
        showStep1(); // Refetch seeds
      });

      container.querySelector('#setup-manual-toggle').addEventListener('click', () => {
        container.querySelector('.seed-list').style.display = 'none';
        container.querySelector('#setup-refresh-seeds').style.display = 'none';
        container.querySelector('#setup-manual-toggle').style.display = 'none';
        container.querySelector('#seed-footer').style.display = 'none';
        container.querySelector('#manual-input-section').style.display = 'block';
      });

      container.querySelector('#setup-cancel').addEventListener('click', onCancel);
    }

    // Event Listeners for Manual Input
    container.querySelector('#setup-cancel-manual').addEventListener('click', () => {
      if (seeds.length > 0) {
        renderSeedPicker(seeds); // Go back to seeds
      } else {
        onCancel();
      }
    });
    container.querySelector('#setup-next-manual').addEventListener('click', () => {
      const textarea = container.querySelector('#setup-background');
      handleSeedSelect(textarea.value.trim());
    });
  }

  async function handleSeedSelect(hookText) {
    userBackground = hookText;

    if (!userBackground) {
      showToast('배경 설명을 입력하거나 시드를 선택해주세요.', 'error');
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
      publicWorld: data.publicWorld || '',
      hiddenPlot: data.hiddenPlot || '',
      openingText: data.openingText || '',

      themeColor: data.themeColor || '#0f111a',
      accentColor: data.accentColor || '#7aa2ff',
      worldSchema: data.worldSchema || null,
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

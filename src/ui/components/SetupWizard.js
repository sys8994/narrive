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
import { loadingManager } from './LoadingManager.js';

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
  let currentSchema = null;
  let accumulatedValues = {};

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
                    ${seeds.map((s, index) => `
                        <div class="seed-card reveal-item" data-hook="${escapeHTML(s.hook)}" 
                             style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: border-color 0.2s; background: var(--bg-panel); animation-delay: ${index * 0.1}s;">
                            <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px; color: var(--accent);">${escapeHTML(s.title)} <span style="font-size: 11px; opacity: 0.7; font-weight: normal; margin-left: 8px; color: var(--text-muted);">${escapeHTML(s.tone)}</span></div>
                            <div style="font-size: 14px; margin-bottom: 12px; line-height: 1.5; color: var(--text-primary);">${escapeHTML(s.hook)}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">${s.tags.map(t => `#${escapeHTML(t)}`).join(' ')}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="reveal-item" style="text-align: center; margin-bottom: 24px; animation-delay: ${seeds.length * 0.1}s;">
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

    loadingManager.startLoading('p1_init', { theme: userBackground.slice(0, 15) });

    const result = await callPrompt1(userBackground);

    if (!result.ok) {
      loadingManager.stopLoading("심연을 들여다보는 데 실패했습니다.");
      showError(result.error || 'LLM 호출 실패', () => showStep1());
      return;
    }

    loadingManager.stopLoading("핵심 단서들을 포착했습니다.");
    currentSchema = result.data;
    accumulatedValues = {}; // Reset accumulation
    showStep2('vibe');
  }

  function showStep2(phase) {
    const isVibe = phase === 'vibe';
    const phaseTitle = isVibe ? (currentSchema.title || '분위기 설정') : '상황 설정';
    const phaseSubtitle = isVibe
      ? '세계관의 분위기와 감성적인 톤을 설정합니다.'
      : '주인공의 역할과 당면한 구체적인 상황을 설정합니다.';

    // Filter questions by category
    const filteredQuestions = (currentSchema.questions || []).filter(q => {
      if (isVibe) return q.category === 'vibe' || !q.category;
      return q.category === 'situation';
    });

    // If no questions for this phase, skip to next or finish
    if (filteredQuestions.length === 0) {
      if (isVibe) {
        showStep2('situation');
      } else {
        handleStep2Submit();
      }
      return;
    }

    container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-wizard__step">
          <div class="setup-wizard__badge">${isVibe ? 'STEP 2: VIBE' : 'STEP 3: SITUATION'}</div>
          <h2 class="setup-wizard__title">${escapeHTML(phaseTitle)}</h2>
          <p class="setup-wizard__subtitle">${escapeHTML(phaseSubtitle)}</p>
        </div>

        <div id="dynamic-form"></div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-secondary" id="setup-back">← 뒤로</button>
          <button class="btn btn-primary" id="setup-next">
            ${isVibe ? '다음 단계로 (상황 설정) →' : '스토리 생성 시작 ✦'}
          </button>
        </div>
      </div>
    `;

    const formContainer = container.querySelector('#dynamic-form');
    formInstance = renderForm(formContainer, filteredQuestions);

    container.querySelector('#setup-back').addEventListener('click', () => {
      if (isVibe) showStep1();
      else showStep2('vibe');
    });

    container.querySelector('#setup-next').addEventListener('click', () => {
      const stepValues = formInstance.getValues();
      Object.assign(accumulatedValues, stepValues);

      if (isVibe) {
        showStep2('situation');
      } else {
        handleStep2Submit();
      }
    });
  }

  async function handleStep2Submit() {
    // Collect Vibe and Situation context for dynamic loading text
    const vibeCtx = accumulatedValues.vibe || currentSchema.title || "미지의 모험";
    loadingManager.startLoading('p2_generate', { theme: vibeCtx });

    const result = await callPrompt2(userBackground, accumulatedValues);

    if (!result.ok) {
      loadingManager.stopLoading("운명의 실을 잇는 데 실패했습니다.");
      showError(result.error || 'LLM 호출 실패', () => showStep2('situation'));
      return;
    }

    loadingManager.stopLoading("당신만의 이야기가 완성되었습니다.");

    const data = result.data;
    onComplete({
      title: data.title || '새 모험',
      publicWorld: data.publicWorld || '',
      hiddenPlot: data.hiddenPlot || '',
      openingText: data.openingText || '',

      initialThemeColor: data.initialThemeColor || '#0f111a',
      climaxThemeColor: data.climaxThemeColor || '#000000',
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

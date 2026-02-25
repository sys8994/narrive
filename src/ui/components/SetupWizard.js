/**
 * SetupWizard.js — 2-step synopsis creation wizard
 * @module ui/components/SetupWizard
 *
 * Step 1: User chooses a seed or enters background text → calls Prompt #1 → gets dynamic form
 * Step 2: User fills form → calls Prompt #2 → gets synopsis/opening/theme
 */

import { callPrompt1, callPrompt2 } from '../../llm/prompts.js';
import { renderForm } from './FormRenderer.js';
import { showToast } from './Toast.js';
import { getRandomSeeds } from '../../core/seedManager.js';
import { loadingManager } from './LoadingManager.js';
import { getBrandIconHtml } from './BrandIcon.js';

/**
 * Render the Setup Wizard in the story container.
 */
export function renderSetupWizard({ container, onComplete, onCancel }) {
  let userBackground = '';
  let formInstance = null;
  let currentSchema = null;
  let accumulatedValues = {};

  // Pagination state
  let sessionSeeds = [];
  let seedCurrentPage = 0;
  const SEEDS_PER_PAGE = 5;

  showStep1();

  function showStep1() {
    showLoading('새로운 시드들을 탐색하는 중...');

    getRandomSeeds(100)
      .then(seeds => {
        sessionSeeds = seeds;
        seedCurrentPage = 0;
        renderSeedPicker();
      })
      .catch(err => {
        console.error(err);
        renderSeedPicker(); // fallback empty
      });
  }

  function renderSeedPicker() {
    container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-wizard__step">
          <h2 class="setup-wizard__title" style="display: flex; align-items: center; gap: 10px;">
            ${getBrandIconHtml({ size: 24, className: 'brand-logo--header' })}
            새로운 모험
          </h2>
          <p class="setup-wizard__subtitle">마음에 드는 이야기를 선택하거나 직접 입력해주세요.</p>
        </div>

        <div id="seed-picker-wrap">
            <div id="seed-list-container"></div>
            
            <div class="reveal-item" style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 24px; animation-delay: 0.4s;">
                <button class="btn btn-ghost" id="setup-prev-seeds" style="font-size: 16px;"><i class="fa-solid fa-chevron-left"></i></button>
                <span id="seed-page-indicator" style="font-size: 14px; font-weight: 600; color: var(--text-secondary); min-width: 60px; text-align: center;"></span>
                <button class="btn btn-ghost" id="setup-next-seeds" style="font-size: 16px;"><i class="fa-solid fa-chevron-right"></i></button>
            </div>

            <div class="reveal-item" style="text-align: center; margin-bottom: 32px; animation-delay: 0.5s;">
                <button class="btn btn-ghost" id="setup-manual-toggle" style="font-size: 16px;"><i class="fa-solid fa-pen-to-square" style="margin-right: 6px;"></i>직접 입력하기</button>
            </div>
        </div>

        <div id="manual-input-section" style="display: none;">
            <div class="form-group">
            <label class="label" for="setup-background">배경 설명 (직접 입력)</label>
            <textarea class="textarea" id="setup-background" rows="4"
                        placeholder="예: 마법이 사라진 세계에서 마지막 마법사가 되어 세계를 구하는 이야기"></textarea>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
                <button class="btn btn-secondary" id="setup-cancel-manual">취소</button>
                <button class="btn btn-primary" id="setup-next-manual">다음 <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i></button>
            </div>
        </div>
      </div>
    `;

    // Static event listeners
    container.querySelector('#setup-prev-seeds').addEventListener('click', () => {
      if (seedCurrentPage > 0) {
        seedCurrentPage--;
        updateSeeds();
      }
    });

    container.querySelector('#setup-next-seeds').addEventListener('click', () => {
      const totalPages = Math.ceil(sessionSeeds.length / SEEDS_PER_PAGE);
      if (seedCurrentPage < totalPages - 1) {
        seedCurrentPage++;
        updateSeeds();
      }
    });

    container.querySelector('#setup-manual-toggle').addEventListener('click', () => {
      container.querySelector('#seed-picker-wrap').style.display = 'none';
      container.querySelector('#manual-input-section').style.display = 'block';
    });

    container.querySelector('#setup-cancel-manual').addEventListener('click', () => {
      container.querySelector('#seed-picker-wrap').style.display = 'block';
      container.querySelector('#manual-input-section').style.display = 'none';
    });

    container.querySelector('#setup-next-manual').addEventListener('click', () => {
      const textarea = container.querySelector('#setup-background');
      handleSeedSelect(textarea.value.trim());
    });

    updateSeeds();
  }

  function updateSeeds() {
    const listContainer = container.querySelector('#seed-list-container');
    const pageIndicator = container.querySelector('#seed-page-indicator');
    const btnPrev = container.querySelector('#setup-prev-seeds');
    const btnNext = container.querySelector('#setup-next-seeds');

    const totalPages = Math.ceil(sessionSeeds.length / SEEDS_PER_PAGE);
    if (totalPages === 0) return;

    const startIdx = seedCurrentPage * SEEDS_PER_PAGE;
    const currentSeeds = sessionSeeds.slice(startIdx, startIdx + SEEDS_PER_PAGE);

    // Update List with small reveal animation delay reset
    listContainer.innerHTML = `
        <div class="seed-list" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
            ${currentSeeds.map((s, index) => `
                <div class="seed-card reveal-item" data-hook="${escapeHTML(s.hook)}" 
                    style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); background: var(--bg-panel); animation-delay: ${index * 0.05}s;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px; color: var(--accent);">${escapeHTML(s.title)} <span style="font-size: 11px; opacity: 0.7; font-weight: normal; margin-left: 8px; color: var(--text-muted);">${escapeHTML(s.tone)}</span></div>
                    <div style="font-size: 14px; margin-bottom: 12px; line-height: 1.5; color: var(--text-primary);">${escapeHTML(s.hook)}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${s.tags.map(t => `#${escapeHTML(t)}`).join(' ')}</div>
                </div>
            `).join('')}
        </div>
    `;

    // Re-bind clicks
    listContainer.querySelectorAll('.seed-card').forEach(card => {
      card.addEventListener('click', () => {
        handleSeedSelect(card.dataset.hook);
      });
    });

    // Update Page Indicator
    pageIndicator.textContent = `${seedCurrentPage + 1} / ${totalPages}`;

    // Update Buttons
    btnPrev.disabled = seedCurrentPage === 0;
    btnPrev.style.opacity = seedCurrentPage === 0 ? '0.3' : '1';
    btnPrev.style.cursor = seedCurrentPage === 0 ? 'default' : 'pointer';

    btnNext.disabled = seedCurrentPage === totalPages - 1;
    btnNext.style.opacity = seedCurrentPage === totalPages - 1 ? '0.3' : '1';
    btnNext.style.cursor = seedCurrentPage === totalPages - 1 ? 'default' : 'pointer';
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
    accumulatedValues = {};
    showStep2('vibe');
  }

  function showStep2(phase) {
    const isVibe = phase === 'vibe';
    const phaseTitle = isVibe ? (currentSchema.title || '분위기 설정') : '상황 설정';
    const phaseSubtitle = isVibe
      ? '세계관의 분위기와 감성적인 톤을 설정합니다.'
      : '주인공의 역할과 당면한 구체적인 상황을 설정합니다.';

    const filteredQuestions = (currentSchema.questions || []).filter(q => {
      if (isVibe) return q.category === 'vibe' || !q.category;
      return q.category === 'situation';
    });

    if (filteredQuestions.length === 0) {
      if (isVibe) showStep2('situation');
      else handleStep2Submit();
      return;
    }

    container.innerHTML = `
      <div class="setup-wizard">
        <div class="setup-wizard__step">
          <h2 class="setup-wizard__title">${escapeHTML(phaseTitle)}</h2>
          <p class="setup-wizard__subtitle">${escapeHTML(phaseSubtitle)}</p>
        </div>
        <div id="dynamic-form"></div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-secondary" id="setup-back"><i class="fa-solid fa-arrow-left" style="margin-right: 6px;"></i>뒤로</button>
          <button class="btn btn-primary" id="setup-next">
            ${isVibe ? '다음 단계로 (상황 설정) <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i>' : `스토리 생성 시작 ${getBrandIconHtml({ size: 18, className: 'brand-logo--inline' })}`}
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
      if (isVibe) showStep2('situation');
      else handleStep2Submit();
    });
  }

  async function handleStep2Submit() {
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
      entryLabel: data.entryLabel || '모험을 시작합니다.',
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

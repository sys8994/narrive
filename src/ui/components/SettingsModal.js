/**
 * SettingsModal.js — Settings modal for API key, model, temperature
 * @module ui/components/SettingsModal
 */

import { getSettings, saveSettings } from '../../llm/apiClient.js';
import { showToast } from './Toast.js';

const MODELS = {
  openai: [
    { value: 'gpt-5-mini', label: 'GPT-5 Mini (추천)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (저렴)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (무료/빠름)' },
    { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
  ]
};

/**
 * Open the settings modal.
 * @param {HTMLElement} modalRoot
 * @param {Function} [onClose] — called after modal is closed
 */
export function openSettingsModal(modalRoot, onClose) {
  const settings = getSettings();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'settings-modal-overlay';

  function buildModelOptions(provider, selectedModel) {
    return MODELS[provider].map(
      (m) => `<option value="${m.value}" ${m.value === selectedModel ? 'selected' : ''}>${m.label}</option>`
    ).join('');
  }

  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal__title"><span><i class="fa-solid fa-gear"></i></span> 설정</h2>

      <div class="form-group">
        <label class="label" for="settings-provider">제공자 (Provider)</label>
        <select class="select" id="settings-provider">
          <option value="gemini" ${settings.provider === 'gemini' ? 'selected' : ''}>Google Gemini (무료 제공 지원)</option>
          <option value="openai" ${settings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
        </select>
      </div>

      <div class="form-group">
        <label class="label" id="label-apikey" for="settings-apikey">API Key</label>
        <input class="input" type="password" id="settings-apikey" 
               value="${settings.provider === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey}" placeholder="API 키를 입력하세요..." autocomplete="off" />
      </div>

      <div class="form-group">
        <label class="label" for="settings-model">모델</label>
        <select class="select" id="settings-model">${buildModelOptions(settings.provider, settings.provider === 'gemini' ? settings.geminiModel : settings.openaiModel)}</select>
      </div>

      <div class="form-group">
        <label class="label">Temperature</label>
        <div class="slider-wrap">
          <input class="slider" type="range" id="settings-temp" 
                 min="0" max="1.5" step="0.1" value="${settings.temperature}" />
          <span class="slider-value" id="settings-temp-value">${settings.temperature}</span>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn-secondary" id="settings-cancel">취소</button>
        <button class="btn btn-primary" id="settings-save">저장</button>
      </div>
    </div>
  `;

  modalRoot.appendChild(overlay);

  // Dynamic Provider switching
  const providerSelect = overlay.querySelector('#settings-provider');
  const apiKeyInput = overlay.querySelector('#settings-apikey');
  const modelSelect = overlay.querySelector('#settings-model');
  const labelApiKey = overlay.querySelector('#label-apikey');

  providerSelect.addEventListener('change', (e) => {
    const p = e.target.value;
    if (p === 'gemini') {
      labelApiKey.textContent = 'Gemini API Key';
      apiKeyInput.value = settings.geminiApiKey || '';
      modelSelect.innerHTML = buildModelOptions('gemini', settings.geminiModel);
    } else {
      labelApiKey.textContent = 'OpenAI API Key';
      apiKeyInput.value = settings.openaiApiKey || '';
      modelSelect.innerHTML = buildModelOptions('openai', settings.openaiModel);
    }
  });

  // Init labels on load
  providerSelect.dispatchEvent(new Event('change'));

  // Temperature live display
  const tempSlider = overlay.querySelector('#settings-temp');
  const tempDisplay = overlay.querySelector('#settings-temp-value');
  tempSlider.addEventListener('input', () => {
    tempDisplay.textContent = tempSlider.value;
  });

  // Close
  function close() {
    overlay.remove();
    if (onClose) onClose();
  }

  overlay.querySelector('#settings-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Close on Escape key
  function handleEsc(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handleEsc);
    }
  }
  document.addEventListener('keydown', handleEsc);

  // Save
  overlay.querySelector('#settings-save').addEventListener('click', () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const temperature = parseFloat(tempSlider.value);

    saveSettings({ provider, apiKey, model, temperature });
    showToast('설정이 저장되었습니다.', 'success');
    close();
  });
}

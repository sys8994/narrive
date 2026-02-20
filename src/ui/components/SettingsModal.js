/**
 * SettingsModal.js — Settings modal for API key, model, temperature
 * @module ui/components/SettingsModal
 */

import { getSettings, saveSettings } from '../../llm/openaiClient.js';
import { showToast } from './Toast.js';

const MODELS = [
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (추천)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (저렴)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
];

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

  const modelOptions = MODELS.map(
    (m) => `<option value="${m.value}" ${m.value === settings.model ? 'selected' : ''}>${m.label}</option>`
  ).join('');

  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal__title">⚙ 설정</h2>

      <div class="form-group">
        <label class="label" for="settings-apikey">OpenAI API Key</label>
        <input class="input" type="password" id="settings-apikey" 
               value="${settings.apiKey}" placeholder="sk-..." autocomplete="off" />
      </div>

      <div class="form-group">
        <label class="label" for="settings-model">모델</label>
        <select class="select" id="settings-model">${modelOptions}</select>
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

  // Save
  overlay.querySelector('#settings-save').addEventListener('click', () => {
    const apiKey = overlay.querySelector('#settings-apikey').value.trim();
    const model = overlay.querySelector('#settings-model').value;
    const temperature = parseFloat(tempSlider.value);

    saveSettings({ apiKey, model, temperature });
    showToast('설정이 저장되었습니다.', 'success');
    close();
  });
}

/**
 * SettingsModal.js — Settings modal for API key
 * @module ui/components/SettingsModal
 */

import { getSettings, saveSettings } from '../../llm/apiClient.js';
import { showToast } from './Toast.js';

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

  overlay.innerHTML = `
    <div class="modal">
      <h2 class="modal__title"><span><i class="fa-solid fa-gear"></i></span> 설정</h2>

      <div class="form-group">
        <label class="label" for="settings-provider">기본 제공자 (Default Provider)</label>
        <select class="select" id="settings-provider">
          <option value="gemini" ${settings.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
          <option value="openai" ${settings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
        </select>
      </div>

      <div class="form-group" style="border-top: 1px solid var(--border); padding-top: 20px; margin-top: 20px;">
        <label class="label" for="settings-gemini-key">Gemini API Key</label>
        <input class="input" type="password" id="settings-gemini-key" 
               value="${settings.geminiApiKey || ''}" placeholder="Gemini API 키" autocomplete="off" />
      </div>

      <div class="form-group">
        <label class="label" for="settings-gemini-model">Gemini Model</label>
        <select class="select" id="settings-gemini-model">
          <option value="gemini-2.5-flash-lite" ${settings.geminiModel === 'gemini-2.5-flash-lite' ? 'selected' : ''}>gemini-2.5-flash-lite (Default)</option>
          <option value="gemini-2.5-flash" ${settings.geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
          <option value="gemini-3-flash-preview" ${settings.geminiModel === 'gemini-3-flash-preview' ? 'selected' : ''}>gemini-3-flash-preview</option>
        </select>
      </div>

      <div class="form-group" style="border-top: 1px solid var(--border); padding-top: 20px; margin-top: 20px;">
        <label class="label" for="settings-openai-key">OpenAI API Key</label>
        <input class="input" type="password" id="settings-openai-key" 
               value="${settings.openaiApiKey || ''}" placeholder="OpenAI API 키" autocomplete="off" />
      </div>

      <div class="form-group">
        <label class="label" for="settings-openai-model">OpenAI Model</label>
        <select class="select" id="settings-openai-model">
          <option value="gpt-4o-mini" ${settings.openaiModel === 'gpt-4o-mini' ? 'selected' : ''}>gpt-4o-mini (Default)</option>
          <option value="gpt-4o" ${settings.openaiModel === 'gpt-4o' ? 'selected' : ''}>gpt-4o</option>
          <option value="o3-mini" ${settings.openaiModel === 'o3-mini' ? 'selected' : ''}>o3-mini (Reasoning)</option>
        </select>
      </div>

      <div class="modal__footer">
        <button class="btn btn-secondary" id="settings-cancel">취소</button>
        <button class="btn btn-primary" id="settings-save">저장</button>
      </div>
    </div>
  `;

  modalRoot.appendChild(overlay);

  // Inputs
  const providerSelect = overlay.querySelector('#settings-provider');
  const geminiInput = overlay.querySelector('#settings-gemini-key');
  const geminiModelSelect = overlay.querySelector('#settings-gemini-model');
  const openaiInput = overlay.querySelector('#settings-openai-key');
  const openaiModelSelect = overlay.querySelector('#settings-openai-model');

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
    const geminiApiKey = geminiInput.value.trim();
    const geminiModel = geminiModelSelect.value;
    const openaiApiKey = openaiInput.value.trim();
    const openaiModel = openaiModelSelect.value;

    saveSettings({ provider, geminiApiKey, geminiModel, openaiApiKey, openaiModel });
    showToast('설정이 저장되었습니다.', 'success');
    close();
  });
}

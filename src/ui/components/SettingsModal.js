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
        <label class="label" for="settings-openai-key">OpenAI API Key</label>
        <input class="input" type="password" id="settings-openai-key" 
               value="${settings.openaiApiKey || ''}" placeholder="OpenAI API 키" autocomplete="off" />
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
  const openaiInput = overlay.querySelector('#settings-openai-key');

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
    const openaiApiKey = openaiInput.value.trim();

    saveSettings({ provider, geminiApiKey, openaiApiKey });
    showToast('설정이 저장되었습니다.', 'success');
    close();
  });
}

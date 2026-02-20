/**
 * SaveList.js — Left sidebar: session list + "새 게임" button
 * @module ui/components/SaveList
 */

import { formatDate } from '../../core/time.js';
import { hasApiKey } from '../../llm/openaiClient.js';

/**
 * Render the save list UI.
 * @param {Object} params
 * @param {HTMLElement} params.headerEl — #savelist-header
 * @param {HTMLElement} params.bodyEl — #savelist-body
 * @param {Array} params.sessions — list of session metas
 * @param {string|null} params.activeSessionId
 * @param {Function} params.onNewGame
 * @param {Function} params.onLoadSession — (sessionId) => void
 * @param {Function} params.onDeleteSession — (sessionId) => void
 */
export function renderSaveList({ headerEl, bodyEl, sessions, activeSessionId, onNewGame, onLoadSession, onDeleteSession }) {
    // Header: new game button
    const apiKeySet = hasApiKey();
    headerEl.innerHTML = `
    <button class="btn btn-primary btn-block" id="btn-new-game" ${apiKeySet ? '' : 'disabled'}
            title="${apiKeySet ? '새 게임 시작' : 'API Key를 먼저 설정해주세요'}">
      ✦ 새 게임
    </button>
  `;

    headerEl.querySelector('#btn-new-game').addEventListener('click', () => {
        if (apiKeySet) onNewGame();
    });

    // Body: session cards
    if (sessions.length === 0) {
        bodyEl.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <div class="empty-state__icon">📖</div>
        <div class="empty-state__text">저장된 게임이 없습니다</div>
        <div class="empty-state__hint">새 게임을 시작해보세요</div>
      </div>
    `;
        return;
    }

    bodyEl.innerHTML = sessions.map((s) => `
    <div class="session-card ${s.id === activeSessionId ? 'session-card--active' : ''}" 
         data-session-id="${s.id}">
      <div class="session-card__title">${escapeHTML(s.title || '(제목 없음)')}</div>
      <div class="session-card__meta">
        <span>${formatDate(s.updatedAt)}</span>
        <button class="btn-ghost session-card__delete" data-delete-id="${s.id}" 
                title="삭제" aria-label="삭제">✕</button>
      </div>
    </div>
  `).join('');

    // Event delegation
    bodyEl.addEventListener('click', (e) => {
        // Delete button
        const deleteBtn = e.target.closest('[data-delete-id]');
        if (deleteBtn) {
            e.stopPropagation();
            const id = deleteBtn.dataset.deleteId;
            if (confirm('이 세션을 삭제하시겠습니까?')) {
                onDeleteSession(id);
            }
            return;
        }

        // Card click
        const card = e.target.closest('[data-session-id]');
        if (card) {
            onLoadSession(card.dataset.sessionId);
        }
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

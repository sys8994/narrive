/**
 * SaveList.js — Left sidebar: session list + "새 게임" button
 * @module ui/components/SaveList
 */

import { formatDate } from '../../core/time.js';
import { getBrandIconHtml } from './BrandIcon.js';
import { getSettings, hasAnyApiKey } from '../../llm/apiClient.js';

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
  const apiKeySet = hasAnyApiKey();
  headerEl.innerHTML = `
    <button class="btn btn-primary btn-block" id="btn-new-game" ${apiKeySet ? '' : 'disabled'}
            title="${apiKeySet ? '새 게임 시작' : 'API Key를 먼저 설정해주세요'}">
      ${getBrandIconHtml({ size: 18, className: 'brand-logo--inline' })}새 게임
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
    <div class="session-card tooltip ${s.id === activeSessionId ? 'session-card--active' : ''}" 
         data-session-id="${s.id}" data-tooltip="제목: ${escapeHTML(s.title || '(제목 없음)')}\n마지막 진행: ${formatDate(s.updatedAt)}">
      <div class="session-card__info">
        <div class="session-card__title">${escapeHTML(s.title || '(제목 없음)')}</div>
      </div>
      
      <div class="session-card__menu-wrap">
        <button class="icon-btn-small btn-session-menu" aria-label="메뉴"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        <div class="session-menu-dropdown">
           <button class="dropdown-item" disabled>공유 (준비중)</button>
           <button class="dropdown-item" disabled>공개 (준비중)</button>
           <button class="dropdown-item option-delete" data-delete-id="${s.id}">삭제</button>
        </div>
      </div>
    </div>
  `).join('');

  // Event delegation (using onclick to prevent duplicate listeners accumulating on refresh)
  bodyEl.onclick = (e) => {
    // Menu toggle wrap click intercepts everything
    const menuWrap = e.target.closest('.session-card__menu-wrap');
    if (menuWrap) {
      e.stopPropagation();
      const dropdown = menuWrap.querySelector('.session-menu-dropdown');

      // If clicking inside the dropdown, but not a button, do nothing
      if (e.target.closest('.session-menu-dropdown') && !e.target.closest('.dropdown-item')) {
        return;
      }

      // If clicking a dropdown item, let it pass through to the next if blocks
      if (!e.target.closest('.dropdown-item')) {
        // Toggle this menu
        const isOpening = !dropdown.classList.contains('session-menu-dropdown--open');

        // Close other open menus
        bodyEl.querySelectorAll('.session-menu-dropdown--open').forEach(el => {
          el.classList.remove('session-menu-dropdown--open');
        });

        if (isOpening) {
          dropdown.classList.add('session-menu-dropdown--open');
        }
        return;
      }
    }

    // Delete
    const deleteBtn = e.target.closest('.option-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.deleteId;
      onDeleteSession(id); // 경고 없이 바로 삭제
      return;
    }

    // Card click
    const card = e.target.closest('[data-session-id]');
    if (card) {
      onLoadSession(card.dataset.sessionId);
    }
  };
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

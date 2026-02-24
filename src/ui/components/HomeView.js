/**
 * HomeView.js — Application Landing / Lobby
 * @module ui/components/HomeView
 */

import { getBrandIconHtml } from './BrandIcon.js';

/**
 * Render the Home View into the container.
 * @param {Object} params
 * @param {HTMLElement} params.container
 * @param {Array} params.sessions — List of all sessions
 * @param {string|null} params.lastActiveId
 * @param {Function} params.onNewGame
 * @param {Function} params.onLoadSession
 * @param {Function} params.onDeleteSession
 */
export function renderHomeView({ container, sessions, lastActiveId, onNewGame, onLoadSession, onDeleteSession }) {
    const activeSession = lastActiveId ? sessions.find(s => s.id === lastActiveId) : null;
    const recentSessions = sessions.filter(s => s.id !== lastActiveId);

    container.innerHTML = `
        <div class="home-view">
            <header class="home-hero">
                <h1 class="home-hero__title" style="display: flex; align-items: center; justify-content: center; gap: 16px;">
                  ${getBrandIconHtml({ size: 64, className: 'brand-logo--hero' })}
                  Narrive
                </h1>
                <p class="home-hero__slogan">Your taste. Your world. Your unknown story.</p>
                
                <div class="home-hero__actions">
                    <button class="btn btn-primary btn-lg" id="home-new-game">
                        <i class="fa-solid fa-plus"></i> 새로운 모험 시작하기
                    </button>
                </div>
            </header>

            <div class="home-content">
                ${activeSession ? `
                    <section class="home-section">
                        <h2 class="home-section__title">현재 진행 중인 모험</h2>
                        <div class="home-grid">
                            ${renderSessionCard(activeSession, true)}
                        </div>
                    </section>
                ` : ''}

                ${recentSessions.length > 0 ? `
                    <section class="home-section">
                        <h2 class="home-section__title">최근 플레이한 모험</h2>
                        <div class="home-grid">
                            ${recentSessions.map(s => renderSessionCard(s, false)).join('')}
                        </div>
                    </section>
                ` : ''}

                ${sessions.length === 0 ? `
                    <div class="home-empty">
                        <p>아직 저장된 모험이 없습니다. 첫 번째 이야기를 시작해보세요!</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Event Listeners
    container.querySelector('#home-new-game').addEventListener('click', onNewGame);

    container.querySelectorAll('.home-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.home-card__delete')) return;
            onLoadSession(card.dataset.sessionId);
        });

        const deleteBtn = card.querySelector('.home-card__delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('이 모험을 삭제하시겠습니까?')) {
                    onDeleteSession(card.dataset.sessionId);
                }
            });
        }
    });
}

function renderSessionCard(session, isActive) {
    const date = new Date(session.updatedAt).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="home-card ${isActive ? 'home-card--active' : ''}" data-session-id="${session.id}">
            <div class="home-card__content">
                <div class="home-card__title">${escapeHTML(session.title)}</div>
                <div class="home-card__date">${date}</div>
            </div>
            <button class="home-card__delete tooltip" data-tooltip="삭제" aria-label="삭제">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Toast.js — Floating notification component
 * @module ui/components/Toast
 */

let containerEl = null;

/**
 * Initialize Toast with container element.
 * @param {HTMLElement} container — #toast-container
 */
export function initToast(container) {
    containerEl = container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [durationMs=3000]
 */
export function showToast(message, type = 'info', durationMs = 3000) {
    return;
    if (!containerEl) return;

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;

    containerEl.appendChild(el);

    setTimeout(() => {
        el.classList.add('toast-exit');
        el.addEventListener('animationend', () => el.remove());
    }, durationMs);
}

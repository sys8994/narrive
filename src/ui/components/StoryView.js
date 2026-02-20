/**
 * StoryView.js — Center panel: story text + option buttons
 * @module ui/components/StoryView
 *
 * Features:
 * - Shows previously selected option with badge when rolling back
 * - Inline loading: shows spinner in badge area of clicked option
 * - Free-text input option always appended at the end
 * - Streaming text reveal: words appear one-by-one with fade-in
 */

// ─── Configurable Timing ─────────────────────────────────────────
const STREAM_WORD_DELAY_MS = 20;   // delay between each word appearing
const STREAM_FADE_MS = 50;   // how long each word's fade-in takes
const STREAM_OPTION_DELAY_MS = 80; // delay before each option button appears

/**
 * Render the current story node in the center panel.
 * @param {Object} params
 * @param {HTMLElement} params.container — #story-container
 * @param {Object} params.session — current GameSessionBlob
 * @param {Function} params.onOptionSelect — (optionId, customText?) => void
 * @param {boolean} [params.skipStreaming=false] — if true, show text instantly
 */
export function renderStoryView({ container, session, onOptionSelect, skipStreaming = false }) {
  if (!session) {
    renderWelcome(container);
    return;
  }

  const node = session.nodesById[session.currentNodeId];
  if (!node) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__text">노드를 찾을 수 없습니다.</div></div>';
    return;
  }

  // Check if ending
  if (node.isEnding) {
    renderEnding(container, node, skipStreaming);
    return;
  }

  container.innerHTML = '';

  // Story text
  const textEl = document.createElement('div');
  textEl.className = 'story-text';
  container.appendChild(textEl);

  // Options container (created now, populated after streaming finishes)
  const optList = document.createElement('div');
  optList.className = 'options-list';

  // Streaming or instant
  if (skipStreaming) {
    textEl.textContent = node.text;
    buildOptions(optList, node, onOptionSelect, true);
    container.appendChild(optList);
    appendStateBar(container, session);
  } else {
    streamText(textEl, node.text, () => {
      buildOptions(optList, node, onOptionSelect, false);
      container.appendChild(optList);
      appendStateBar(container, session);
    });
  }
}

/**
 * Stream text word-by-word into an element with fade-in.
 */
function streamText(el, text, onDone) {
  const words = text.split(/(\s+)/); // keep whitespace tokens
  let i = 0;

  function next() {
    if (i >= words.length) {
      if (onDone) onDone();
      return;
    }

    const token = words[i++];

    // Whitespace tokens: just append as-is
    if (/^\s+$/.test(token)) {
      el.appendChild(document.createTextNode(token));
      // No delay for whitespace, process next immediately
      next();
      return;
    }

    const span = document.createElement('span');
    span.className = 'stream-word';
    span.style.setProperty('--stream-fade-ms', `${STREAM_FADE_MS}ms`);
    span.textContent = token;
    el.appendChild(span);

    setTimeout(next, STREAM_WORD_DELAY_MS);
  }

  next();
}

/**
 * Build and reveal option buttons, optionally with staggered animation.
 */
function buildOptions(optList, node, onOptionSelect, instant) {
  if (!node.options || node.options.length === 0) return;

  const buttons = [];

  node.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.optionId = opt.id;

    // Mark previously selected option
    const wasSelected = node.selectedOptionId === opt.id;
    if (wasSelected) {
      btn.classList.add('option-btn--was-selected');
    }

    // Option text
    const textSpan = document.createElement('span');
    textSpan.className = 'option-btn__text';
    textSpan.textContent = opt.text;
    btn.appendChild(textSpan);

    // Badge area (shows "이전 선택" or loading spinner)
    const badge = document.createElement('span');
    badge.className = 'option-btn__badge';
    if (wasSelected) {
      badge.textContent = '← 이전 선택';
    }
    btn.appendChild(badge);

    btn.addEventListener('click', () => {
      setOptionLoading(btn, optList);
      onOptionSelect(opt.id);
    });

    if (!instant) {
      btn.style.opacity = '0';
      btn.style.transform = 'translateY(8px)';
      btn.style.transition = `opacity ${STREAM_FADE_MS}ms ease, transform ${STREAM_FADE_MS}ms ease`;
    }

    optList.appendChild(btn);
    buttons.push(btn);
  });

  // Free-text input option at the end
  const freeTextRow = buildFreeTextInput(optList, onOptionSelect, instant);
  optList.appendChild(freeTextRow);

  // Stagger reveal
  if (!instant) {
    buttons.forEach((btn, idx) => {
      setTimeout(() => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
      }, idx * STREAM_OPTION_DELAY_MS);
    });

    // Reveal free-text after all option buttons
    setTimeout(() => {
      freeTextRow.style.opacity = '1';
      freeTextRow.style.transform = 'translateY(0)';
    }, buttons.length * STREAM_OPTION_DELAY_MS);
  }
}

/**
 * Build free-text input row.
 */
function buildFreeTextInput(optList, onOptionSelect, instant) {
  const freeTextRow = document.createElement('div');
  freeTextRow.className = 'option-freetext';

  if (!instant) {
    freeTextRow.style.opacity = '0';
    freeTextRow.style.transform = 'translateY(8px)';
    freeTextRow.style.transition = `opacity ${STREAM_FADE_MS}ms ease, transform ${STREAM_FADE_MS}ms ease`;
  }

  const freeInput = document.createElement('input');
  freeInput.type = 'text';
  freeInput.className = 'option-freetext__input';
  freeInput.placeholder = '직접 행동을 입력하세요...';

  const freeBtn = document.createElement('button');
  freeBtn.className = 'option-freetext__btn';
  freeBtn.textContent = '→';
  freeBtn.disabled = true;

  freeInput.addEventListener('input', () => {
    freeBtn.disabled = !freeInput.value.trim();
  });

  const submitFreeText = () => {
    const text = freeInput.value.trim();
    if (!text) return;
    freeInput.disabled = true;
    freeBtn.disabled = true;
    freeBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>';
    optList.querySelectorAll('.option-btn').forEach(b => { b.disabled = true; });
    onOptionSelect('__custom__', text);
  };

  freeBtn.addEventListener('click', submitFreeText);
  freeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && freeInput.value.trim()) submitFreeText();
  });

  freeTextRow.appendChild(freeInput);
  freeTextRow.appendChild(freeBtn);
  return freeTextRow;
}

/**
 * Set a specific option button to loading state:
 * show a small spinner in the badge area, disable all buttons.
 */
function setOptionLoading(activeBtn, optList) {
  // Disable all options
  optList.querySelectorAll('.option-btn').forEach((btn) => {
    btn.disabled = true;
  });
  // Disable free text
  const freeInput = optList.querySelector('.option-freetext__input');
  const freeBtn = optList.querySelector('.option-freetext__btn');
  if (freeInput) freeInput.disabled = true;
  if (freeBtn) freeBtn.disabled = true;

  // Show spinner in badge area of clicked button
  const badge = activeBtn.querySelector('.option-btn__badge');
  if (badge) {
    badge.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>';
  }
  activeBtn.classList.add('option-btn--loading');
}

/**
 * Append the state info bar if applicable.
 */
function appendStateBar(container, session) {
  const state = session.gameState;
  if (state.location || state.inventory.length > 0) {
    const stateBar = document.createElement('div');
    stateBar.style.cssText = 'margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted);';
    const parts = [];
    if (state.location) parts.push(`📍 ${state.location}`);
    if (state.inventory.length) parts.push(`🎒 ${state.inventory.join(', ')}`);
    parts.push(`Turn ${state.turnCount}`);
    stateBar.textContent = parts.join('  •  ');
    container.appendChild(stateBar);
  }
}

/**
 * Show error with retry.
 */
export function renderStoryError(container, message, onRetry) {
  // Remove any previous retry banners
  const existing = container.querySelector('.retry-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'retry-banner';
  banner.style.cssText = 'max-width: 480px; margin: 16px auto;';
  banner.innerHTML = `
        <div class="retry-banner__msg">${escapeHTML(message)}</div>
        <button class="btn btn-secondary" id="story-retry-btn">재시도</button>
    `;

  if (onRetry) {
    banner.querySelector('#story-retry-btn').addEventListener('click', () => {
      banner.remove();
      onRetry();
    });
  }

  container.appendChild(banner);

  // Remove loading state from any option buttons
  container.querySelectorAll('.option-btn--loading').forEach(btn => {
    btn.classList.remove('option-btn--loading');
    btn.disabled = false;
    const badge = btn.querySelector('.option-btn__badge');
    if (badge) badge.innerHTML = '';
  });
}

/**
 * Render the welcome / empty state.
 */
function renderWelcome(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">✦</div>
      <div class="empty-state__text" style="font-size: 20px; color: var(--text-primary);">Narrive</div>
      <div class="empty-state__hint" style="margin-top: 8px;">왼쪽에서 게임을 불러오거나 새 게임을 시작하세요</div>
    </div>
  `;
}

/**
 * Render the ending screen with optional streaming.
 */
function renderEnding(container, node, skipStreaming) {
  const endingType = (node.meta && node.meta.endingType) || 'neutral';
  const badgeClass = `ending-badge--${endingType}`;
  const badgeLabel = { good: 'GOOD ENDING', bad: 'BAD ENDING', neutral: 'ENDING' }[endingType] || 'ENDING';

  container.innerHTML = '';

  const endingDiv = document.createElement('div');
  endingDiv.className = 'ending-container';

  const badgeEl = document.createElement('div');
  badgeEl.className = `ending-badge ${badgeClass}`;
  badgeEl.textContent = badgeLabel;
  endingDiv.appendChild(badgeEl);

  const textEl = document.createElement('div');
  textEl.className = 'story-text';
  textEl.style.cssText = 'text-align: center; margin-top: 24px;';
  endingDiv.appendChild(textEl);

  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'margin-top: 32px; color: var(--text-muted); font-size: 13px;';
  hintEl.textContent = '트리에서 과거 선택지를 클릭하면 다른 경로를 탐험할 수 있습니다.';
  endingDiv.appendChild(hintEl);

  container.appendChild(endingDiv);

  if (skipStreaming) {
    textEl.textContent = node.text;
  } else {
    streamText(textEl, node.text, null);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

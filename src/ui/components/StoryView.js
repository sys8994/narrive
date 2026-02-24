/**
 * StoryView.js — Center panel: story text + option buttons
 * @module ui/components/StoryView
 *
 * Features:
 * - Cumulative rendering (turns append sequentially, older turns remain visible)
 * - Shows previously selected option with badge when rolling back
 * - Inline loading: shows spinner in badge area of clicked option
 * - Streaming text reveal: words appear one-by-one with fade-in
 */

import { getPathToRoot } from '../../core/treeEngine.js';
import { getBrandIconHtml } from './BrandIcon.js';

// ─── Configurable Timing ─────────────────────────────────────────
const STREAM_WORD_DELAY_MS = 35;   // delay between each word appearing
const STREAM_FADE_MS = 100;   // how long each word's fade-in takes
const STREAM_OPTION_DELAY_MS = 100; // delay before each option button appears
const STREAM_START_DELAY_MS = 400;  // delay before turn start
const STREAM_BREAK_DELAY_MS = 300;  // delay between parts (header -> text -> options)


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

  const activePath = getPathToRoot(session, session.currentNodeId);
  if (!activePath || activePath.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__text">노드를 찾을 수 없습니다.</div></div>';
    return;
  }

  // 0. Clean up empty states or welcoming screens dynamically
  Array.from(container.children).forEach(child => {
    if (!child.classList.contains('story-turn') &&
      !child.classList.contains('retry-banner') &&
      !child.classList.contains('ending-container') &&
      !child.classList.contains('state-bar') &&
      !child.classList.contains('scroll-spacer')) {
      child.remove();
    }
  });

  // 1. Remove turns that are NOT in the current active path (e.g. user rolled back)
  const existingTurns = Array.from(container.querySelectorAll('.story-turn'));
  let syncIndex = 0;

  for (let i = 0; i < existingTurns.length; i++) {
    const turnEl = existingTurns[i];
    const nodeId = turnEl.dataset.nodeId;

    if (activePath[i] === nodeId) {
      syncIndex = i + 1; // It matches. Keep it.

      // Keep past options visible, but update their selected state to match the current tree truth
      const node = session.nodesById[nodeId];
      if (node) {
        // Clear any leftover loading states
        turnEl.querySelectorAll('.option-btn').forEach(btn => {
          btn.disabled = false;
          btn.classList.remove('option-btn--loading');
        });

        // Re-apply 'was-selected' styling based on `node.selectedOptionId`
        turnEl.querySelectorAll('.option-btn').forEach(btn => {
          const badge = btn.querySelector('.option-btn__badge');
          if (btn.dataset.optionId === node.selectedOptionId) {
            btn.classList.add('option-btn--was-selected');
            if (badge) badge.textContent = '(Selected)';
          } else {
            btn.classList.remove('option-btn--was-selected');
            if (badge) badge.textContent = '';
          }
        });
      }
    } else {
      // Mismatch starting here. Remove this and all subsequent DOM elements.
      for (let j = i; j < existingTurns.length; j++) {
        existingTurns[j].remove();
      }
      break;
    }
  }

  // 2. Append new turns that are in the active path but not in the DOM
  for (let i = syncIndex; i < activePath.length; i++) {
    const nodeId = activePath[i];
    const node = session.nodesById[nodeId];
    if (!node) continue;

    const turnEl = document.createElement('div');
    turnEl.className = 'story-turn';
    turnEl.dataset.nodeId = nodeId;
    turnEl.style.cssText = 'margin-bottom: 48px;';

    // Add small subtle header
    const headerEl = document.createElement('div');
    headerEl.className = 'story-turn__header';
    headerEl.style.cssText = 'font-size: 16px; opacity: 0.5; margin-bottom: 12px; padding-top: 12px; font-weight: 500;';

    turnEl.appendChild(headerEl);

    // If it's an ending
    if (node.isEnding) {
      container.appendChild(turnEl);
      renderEnding(turnEl, node, skipStreaming);
      continue;
    }

    // Story text
    const textEl = document.createElement('div');
    textEl.className = 'story-text';
    turnEl.appendChild(textEl);

    container.appendChild(turnEl);

    const turnLabel = node.depth === 0 ? 'Intro' : `Page #${node.depth}`;
    const title = node.meta?.title || '진행';

    let showLocation = false;
    if (i === 0) {
      showLocation = true;
    } else {
      const prevNodeId = activePath[i - 1];
      const prevNode = session.nodesById[prevNodeId];
      const prevLoc = prevNode?.stateSnapshot?.location;
      const currLoc = node.stateSnapshot?.location;
      if (currLoc && currLoc !== prevLoc) {
        showLocation = true;
      }
    }
    const locationStr = (showLocation && node.stateSnapshot?.location) ? ` @ ${node.stateSnapshot.location}` : '';

    const isLastNode = (i === activePath.length - 1);
    const shouldStream = isLastNode && !skipStreaming;

    const headerText = `${turnLabel}. ${title}${locationStr}`;

    // --- Always attach options for all turns (past and current) ---
    if (shouldStream) {
      // For the last node with streaming: set spacer, scroll, and start sequence
      headerEl.textContent = ''; // Clear for streaming
      setScrollSpacer(container);

      setTimeout(() => {
        turnEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      // Systematic sequential reveal
      (async () => {
        await sleep(STREAM_START_DELAY_MS);

        await streamText(headerEl, headerText, null);
        await sleep(STREAM_BREAK_DELAY_MS);

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Update theme visuals based on current node tension
        updateThemeVisuals(session, node.stateSnapshot?.tensionLevel || 1);

        await streamText(textEl, node.text, session.worldSchema);
        await sleep(STREAM_BREAK_DELAY_MS);

        attachOptions(container, turnEl, node, session, onOptionSelect, false);
        shrinkScrollSpacer(container, turnEl);
      })();
    } else {
      // Instant render (past turns or skipStreaming)
      headerEl.textContent = headerText;
      textEl.innerHTML = formatStoryText(node.text, session.worldSchema);
      attachOptions(container, turnEl, node, session, onOptionSelect, true);

      if (isLastNode) {
        // Last node rendered instantly (e.g. session load): set spacer
        setScrollSpacer(container);
        // Final scroll and theme update for safety
        container.scrollTop = container.scrollHeight;
        const lastNode = session.nodesById[activePath[activePath.length - 1]];
        if (lastNode) {
          updateThemeVisuals(session, lastNode.stateSnapshot?.tensionLevel || 1);
        }
        setTimeout(() => {
          shrinkScrollSpacer(container, turnEl);
          turnEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }
}

/**
 * Set the scroll spacer to full viewport height.
 * Called once before scrollIntoView so the element can reach the top.
 */
function setScrollSpacer(container) {
  let spacer = container.querySelector('.scroll-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'scroll-spacer';
    spacer.style.cssText = 'pointer-events: none;';
    container.appendChild(spacer);
  }
  if (spacer.nextSibling) {
    container.appendChild(spacer);
  }
  const scrollParent = container.closest('.panel-center__content');
  if (scrollParent) {
    spacer.style.height = `${scrollParent.clientHeight}px`;
  }
}

/**
 * Shrink the spacer to exactly what's needed (viewport - lastTurnHeight).
 * Called once after content is fully rendered (text + options).
 */
function shrinkScrollSpacer(container, lastTurnEl) {
  const spacer = container.querySelector('.scroll-spacer');
  if (!spacer) return;
  const scrollParent = container.closest('.panel-center__content');
  if (!scrollParent) return;

  const viewportH = scrollParent.clientHeight;
  const turnH = lastTurnEl.getBoundingClientRect().height;
  const needed = Math.max(0, viewportH - turnH - 32);
  spacer.style.height = `${needed}px`;
}

function attachOptions(container, turnEl, node, session, onOptionSelect, instant) {
  const optList = document.createElement('div');
  optList.className = 'options-list';
  buildOptions(optList, node, onOptionSelect, instant);
  turnEl.appendChild(optList);
  // appendStateBar(turnEl, session);
}

function escapeRegExp(str) {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatStoryText(text, schema) {
  if (!text) return '';
  let html = escapeHTML(text);

  // Wrap dialogue (double quotes). Matches across standard quotes.
  html = html.replace(/"([^"]+)"/g, '<span class="story-dialogue">"$1"</span>');

  // Highlight Names
  if (schema) {
    const pcName = schema.protagonist?.name;
    if (pcName) {
      const re = new RegExp(escapeRegExp(pcName), 'g');
      html = html.replace(re, `<span class="highlight-pc">${pcName}</span>`);
    }
    if (schema.npcs) {
      schema.npcs.forEach(npc => {
        const name = npc.name;
        if (name) {
          const re = new RegExp(escapeRegExp(name), 'g');
          html = html.replace(re, `<span class="highlight-npc">${name}</span>`);
        }
      });
    }
  }
  return html;
}

function prepareStreaming(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  const streamSpans = [];

  textNodes.forEach(textNode => {
    const text = textNode.nodeValue;
    if (!text.trim()) {
      return;
    }
    const fragment = document.createDocumentFragment();
    const words = text.split(/(\s+)/);
    words.forEach(word => {
      if (/^\s+$/.test(word)) {
        fragment.appendChild(document.createTextNode(word));
      } else {
        const span = document.createElement('span');
        span.className = 'stream-word';
        span.style.setProperty('--stream-fade-ms', `${STREAM_FADE_MS}ms`);
        let processedWord = word;
        processedWord = processedWord.replace(/✦/g, '<i class="fa-solid fa-sparkles"></i>');
        processedWord = processedWord.replace(/→/g, '<i class="fa-solid fa-arrow-right"></i>');
        span.innerHTML = processedWord; // Use innerHTML for icons
        fragment.appendChild(span);
        streamSpans.push(span);
      }
    });
    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return streamSpans;
}

/**
 * Stream text word-by-word into an element with fade-in.
 * Preserves inner HTML.
 * Returns a Promise that resolves when streaming is complete.
 */
function streamText(el, text, schema, onDone) {
  return new Promise((resolve) => {
    el.innerHTML = formatStoryText(text, schema);
    const spans = prepareStreaming(el);
    let i = 0;

    function next() {
      if (i >= spans.length) {
        if (onDone) onDone();
        resolve();
        return;
      }
      spans[i].classList.add('revealed');
      i++;
      setTimeout(next, STREAM_WORD_DELAY_MS);
    }

    if (spans.length === 0) {
      if (onDone) onDone();
      resolve();
      return;
    }
    next();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Interpolate between two HEX colors.
 * factor: 0.0 (color1) to 1.0 (color2)
 */
function interpolateColor(color1, color2, factor) {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const c1 = hex1.length === 3 ? hex1.split('').map(x => x + x).join('') : hex1;
  const c2 = hex2.length === 3 ? hex2.split('').map(x => x + x).join('') : hex2;

  const result = c1.match(/.{2}/g).map((hex, i) => {
    const val1 = parseInt(hex, 16);
    const val2 = parseInt(c2.match(/.{2}/g)[i], 16);
    const interpolated = Math.round(val1 * (1 - factor) + val2 * factor);
    return interpolated.toString(16).padStart(2, '0');
  });
  return "#" + result.join('');
}

/**
 * Dynamically update the background color based on tensionLevel.
 */
function updateThemeVisuals(session, tensionLevel) {
  if (!session || !session.themeColor) return;

  const initialColor = session.themeColor.initialThemeColor || '#0f111a';
  const climaxColor = session.themeColor.climaxThemeColor || '#000000';

  // tensionLevel (1-10) -> factor (0.0-1.0)
  const validTension = Math.max(1, Math.min(10, tensionLevel || 1));
  const factor = (validTension - 1) / 9;

  const currentColor = interpolateColor(initialColor, climaxColor, factor);

  document.body.style.backgroundColor = currentColor;

  // New: Update global CSS variables for universal theme sync
  document.documentElement.style.setProperty('--bg-primary', currentColor);
  document.documentElement.style.setProperty('--bg-secondary', blendColor(currentColor, 0.08));
  document.documentElement.style.setProperty('--bg-panel', blendColor(currentColor, 0.06));
}

/**
 * Derive a brighter variant of a hex color for secondary surfaces.
 */
function blendColor(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + 255 * amount));
  const ng = Math.min(255, Math.round(g + 255 * amount));
  const nb = Math.min(255, Math.round(b + 255 * amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/**
 * Build and reveal option buttons, optionally with staggered animation.
 */
function buildOptions(optList, node, onOptionSelect, instant) {
  const buttons = [];
  let options = [...(node.options || [])];

  // Dynamic fallback for Intro node (Reuse synopsis for new stories)
  if (node.depth === 0) {
    if (!options.find(o => o.id === 'start')) {
      options.unshift({ id: 'start', text: '모험 시작' });
    }
    if (!options.find(o => o.id === 'new_start')) {
      options.push({ id: 'new_start', text: '새 모험 시작' });
    }
  }

  if (options.length === 0) return;

  options.forEach((opt) => {
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
      badge.textContent = '(Selected)';
    }
    btn.appendChild(badge);

    btn.addEventListener('click', () => {
      setOptionLoading(btn, optList);
      onOptionSelect(node.id, opt.id);
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
  // const freeTextRow = buildFreeTextInput(optList, onOptionSelect, instant);
  // optList.appendChild(freeTextRow);

  // Stagger reveal
  if (!instant) {
    buttons.forEach((btn, idx) => {
      setTimeout(() => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
      }, idx * STREAM_OPTION_DELAY_MS);
    });

    // Reveal free-text after all option buttons
    // setTimeout(() => {
    //   freeTextRow.style.opacity = '1';
    //   freeTextRow.style.transform = 'translateY(0)';
    // }, buttons.length * STREAM_OPTION_DELAY_MS);
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
  freeBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
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
  // Disable all options globally in the container so the user doesn't spam click other turns
  const container = optList.closest('.panel-center__content');
  if (container) {
    container.querySelectorAll('.option-btn').forEach((btn) => {
      btn.disabled = true;
    });
    // Disable free text everywhere
    container.querySelectorAll('.option-freetext__input, .option-freetext__btn').forEach(el => el.disabled = true);
  } else {
    // Fallback just in case
    optList.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
  }

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
    stateBar.className = 'state-bar';
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
      <div class="empty-state__icon">${getBrandIconHtml({ size: 64, className: 'brand-logo--hero' })}</div>
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

  // Map internal types to display labels and CSS classes
  const typeMap = {
    win: { label: 'VICTORY', cls: 'ending-badge--good' },
    lose: { label: 'GAME OVER', cls: 'ending-badge--bad' },
    good: { label: 'GOOD ENDING', cls: 'ending-badge--good' },
    bad: { label: 'BAD ENDING', cls: 'ending-badge--bad' },
    neutral: { label: 'ENDING', cls: 'ending-badge--neutral' }
  };

  const config = typeMap[endingType] || typeMap.neutral;
  const badgeClass = config.cls;
  const badgeLabel = config.label;


  const endingDiv = document.createElement('div');
  endingDiv.className = 'ending-container';
  endingDiv.style.cssText = 'padding: 32px 0; border-top: 1px dashed var(--border); margin-top: 16px;';

  const badgeEl = document.createElement('div');
  badgeEl.className = `ending-badge ${badgeClass}`;
  badgeEl.textContent = badgeLabel;
  endingDiv.appendChild(badgeEl);

  const textEl = document.createElement('div');
  textEl.className = 'story-text';
  textEl.style.cssText = 'text-align: left; margin-top: 12px; font-weight: 600; color: var(--text-primary);';
  endingDiv.appendChild(textEl);

  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'margin-top: 32px; color: var(--text-muted); font-size: 13px;';
  hintEl.textContent = '트리에서 과거 선택지를 클릭하면 다른 경로를 탐험할 수 있습니다.';
  endingDiv.appendChild(hintEl);

  container.appendChild(endingDiv);

  if (skipStreaming) {
    textEl.innerHTML = formatStoryText(node.text, null);
  } else {
    streamText(textEl, node.text, null, null);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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
import { getNarrativePhaseLabel, getNarrativePhaseKey } from '../../core/narrativeEngine.js';
import { addCustomOption, prefetchOption } from '../../core/gameEngine.js';

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

  const currentNode = session.nodesById[session.currentNodeId];
  // Removed top-level updateThemeVisuals here to let the loop handle it precisely

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
  let lastLocation = null;

  for (let i = 0; i < existingTurns.length; i++) {
    const turnEl = existingTurns[i];
    const nodeId = turnEl.dataset.nodeId;
    const node = session.nodesById[nodeId];

    if (activePath[i] === nodeId) {
      syncIndex = i + 1; // It matches. Keep it.

      // Keep past options visible, but update their selected state to match the current tree truth
      if (node) {
        lastLocation = node.stateSnapshot?.location;
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
            if (badge) badge.textContent = '';
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
    turnEl.style.cssText = 'margin-bottom: 32px;';

    // Add small subtle header
    const headerEl = document.createElement('div');
    headerEl.className = 'story-turn__header';
    headerEl.style.cssText = 'font-size: 16px; opacity: 0.5; margin-bottom: 12px; padding-top: 12px; font-weight: 500; display: flex; justify-content: space-between; align-items: center;';

    const headerTextContainer = document.createElement('span');
    headerEl.appendChild(headerTextContainer);

    // Debug tooltip content
    const state = node.stateSnapshot || {};
    const liveState = session.gameState || {};
    const clocks = state.clocks || { win: 0, lose: 0 };
    const liveClocks = liveState.clocks || { win: 0, lose: 0 };
    const phaseLabel = getNarrativePhaseLabel(node.depth, clocks);

    const stateText = `[Turn ${node.depth}] (${phaseLabel})\n--- NODE STATE ---\nLocation: ${state.location || 'N/A'}\nClocks: Win(${clocks.win}), Lose(${clocks.lose})\n--- LIVE STATE ---\nLocation: ${liveState.location || 'N/A'}\nClocks: Win(${liveClocks.win}), Lose(${liveClocks.lose})\nLogic: ${node.logicalReasoning || 'N/A'}`;

    const debugEl = document.createElement('div');
    debugEl.className = 'debug-state-trigger tooltip';
    debugEl.dataset.tooltip = stateText;
    debugEl.style.cssText = 'font-size: 11px; opacity: 0.4; cursor: help; border: 1px solid currentColor; padding: 2px 6px; border-radius: 4px;';
    debugEl.textContent = 'debug';
    headerEl.appendChild(debugEl);

    // Standard turn setup
    if (!node.isEnding) {
      turnEl.appendChild(headerEl);
      const textEl = document.createElement('div');
      textEl.className = 'story-text';
      turnEl.appendChild(textEl);
    }

    // IMPORTANT: Append turn BEFORE spacer if spacer exists
    const spacer = container.querySelector('.scroll-spacer');
    if (spacer) {
      container.insertBefore(turnEl, spacer);
    } else {
      container.appendChild(turnEl);
    }

    if (node.isEnding) {
      turnEl.style.marginBottom = '0px';
      // We'll call renderEnding later in the flow
    }

    const isLastNode = (i === activePath.length - 1);
    const shouldStream = isLastNode && !skipStreaming;

    const turnLabel = node.depth === 0 ? 'Prologue' : `Page #${node.depth}`;
    const title = node.meta?.title || (node.depth === 0 ? '시작되는 이야기' : '진행');
    const currentLocation = node.stateSnapshot?.location;
    const hasLocationChanged = (currentLocation && currentLocation !== lastLocation);
    const locationStr = hasLocationChanged ? ` @ ${currentLocation}` : '';
    const headerText = `${turnLabel}. ${title}${locationStr}`;

    // Update lastLocation for next turn
    lastLocation = currentLocation;

    // --- Handling Options & Sequential Flow ---
    if (shouldStream) {
      if (!node.isEnding) headerTextContainer.textContent = '';
      setScrollSpacer(container);

      setTimeout(() => {
        turnEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      (async () => {
        await sleep(STREAM_START_DELAY_MS);

        // Header
        if (!node.isEnding) {
          await streamText(headerTextContainer, headerText, null);
          await sleep(STREAM_BREAK_DELAY_MS);
        }

        // Always update visuals at the start of the final turn reveal
        updateThemeVisuals(session, node.stateSnapshot);

        // Content
        if (node.isEnding) {
          await renderEnding(turnEl, node, false);
        } else {
          const textEl = turnEl.querySelector('.story-text');
          await streamText(textEl, node.text, session.worldSchema);
          await sleep(STREAM_BREAK_DELAY_MS);
          attachOptions(container, turnEl, node, session, onOptionSelect, false);
        }

        // Final cleanup
        shrinkScrollSpacer(container, turnEl);
      })();
    } else {
      // Instant render
      if (node.isEnding) {
        renderEnding(turnEl, node, true);
      } else {
        const textEl = turnEl.querySelector('.story-text');
        headerTextContainer.textContent = headerText;
        textEl.innerHTML = formatStoryText(node.text, session.worldSchema);
        attachOptions(container, turnEl, node, session, onOptionSelect, true);
      }

      if (isLastNode) {
        updateThemeVisuals(session, node.stateSnapshot);
        setScrollSpacer(container);
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
    spacer.style.pointerEvents = 'none';
    container.appendChild(spacer);
  }
  // CRITICAL: Always move spacer to the very end of the container
  container.appendChild(spacer);

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
  buildOptions(optList, node, session, onOptionSelect, instant);
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
  html = html.replace(/"([^"]+)"/g, (match, p1) => {
    return `<div class="text-conversation">"${p1.trim()}"</div>`;
  });

  // Parse << dialogue >> into immersive blocks
  // Note: escapeHTML was called above, so we match &lt;&lt; and &gt;&gt;
  html = html.replace(/&lt;&lt;([^&]+)&gt;&gt;/g, (match, p1) => {
    return `<div class="text-conversation">"${p1.trim()}"</div>`;
  });

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
 * Dynamically update the background color based on narrative phase.
 * Exported so App.js can call this on tree node rollback.
 */
export function updateThemeVisuals(session, stateSnapshot) {
  if (!session || !session.themeColor) return;

  // Apply subtle desaturation/darkening to protect user eyes (20% reduction)
  const initialColor = applyColorFilter(session.themeColor.initialThemeColor || '#0f111a', 0.8, 0.8);
  const climaxColor = applyColorFilter(session.themeColor.climaxThemeColor || '#000000', 0.8, 0.8);

  const snapshot = stateSnapshot || {};
  const clocks = snapshot.clocks || { win: 0, lose: 0 };
  const turnCount = snapshot.turnCount || 0;
  const phaseKey = getNarrativePhaseKey(turnCount, clocks);

  // Smooth turn-based base factor (0.0 at turn 0, 1.0 at turn 10)
  const turnProgress = Math.min(1.0, turnCount / 10);

  // Phase-based influence (ACT1: 0, ACT2: 0.4, ACT3: 0.85)
  const phaseFactors = { ACT1: 0.05, ACT2: 0.45, ACT3: 0.85 };
  const phaseBase = phaseFactors[phaseKey] ?? 0.0;

  // Blend turnProgress and phaseBase for smooth but localized transition
  let factor = (turnProgress + phaseBase) / 2;

  // Final override for ENDING
  if (phaseKey === 'ENDING') {
    const isWin = (clocks.win || 0) >= (clocks.lose || 0);
    // Move slightly back to initial if win, stay climax if lose
    factor = isWin ? 0.0 : 1.0;
  }

  const currentColor = interpolateColor(initialColor, climaxColor, factor);

  document.body.style.backgroundColor = currentColor;
  document.documentElement.style.setProperty('--bg-primary', currentColor);
  document.documentElement.style.setProperty('--bg-secondary', blendColor(currentColor, 0.08));
  document.documentElement.style.setProperty('--bg-panel', blendColor(currentColor, 0.06));
}

/**
 * Apply desaturation and darkening to a hex color.
 * @param {string} hex 
 * @param {number} satFactor (0.8 = 20% reduction)
 * @param {number} lumFactor (0.8 = 20% reduction)
 */
function applyColorFilter(hex, satFactor, lumFactor) {
  // Convert HEX to RGB
  let [r, g, b] = hex.replace('#', '').match(/.{2}/g).map(h => parseInt(h, 16));

  // Convert RGB to HSL
  let R = r / 255, G = g / 255, B = b / 255;
  let max = Math.max(R, G, B), min = Math.min(R, G, B);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R: h = (G - B) / d + (G < B ? 6 : 0); break;
      case G: h = (B - R) / d + 2; break;
      case B: h = (R - G) / d + 4; break;
    }
    h /= 6;
  }

  // Apply reductions
  s *= satFactor;
  l *= lumFactor;

  // Convert HSL back to RGB
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    r = g = b = Math.round(l * 255);
  } else {
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    g = Math.round(hue2rgb(p, q, h) * 255);
    b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
function buildOptions(optList, node, session, onOptionSelect, instant) {
  const buttons = [];
  let options = [...(node.options || [])];

  // Dynamic fallback for Intro node (Reuse synopsis for new stories)
  if (node.depth === 0) {
    if (!options.find(o => o.id === 'start')) {
      options.unshift({ id: 'start', text: session?.synopsis?.entryLabel || '모험을 시작합니다.' });
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
    // Replace <<dlg>> with "dlg" for simple but consistent look on buttons
    textSpan.textContent = opt.text.replace(/<<([^>]+)>>/g, '"$1"');
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
  const canShowDirectInput = node.depth > 0 && !node.isEnding;
  let freeTextRow = null;
  if (canShowDirectInput) {
    freeTextRow = buildActionTriggerButton(optList, node, session, onOptionSelect, instant);
    optList.appendChild(freeTextRow);
  }

  // Stagger reveal
  if (!instant) {
    buttons.forEach((btn, idx) => {
      setTimeout(() => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
      }, idx * STREAM_OPTION_DELAY_MS);
    });

    // Reveal free-text after all option buttons
    if (freeTextRow) {
      setTimeout(() => {
        freeTextRow.style.opacity = '1';
        freeTextRow.style.transform = 'translateY(0)';
      }, buttons.length * STREAM_OPTION_DELAY_MS);
    }
  }
}

/**
 * Build a simple button that triggers the action modal.
 */
function buildActionTriggerButton(optList, node, session, onOptionSelect, instant) {
  const row = document.createElement('div');
  row.className = 'option-freetext';

  if (!instant) {
    row.style.opacity = '0';
    row.style.transform = 'translateY(8px)';
    row.style.transition = `opacity ${STREAM_FADE_MS}ms ease, transform ${STREAM_FADE_MS}ms ease`;
  }

  const btn = document.createElement('button');
  btn.className = 'btn-action-trigger';
  btn.innerHTML = '<i class="fa-solid fa-pen-nib" style="margin-right:8px;"></i>직접 입력';

  btn.addEventListener('click', () => {
    openActionModal((text) => {
      const newOptionId = addCustomOption(session, node.id, text);
      if (newOptionId) {
        // Trigger prefetch for the new custom option
        prefetchOption(session, node.id, newOptionId);
        // Re-render only the options list for this turn immediately
        optList.innerHTML = '';
        buildOptions(optList, node, session, onOptionSelect, true);
      }
    });
  });

  row.appendChild(btn);
  return row;
}

/**
 * Open a modal for custom action input.
 */
function openActionModal(onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal action-modal';

  modal.innerHTML = `
    <div class="modal__header">직접 행동 입력</div>
    <div class="modal__body" style="margin-bottom: 20px;">
      <textarea class="action-modal__input" placeholder="구체적인 상황이나 행동을 입력하세요... (예: 주변에 숨겨진 장치가 있는지 벽을 더듬어본다)" autofocus></textarea>
    </div>
    <div class="modal__footer">
      <button class="btn btn-secondary btn-cancel">취소</button>
      <button class="btn btn-primary btn-confirm">확인</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const input = modal.querySelector('.action-modal__input');
  const cancelBtn = modal.querySelector('.btn-cancel');
  const confirmBtn = modal.querySelector('.btn-confirm');

  const close = () => overlay.remove();

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  confirmBtn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val) {
      onConfirm(val);
      close();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      confirmBtn.click();
    }
    if (e.key === 'Escape') close();
  });

  // Small delay to ensure autofocus works on next-tick after DOM insertion
  setTimeout(() => input.focus(), 50);
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
async function renderEnding(container, node, skipStreaming) {
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

  // Re-use the same story-turn structure — just a thin top border
  const endingDiv = document.createElement('div');
  endingDiv.className = 'ending-container';
  // Reduced top margin even further and removed border-top padding redundant with spacer
  endingDiv.style.cssText = 'margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--border);';

  // Include Debug in the ending row to be compact
  const debugWrap = document.createElement('div');
  debugWrap.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 8px;';

  const debugEl = document.createElement('div');
  debugEl.className = 'debug-state-trigger tooltip';
  debugEl.dataset.tooltip = `[Turn ${node.depth}] (ENDING)\nClocks: Win(${node.stateSnapshot?.clocks?.win}), Lose(${node.stateSnapshot?.clocks?.lose})\nLogic: ${node.logicalReasoning}`;
  debugEl.style.cssText = 'font-size: 10px; opacity: 0.3; cursor: help; border: 1px solid currentColor; padding: 1px 4px; border-radius: 3px;';
  debugEl.textContent = 'debug';
  debugWrap.appendChild(debugEl);
  endingDiv.appendChild(debugWrap);

  const textEl = document.createElement('div');
  textEl.className = 'story-text';
  textEl.style.cssText = 'margin-top: 12px; font-weight: 500;'; // Slight weight for punchiness
  endingDiv.appendChild(textEl);

  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'margin-top: 20px; color: var(--text-muted); font-size: 12px; opacity: 0.8;';
  hintEl.textContent = '트리에서 과거 경로를 클릭하여 다른 운명을 탐험해보세요.';
  endingDiv.appendChild(hintEl);

  container.appendChild(endingDiv);

  if (skipStreaming) {
    textEl.innerHTML = formatStoryText(node.text, null);
  } else {
    await streamText(textEl, node.text, null, null);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

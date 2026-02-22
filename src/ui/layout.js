/**
 * layout.js — Creates the 3-panel DOM layout with overlay sidebars
 * @module ui/layout
 */

/**
 * Render the main application layout into #app.
 * Returns references to key container elements.
 */
export function createLayout({ onTitleClick } = {}) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <header class="app-header" id="app-header">
      <div class="app-header__left">
        <button class="icon-btn" id="btn-toggle-left" title="세션 목록 접기/펼치기" aria-label="세션 목록 접기/펼치기"><i class="fa-solid fa-bars"></i></button>
        <div class="app-header__title" id="app-title" style="cursor: pointer;">✦ Narrive</div>
      </div>

      <div class="app-header__actions">
        <button class="icon-btn" id="btn-toggle-json" title="JSON 데이터 보기" aria-label="JSON 데이터 보기"><i class="fa-solid fa-file-code"></i></button>
        <button class="icon-btn" id="btn-toggle-right" title="스토리 트리 접기/펼치기" aria-label="스토리 트리 접기/펼치기"><i class="fa-solid fa-code-fork"></i></button>
        <button class="icon-btn" id="btn-settings" title="설정" aria-label="설정"><i class="fa-solid fa-gear"></i></button>
      </div>
    </header>
    <div class="app-layout" id="app-layout">
      <div class="panel-backdrop" id="panel-backdrop"></div>
      <aside class="panel-left" id="panel-left">
        <div class="panel-left__header" id="savelist-header"></div>
        <div class="panel-left__list" id="savelist-body"></div>
      </aside>
      <main class="panel-center" id="panel-center">
        <div class="panel-center__content" id="story-content">
          <div class="story-container" id="story-container"></div>
          <div class="json-viewer-container hidden" id="json-viewer-container"></div>
        </div>
      </main>
      <aside class="panel-right" id="panel-right">
        <div class="panel-right__header">스토리 트리</div>
        <div class="panel-right__content" id="tree-content"></div>
      </aside>
    <div id="modal-root"></div>
    <div class="toast-container" id="toast-container"></div>
    <div id="global-tooltip" class="global-tooltip"></div>
  `;

  // Elements
  const panelLeft = document.getElementById('panel-left');
  const panelRight = document.getElementById('panel-right');
  const backdrop = document.getElementById('panel-backdrop');
  const btnToggleLeft = document.getElementById('btn-toggle-left');
  const btnToggleRight = document.getElementById('btn-toggle-right');

  // Close any open panel
  function closeAllPanels() {
    panelLeft.classList.remove('panel--open');
    panelRight.classList.remove('panel--open');
    backdrop.classList.remove('panel-backdrop--visible');
    btnToggleLeft.classList.remove('icon-btn--active');
    btnToggleRight.classList.remove('icon-btn--active');
  }

  // Toggle left panel
  btnToggleLeft.addEventListener('click', () => {
    const isOpen = panelLeft.classList.contains('panel--open');
    closeAllPanels();
    if (!isOpen) {
      panelLeft.classList.add('panel--open');
      backdrop.classList.add('panel-backdrop--visible');
      btnToggleLeft.classList.add('icon-btn--active');
    }
  });

  // Toggle right panel
  btnToggleRight.addEventListener('click', () => {
    const isOpen = panelRight.classList.contains('panel--open');
    closeAllPanels();
    if (!isOpen) {
      panelRight.classList.add('panel--open');
      backdrop.classList.add('panel-backdrop--visible');
      btnToggleRight.classList.add('icon-btn--active');
    }
  });

  // Click backdrop to close
  backdrop.addEventListener('click', closeAllPanels);

  // Home Navigation
  const appTitle = document.getElementById('app-title');
  if (appTitle && onTitleClick) {
    appTitle.addEventListener('click', onTitleClick);
  }

  // Close with Escape key

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllPanels();
    }
  });

  // Global Tooltip Logic
  const globalTooltip = document.getElementById('global-tooltip');
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.tooltip');

    // Do not show tooltip if any dropdown menu is currently open
    if (document.querySelector('.session-menu-dropdown--open')) {
      return;
    }

    if (target && target.dataset.tooltip) {
      globalTooltip.textContent = target.dataset.tooltip;

      // Position temporarily to calc dimensions
      globalTooltip.classList.add('global-tooltip--visible');
      const rect = target.getBoundingClientRect();
      const tooltipRect = globalTooltip.getBoundingClientRect();

      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

      // Bound checking
      if (left < 8) {
        left = 8;
      } else if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }

      globalTooltip.style.left = `${left}px`;
      globalTooltip.style.top = `${rect.bottom + 6}px`;
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('.tooltip');
    if (target) {
      globalTooltip.classList.remove('global-tooltip--visible');
    }
  });

  // Global Dropdown Closer & Tooltip Hider
  document.addEventListener('click', (e) => {
    // Hide tooltip on any click
    globalTooltip.classList.remove('global-tooltip--visible');

    if (!e.target.closest('.session-card__menu-wrap')) {
      document.querySelectorAll('.session-menu-dropdown--open').forEach(el => {
        el.classList.remove('session-menu-dropdown--open');
      });
    }
  });

  return {
    header: document.getElementById('app-header'),
    panelLeft,
    panelCenter: document.getElementById('panel-center'),
    panelRight,
    savelistHeader: document.getElementById('savelist-header'),
    savelistBody: document.getElementById('savelist-body'),
    storyContainer: document.getElementById('story-container'),
    jsonViewerContainer: document.getElementById('json-viewer-container'),
    treeContent: document.getElementById('tree-content'),
    modalRoot: document.getElementById('modal-root'),
    toastContainer: document.getElementById('toast-container'),
    btnSettings: document.getElementById('btn-settings'),
    btnToggleJson: document.getElementById('btn-toggle-json'),
    closeAllPanels,
  };
}

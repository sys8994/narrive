/**
 * layout.js — Creates the 3-panel DOM layout with overlay sidebars
 * @module ui/layout
 */

/**
 * Render the main application layout into #app.
 * Returns references to key container elements.
 */
export function createLayout() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <header class="app-header" id="app-header">
      <div class="app-header__left">
        <button class="icon-btn" id="btn-toggle-left" title="세션 목록 접기/펼치기" aria-label="세션 목록 접기/펼치기">☰</button>
        <div class="app-header__title">✦ Narrive</div>
      </div>
      <div class="app-header__actions">
        <button class="icon-btn" id="btn-toggle-right" title="스토리 트리 접기/펼치기" aria-label="스토리 트리 접기/펼치기">🌲</button>
        <button class="icon-btn" id="btn-settings" title="설정" aria-label="설정">⚙</button>
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
        </div>
      </main>
      <aside class="panel-right" id="panel-right">
        <div class="panel-right__header">스토리 트리</div>
        <div class="panel-right__content" id="tree-content"></div>
      </aside>
    </div>
    <div id="modal-root"></div>
    <div class="toast-container" id="toast-container"></div>
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

  return {
    header: document.getElementById('app-header'),
    panelLeft,
    panelCenter: document.getElementById('panel-center'),
    panelRight,
    savelistHeader: document.getElementById('savelist-header'),
    savelistBody: document.getElementById('savelist-body'),
    storyContainer: document.getElementById('story-container'),
    treeContent: document.getElementById('tree-content'),
    modalRoot: document.getElementById('modal-root'),
    toastContainer: document.getElementById('toast-container'),
    btnSettings: document.getElementById('btn-settings'),
    closeAllPanels,
  };
}

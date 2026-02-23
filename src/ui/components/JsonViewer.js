/**
 * JsonViewer.js — Renders session data as formatted JSON with sectional toggle/copy
 * @module ui/components/JsonViewer
 */

/**
 * Render session data into the container.
 * @param {HTMLElement} container 
 * @param {Object} session 
 */
export function renderJsonViewer(container, session) {
    if (!session) {
        container.innerHTML = '<div class="empty-state">세션 데이터가 없습니다.</div>';
        return;
    }

    // Define sections we want to display
    const sections = [
        { id: 'session-core', title: 'Core Session Data', data: { id: session.id, title: session.title, createdAt: session.createdAt, updatedAt: session.updatedAt, currentNodeId: session.currentNodeId } },
        { id: 'session-synopsis', title: 'World Synopsis', data: session.synopsis },
        { id: 'session-schema', title: 'World Schema (Protagonist, NPCs, etc.)', data: session.worldSchema },
        { id: 'session-theme', title: 'Theme Settings', data: session.themeColor },
        { id: 'session-state', title: 'Current Game State (Flags)', data: session.gameState },
        { id: 'session-nodes', title: 'Story Tree Nodes', data: session.nodesById },
    ];

    container.innerHTML = sections.map(renderSection).join('');

    // Initial event binding if not already persistent (using onclick for delegated simplicity)
    container.onclick = (e) => {
        const header = e.target.closest('.json-header');
        if (header) {
            const section = header.closest('.json-section');
            const content = section.querySelector('.json-content');
            const icon = header.querySelector('.fa-chevron-down');

            const isCollapsed = content.classList.toggle('collapsed');
            if (icon) {
                icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            }
            return;
        }

        const copyBtn = e.target.closest('.btn-json-copy');
        if (copyBtn) {
            e.stopPropagation();
            const text = copyBtn.dataset.copyText;
            navigator.clipboard.writeText(text).then(() => {
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 2000);
            });
        }
    };
}

/**
 * Render a single collapsible section
 */
function renderSection({ id, title, data }) {
    const safeData = data === undefined ? null : data;
    const jsonStr = JSON.stringify(safeData, null, 2) || 'null';
    const highlighted = syntaxHighlight(jsonStr);

    return `
    <div class="json-section" id="${id}">
      <div class="json-header">
        <div class="json-header__title">
          <i class="fa-solid fa-chevron-down" style="transition: transform 0.2s; font-size: 10px;"></i>
          ${title}
        </div>
        <div class="json-header__actions">
          <button class="icon-btn-small btn-json-copy tooltip" data-tooltip="JSON 복사" data-copy-text='${jsonStr.replace(/'/g, "&apos;")}' aria-label="JSON 복사">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
      </div>
      <div class="json-content">
        <pre class="json-viewer">${highlighted}</pre>
      </div>
    </div>
  `;
}

/**
 * Basic JSON syntax highlighting
 */
function syntaxHighlight(json) {
    if (json === undefined || json === null) return '<span class="json-null">null</span>';
    if (typeof json !== 'string') {
        json = JSON.stringify(json, undefined, 2) || 'null';
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

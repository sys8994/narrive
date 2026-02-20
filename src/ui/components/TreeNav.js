/**
 * TreeNav.js — Right sidebar: linear tree navigation with branch indicators
 * @module ui/components/TreeNav
 *
 * Displays a flat (non-indented) list of story nodes.
 * Branches are shown inline with a branch indicator and collapsed by default.
 */

import { getPathToRoot } from '../../core/treeEngine.js';

/**
 * Render the tree navigation (linear, no indent).
 * @param {Object} params
 * @param {HTMLElement} params.container — #tree-content
 * @param {Object} params.session — current GameSessionBlob
 * @param {Function} params.onNodeClick — (nodeId) => void
 */
export function renderTreeNav({ container, session, onNodeClick }) {
    container.innerHTML = '';

    if (!session || !session.rootNodeId) {
        container.innerHTML = '<div class="empty-state" style="padding: 16px; font-size: 12px;"><span>아직 진행한 이야기가 없습니다</span></div>';
        return;
    }

    // Build the active path from root to current node
    const activePath = getPathToRoot(session, session.currentNodeId);
    const activePathSet = new Set(activePath);

    // Render nodes linearly following the active path, with branch markers
    const list = document.createElement('div');
    list.className = 'tree-linear';

    renderLinearPath(list, session, session.rootNodeId, activePathSet, onNodeClick);

    container.appendChild(list);

    // Scroll current node into view — but only if the tree panel is open
    const panelRight = container.closest('.panel-right');
    const isVisible = panelRight && panelRight.classList.contains('panel--open');
    if (isVisible) {
        const currentEl = container.querySelector('.tree-node--current');
        if (currentEl) {
            currentEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
}

/**
 * Render nodes linearly, following the active path.
 * At branch points, show a branch selector.
 */
function renderLinearPath(container, session, startNodeId, activePathSet, onNodeClick) {
    let currentId = startNodeId;

    while (currentId) {
        const node = session.nodesById[currentId];
        if (!node) break;

        // Get children of this node
        const childEdges = session.edges.filter(e => e.from === currentId);
        const isCurrent = session.currentNodeId === currentId;
        const isOnActivePath = activePathSet.has(currentId);

        // Render the node
        const nodeEl = document.createElement('div');
        nodeEl.className = 'tree-node tree-node--linear';
        if (isCurrent) nodeEl.classList.add('tree-node--current');
        if (isOnActivePath && !isCurrent) nodeEl.classList.add('tree-node--on-path');

        // Step number
        const stepNum = document.createElement('span');
        stepNum.className = 'tree-node__step';
        stepNum.textContent = node.depth;

        // Title
        const titleEl = document.createElement('span');
        titleEl.className = 'tree-node__title';
        titleEl.textContent = (node.meta && node.meta.title) || `Turn ${node.depth}`;

        nodeEl.appendChild(stepNum);
        nodeEl.appendChild(titleEl);
        nodeEl.title = titleEl.textContent;
        nodeEl.dataset.nodeId = currentId;

        nodeEl.addEventListener('click', ((id) => (e) => {
            e.stopPropagation();
            onNodeClick(id);
        })(currentId));

        container.appendChild(nodeEl);

        // If this node has multiple children → show branch indicator
        if (childEdges.length > 1) {
            const branchGroup = document.createElement('div');
            branchGroup.className = 'tree-branch-group';

            const branchLabel = document.createElement('div');
            branchLabel.className = 'tree-branch-label';
            branchLabel.textContent = `⑂ ${childEdges.length}개 분기`;
            branchGroup.appendChild(branchLabel);

            // Show branch pills
            const branchPills = document.createElement('div');
            branchPills.className = 'tree-branch-pills';

            childEdges.forEach((edge, idx) => {
                const childNode = session.nodesById[edge.to];
                if (!childNode) return;

                const isActiveBranch = activePathSet.has(edge.to);
                const pill = document.createElement('button');
                pill.className = 'tree-branch-pill';
                if (isActiveBranch) pill.classList.add('tree-branch-pill--active');

                const optionText = node.options?.find(o => o.id === edge.optionId)?.text || '';
                pill.textContent = optionText ? `${idx + 1}. ${truncate(optionText, 20)}` : `분기 ${idx + 1}`;
                pill.title = optionText || `분기 ${idx + 1}`;

                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onNodeClick(edge.to);
                });

                branchPills.appendChild(pill);
            });

            branchGroup.appendChild(branchPills);
            container.appendChild(branchGroup);

            // Continue only along the active path branch
            const activeBranch = childEdges.find(e => activePathSet.has(e.to));
            currentId = activeBranch ? activeBranch.to : null;
        } else if (childEdges.length === 1) {
            // Single child → continue linearly
            currentId = childEdges[0].to;
        } else {
            // Leaf node → stop
            currentId = null;
        }
    }
}

function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * treeEngine.js — Pure-function tree/branch/rollback operations
 * @module core/treeEngine
 *
 * Operates on a session's { nodesById, edges } data.
 * All functions are side-effect-free: they return new/modified references.
 */

/**
 * Add a StoryNode to the session.
 * @param {Object} session — mutated in place for convenience (caller saves)
 * @param {Object} node — StoryNode
 */
export function addNode(session, node) {
    session.nodesById[node.id] = node;
}

/**
 * Add a directed edge: parentId --optionId--> childId
 */
export function addEdge(session, fromId, optionId, toId) {
    session.edges.push({ from: fromId, optionId, to: toId });
}

/**
 * Find an existing child node for (parentId, optionId).
 * Returns the child node or null.
 */
export function getChild(session, parentId, optionId) {
    const edge = session.edges.find(
        (e) => e.from === parentId && e.optionId === optionId
    );
    return edge ? session.nodesById[edge.to] || null : null;
}

/**
 * Get all direct children of a node.
 * @returns {Array<{optionId: string, node: Object}>}
 */
export function getChildren(session, parentId) {
    return session.edges
        .filter((e) => e.from === parentId)
        .map((e) => ({ optionId: e.optionId, node: session.nodesById[e.to] }));
}

/**
 * Get path from root to the given node (array of node IDs, root first).
 */
export function getPathToRoot(session, nodeId) {
    const path = [];
    let current = nodeId;
    while (current) {
        path.unshift(current);
        const node = session.nodesById[current];
        current = node ? node.parentId : null;
    }
    return path;
}

/**
 * Build a recursive tree view model for rendering.
 * @returns {{ id, title, depth, children: Array, isCurrent: boolean }}
 */
export function buildTreeViewModel(session) {
    const rootId = session.rootNodeId;
    if (!rootId) return null;

    function buildSubtree(nodeId) {
        const node = session.nodesById[nodeId];
        if (!node) return null;

        const childEdges = session.edges.filter((e) => e.from === nodeId);
        const children = childEdges
            .map((e) => buildSubtree(e.to))
            .filter(Boolean);

        return {
            id: node.id,
            title: (node.meta && node.meta.title) || `Turn ${node.depth}`,
            depth: node.depth,
            children,
            isCurrent: session.currentNodeId === node.id,
            hasBranches: children.length > 1,
        };
    }

    return buildSubtree(rootId);
}

/**
 * gameEngine.js — Game loop orchestrator
 * @module core/gameEngine
 *
 * Responsibilities:
 *   - Create sessions from synopsis data
 *   - Progress turns: check existing child → reuse or call LLM
 *   - Rollback to past nodes (restore stateSnapshot)
 *   - Auto-save after mutations
 */

import { generateId } from './id.js';
import { now } from './time.js';
import * as tree from './treeEngine.js';
import { callPrompt3 } from '../llm/prompts.js';

/**
 * Create the initial gameState.
 * @returns {Object}
 */
export function createInitialState() {
    return {
        location: '',
        inventory: [],
        flags: {},
        turnCount: 0,
        isEnding: false,
    };
}

/**
 * Create a new GameSessionBlob from synopsis generation results.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.systemSynopsis
 * @param {string} params.openingText
 * @param {string} params.themeColor
 * @param {string} params.accentColor
 * @param {string} params.model
 * @param {number} params.temperature
 * @returns {Object} GameSessionBlob
 */
export function createSession({ title, systemSynopsis, openingText, themeColor, accentColor, model, temperature, worldSchema }) {
    const sessionId = generateId();
    const rootId = generateId();
    const timestamp = now();
    const initialState = createInitialState();

    const rootNode = {
        id: rootId,
        parentId: null,
        depth: 0,
        text: openingText,
        options: [],   // will be filled by first LLM call
        selectedOptionId: null,
        stateSnapshot: { ...initialState },
        isEnding: false,
        meta: { title: '시작' },
        visited: true,
    };

    return {
        id: sessionId,
        title,
        createdAt: timestamp,
        updatedAt: timestamp,
        theme: { themeColor, accent: accentColor },
        synopsis: { systemSynopsis, openingText },
        worldSchema: worldSchema || null,
        llm: { model, temperature },
        currentNodeId: rootId,
        rootNodeId: rootId,
        nodesById: { [rootId]: rootNode },
        edges: [],
        gameState: { ...initialState },
    };
}

/**
 * Generate the first set of options for the root node.
 * This is called right after session creation.
 * @param {Object} session — mutated
 * @returns {Promise<Object>} the LLM response data
 */
export async function generateInitialOptions(session) {
    const result = await callPrompt3(session, null);
    if (!result.ok) return result;

    const data = result.data;
    const rootNode = session.nodesById[session.rootNodeId];

    const newState = {
        location: (data.updatedState && data.updatedState.location) || session.gameState.location,
        inventory: (data.updatedState && data.updatedState.inventory) || [...session.gameState.inventory],
        flags: { ...session.gameState.flags, ...((data.updatedState && data.updatedState.flags) || {}) },
        turnCount: 1,
        isEnding: data.isEnding || false,
    };

    const newNode = {
        id: generateId(),
        parentId: rootNode.id,
        depth: 1,
        text: data.text || '',
        options: data.options || [],
        selectedOptionId: null,
        stateSnapshot: { ...newState },
        isEnding: data.isEnding || false,
        meta: { title: data.nodeTitle || `Turn 1` },
        visited: true,
    };

    if (data.isEnding && data.endingType) {
        newNode.meta.endingType = data.endingType;
    }

    rootNode.options = [{ id: 'start', text: '모험 시작' }];
    rootNode.selectedOptionId = 'start';

    tree.addNode(session, newNode);
    tree.addEdge(session, rootNode.id, 'start', newNode.id);

    session.currentNodeId = newNode.id;
    session.gameState = { ...newState };
    session.updatedAt = now();

    return { ok: true, data };
}

/**
 * Progress a turn: player chose an option on the current node.
 *
 * 1. Check if (currentNodeId, optionId) already has a child → reuse
 * 2. If not, call LLM (Prompt #3) → create new StoryNode + edge
 *
 * @param {Object} session — mutated
 * @param {string} optionId
 * @returns {Promise<{ok:boolean, reused?:boolean, node?:Object, data?:Object, error?:string}>}
 */
export async function progressTurn(session, optionId, customText) {
    const currentNode = session.nodesById[session.currentNodeId];
    if (!currentNode) return { ok: false, error: 'Current node not found' };

    // Mark selected option on current node
    currentNode.selectedOptionId = optionId;

    // 1. Check for existing child
    const existingChild = tree.getChild(session, session.currentNodeId, optionId);
    if (existingChild) {
        session.currentNodeId = existingChild.id;
        session.gameState = { ...existingChild.stateSnapshot };
        session.updatedAt = now();
        existingChild.visited = true;
        return { ok: true, reused: true, node: existingChild };
    }

    // 2. Call LLM
    let selectedOption;
    if (optionId === '__custom__' && customText) {
        // Free-text custom action from the player
        selectedOption = { id: '__custom__', text: customText };
    } else {
        selectedOption = currentNode.options.find((o) => o.id === optionId);
    }
    const result = await callPrompt3(session, selectedOption);
    if (!result.ok) return result;

    const data = result.data;

    // Build new state
    const parentState = currentNode.stateSnapshot || session.gameState;
    const newState = {
        location: (data.updatedState && data.updatedState.location) || parentState.location,
        inventory: (data.updatedState && data.updatedState.inventory) || [...parentState.inventory],
        flags: { ...parentState.flags, ...((data.updatedState && data.updatedState.flags) || {}) },
        turnCount: parentState.turnCount + 1,
        isEnding: data.isEnding || false,
    };

    // Create new node
    const newNode = {
        id: generateId(),
        parentId: session.currentNodeId,
        depth: currentNode.depth + 1,
        text: data.text || '',
        options: data.options || [],
        selectedOptionId: null,
        stateSnapshot: { ...newState },
        isEnding: data.isEnding || false,
        meta: { title: data.nodeTitle || `Turn ${newState.turnCount}` },
        visited: true,
    };

    // If it's an ending, add ending type
    if (data.isEnding && data.endingType) {
        newNode.meta.endingType = data.endingType;
    }

    // Update session
    tree.addNode(session, newNode);
    tree.addEdge(session, session.currentNodeId, optionId, newNode.id);
    session.currentNodeId = newNode.id;
    session.gameState = { ...newState };
    session.updatedAt = now();

    return { ok: true, reused: false, node: newNode, data };
}

/**
 * Rollback to a past node: restore its stateSnapshot and set as current.
 * @param {Object} session — mutated
 * @param {string} nodeId
 * @returns {{ ok: boolean, node?: Object }}
 */
export function rollbackToNode(session, nodeId) {
    const node = session.nodesById[nodeId];
    if (!node) return { ok: false, error: 'Node not found' };

    session.currentNodeId = nodeId;
    session.gameState = { ...node.stateSnapshot };
    session.updatedAt = now();

    return { ok: true, node };
}

/**
 * Prefetch LLM responses for ALL options on the current node in parallel.
 * Creates child nodes + edges so that progressTurn’s getChild() picks them up.
 * Skips options that already have a child node.
 *
 * @param {Object} session — mutated (new nodes/edges added)
 * @returns {Promise<void>}
 */
export async function prefetchAllOptions(session) {
    const currentNode = session.nodesById[session.currentNodeId];
    if (!currentNode || !currentNode.options || currentNode.options.length === 0) return;
    if (currentNode.isEnding) return;

    const optionsToFetch = currentNode.options.filter(opt => {
        // Skip if already has a child for this option
        return !tree.getChild(session, currentNode.id, opt.id);
    });

    if (optionsToFetch.length === 0) return;

    console.group('%c[Prefetch]', 'color: #66ff99; font-weight: bold');
    console.log(`Prefetching ${optionsToFetch.length} options for node ${currentNode.id}`);
    console.groupEnd();

    // Fire LLM calls. We process them sequentially with a tiny delay to avoid hitting Gemini's strict 15 RPM / burst rate limits.
    for (const opt of optionsToFetch) {
        try {
            const result = await callPrompt3(session, opt);
            if (!result.ok) {
                console.warn(`[Prefetch] Failed for option "${opt.text}":`, result.error);
                continue;
            }

            const data = result.data;
            const parentState = currentNode.stateSnapshot || session.gameState;
            const newState = {
                location: (data.updatedState && data.updatedState.location) || parentState.location,
                inventory: (data.updatedState && data.updatedState.inventory) || [...parentState.inventory],
                flags: { ...parentState.flags, ...((data.updatedState && data.updatedState.flags) || {}) },
                turnCount: parentState.turnCount + 1,
                isEnding: data.isEnding || false,
            };

            const newNode = {
                id: generateId(),
                parentId: currentNode.id,
                depth: currentNode.depth + 1,
                text: data.text || '',
                options: data.options || [],
                selectedOptionId: null,
                stateSnapshot: { ...newState },
                isEnding: data.isEnding || false,
                meta: { title: data.nodeTitle || `Turn ${newState.turnCount}` },
                visited: false,
            };

            if (data.isEnding && data.endingType) {
                newNode.meta.endingType = data.endingType;
            }

            // Only add if no child was created in the meantime (race safety)
            if (!tree.getChild(session, currentNode.id, opt.id)) {
                tree.addNode(session, newNode);
                tree.addEdge(session, currentNode.id, opt.id, newNode.id);
                console.log(`[Prefetch] ✓ Cached "${opt.text}" → node ${newNode.id}`);
            }

            // Artificial delay between prefetches to respect bursting limits
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            console.warn(`[Prefetch] Error for option "${opt.text}":`, err);
        }
    }

    session.updatedAt = now();
}

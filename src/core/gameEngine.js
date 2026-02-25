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
import { HARD_ENDING_THRESHOLD } from './narrativeEngine.js';

// Track in-flight prefetch promises to avoid redundant LLM calls
// Map<"nodeId:optionId", Promise<void>>
const inFlightPrefetches = new Map();

/**
 * Create the initial gameState.
 * @returns {Object}
 */
export function createInitialState() {
    return {
        location: '',
        inventory: [],
        flags: {},
        eventLedger: [],
        clocks: {
            win: 0,
            lose: 0
        },
        tensionLevel: 1,
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
 * @param {string} params.initialThemeColor
 * @param {string} params.climaxThemeColor
 * @param {string} params.accentColor
 * @param {string} params.model
 * @param {number} params.temperature
 * @param {string} params.entryLabel
 * @returns {Object} GameSessionBlob
 */
export function createSession({ title, publicWorld, hiddenPlot, openingText, entryLabel, initialThemeColor, climaxThemeColor, accentColor, model, temperature, worldSchema }) {
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
        themeColor: {
            initialThemeColor: initialThemeColor || '#0f111a',
            climaxThemeColor: climaxThemeColor || '#000000',
            accentColor: accentColor || '#ff9e80',
        },
        synopsis: { publicWorld, hiddenPlot, openingText, entryLabel },
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

    // Initialize state from LLM (though usually first turn just sets options)
    const newState = applyStatePatch(session.gameState, data);

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
        turnSummary: data.turnSummary || '',
    };

    if (data.isEnding && data.endingType) {
        newNode.meta.endingType = data.endingType;
    }

    rootNode.options = [
        { id: 'start', text: '모험 시작' },
        { id: 'new_start', text: '새 모험 시작' }
    ];
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

    // 1.1 Check if a prefetch is currently in-flight for this option
    const prefetchKey = `${session.currentNodeId}:${optionId}`;
    if (inFlightPrefetches.has(prefetchKey)) {
        console.log(`[Progress] Waiting for in-flight prefetch for option "${optionId}"...`);
        await inFlightPrefetches.get(prefetchKey);

        // After waiting, the child should now exist in the tree
        const prefetchedChild = tree.getChild(session, session.currentNodeId, optionId);
        if (prefetchedChild) {
            session.currentNodeId = prefetchedChild.id;
            session.gameState = { ...prefetchedChild.stateSnapshot };
            session.updatedAt = now();
            prefetchedChild.visited = true;
            return { ok: true, reused: true, node: prefetchedChild };
        }
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

    // Build new state using PATCH logic
    const parentState = currentNode.stateSnapshot || session.gameState;
    const newState = applyStatePatch(parentState, data);

    // Create new node
    const newNode = {
        id: generateId(),
        parentId: session.currentNodeId,
        depth: currentNode.depth + 1,
        text: data.text || '',
        options: data.options || [],
        selectedOptionId: null,
        stateSnapshot: { ...newState },
        logicalReasoning: data.logicalReasoning || '',
        isEnding: data.isEnding || false,
        meta: { title: data.nodeTitle || `Turn ${newState.turnCount}` },
        visited: true,
        turnSummary: data.turnSummary || '',
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

    // Fire LLM calls in parallel. 
    const parentState = currentNode.stateSnapshot || session.gameState;
    const nodeId = currentNode.id;

    const fetchPromises = optionsToFetch.map(async (opt) => {
        const prefetchKey = `${nodeId}:${opt.id}`;

        const attemptPrefetch = async () => {
            try {
                const result = await callPrompt3(session, opt);
                if (!result.ok) {
                    console.warn(`[Prefetch] Failed for option "${opt.text}":`, result.error);
                    return;
                }

                const data = result.data;
                const newState = applyStatePatch(parentState, data);

                const newNode = {
                    id: generateId(),
                    parentId: nodeId,
                    depth: currentNode.depth + 1,
                    text: data.text || '',
                    options: data.options || [],
                    selectedOptionId: null,
                    stateSnapshot: { ...newState },
                    logicalReasoning: data.logicalReasoning || '',
                    isEnding: data.isEnding || false,
                    meta: { title: data.nodeTitle || `Turn ${newState.turnCount}` },
                    visited: false,
                    turnSummary: data.turnSummary || '',
                };

                if (data.isEnding && data.endingType) {
                    newNode.meta.endingType = data.endingType;
                }

                if (!tree.getChild(session, nodeId, opt.id)) {
                    tree.addNode(session, newNode);
                    tree.addEdge(session, nodeId, opt.id, newNode.id);
                    console.log(`[Prefetch] ✓ Cached "${opt.text}" → node ${newNode.id}`);
                }
            } catch (err) {
                console.warn(`[Prefetch] Error for option "${opt.text}":`, err);
            } finally {
                inFlightPrefetches.delete(prefetchKey);
            }
        };

        const promise = attemptPrefetch();
        inFlightPrefetches.set(prefetchKey, promise);
        return promise;
    });

    await Promise.all(fetchPromises);


    session.updatedAt = now();
}

/**
 * Apply a patch from the LLM response to the current game state.
 * Implements Rule 3 (Patch-based state update) and Rule 4 (Progress Clocks).
 * 
 * @param {Object} prevState 
 * @param {Object} responseData — can include statePatch, clockDelta, turnSummary, tensionLevel, isEnding
 * @returns {Object} new state
 */
export function applyStatePatch(prevState, responseData) {
    const patch = responseData.statePatch || {};
    const clocks = responseData.clockDelta || { track_win: 0, track_lose: 0 };

    // Shallow copy initial structure
    const newState = {
        ...prevState,
        inventory: [...prevState.inventory],
        flags: { ...prevState.flags },
        eventLedger: [...prevState.eventLedger],
        clocks: { ...prevState.clocks }
    };

    // 1. Clocks 업데이트
    newState.clocks.win = (newState.clocks.win || 0) + (clocks.track_win || 0);
    newState.clocks.lose = (newState.clocks.lose || 0) + (clocks.track_lose || 0);

    // 2. Flags 패치
    if (patch.addFlags) {
        patch.addFlags.forEach(flag => {
            if (flag) newState.flags[flag] = true;
        });
    }
    if (patch.removeFlags) {
        patch.removeFlags.forEach(flag => {
            delete newState.flags[flag];
        });
    }

    // 3. Inventory 패치
    if (patch.addItems) {
        patch.addItems.forEach(item => {
            if (item && !newState.inventory.includes(item)) {
                newState.inventory.push(item);
            }
        });
    }
    if (patch.removeItems) {
        newState.inventory = newState.inventory.filter(item => !patch.removeItems.includes(item));
    }

    // 4. Location 업데이트
    if (patch.locationChange) {
        newState.location = patch.locationChange;
    }

    // 5. Meta & Turn progression
    newState.turnCount = (prevState.turnCount || 0) + 1;
    if (responseData.turnSummary) {
        newState.eventLedger.push(responseData.turnSummary);
    }
    newState.tensionLevel = responseData.tensionLevel || prevState.tensionLevel || 1;
    newState.isEnding = responseData.isEnding || false;

    // 6. Hard Ending Enforcement
    if (newState.clocks.win >= HARD_ENDING_THRESHOLD) {
        newState.isEnding = true;
        // Optionally mark the type if not already set
        if (!responseData.endingType) newState.isWinEnding = true;
    }
    if (newState.clocks.lose >= HARD_ENDING_THRESHOLD) {
        newState.isEnding = true;
        if (!responseData.endingType) newState.isLoseEnding = true;
    }

    return newState;
}

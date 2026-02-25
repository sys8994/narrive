/**
 * App.js — Application orchestrator
 * @module app/App
 *
 * Initializes all modules, wires events, manages app-level state transitions.
 * App states: 'idle' | 'setup' | 'playing'
 */

import { createStore } from '../core/store.js';
import { createLayout } from '../ui/layout.js';
import { initToast, showToast } from '../ui/components/Toast.js';
import { openSettingsModal } from '../ui/components/SettingsModal.js';
import { renderSaveList } from '../ui/components/SaveList.js';
import { renderSetupWizard } from '../ui/components/SetupWizard.js';
import { renderStoryView, renderStoryError, updateThemeVisuals } from '../ui/components/StoryView.js';
import { renderTreeNav } from '../ui/components/TreeNav.js';
import { renderJsonViewer } from '../ui/components/JsonViewer.js';
import { renderHomeView } from '../ui/components/HomeView.js';
import { renderAuthView } from '../ui/components/AuthView.js';
import { getBrandIconHtml } from '../ui/components/BrandIcon.js';

import * as sessionManager from '../core/sessionManager.js';
import * as gameEngine from '../core/gameEngine.js';
import { initSeedPool } from '../core/seedManager.js';
import { getSettings, hasAnyApiKey } from '../llm/apiClient.js';


/** @type {ReturnType<typeof createStore>} */
let store;

/** @type {ReturnType<typeof createLayout>} */
let els;

/**
 * Initialize the application.
 */
export async function init() {
    // Create reactive store
    store = createStore({
        appState: 'idle',      // 'idle' | 'auth' | 'setup' | 'playing'
        sessionList: [],
        activeSessionId: null,
        jsonViewEnabled: false,
    });

    // Mount layout
    els = createLayout({
        onTitleClick: handleHome
    });


    // Init toast
    initToast(els.toastContainer);

    // Wire settings button
    els.btnSettings.addEventListener('click', () => {
        openSettingsModal(els.modalRoot, () => {
            // Refresh save list in case API key state changed
            refreshSaveList();
        });
    });

    // Wire JSON view button
    els.btnToggleJson.addEventListener('click', () => {
        const { jsonViewEnabled } = store.getState();
        const nextState = !jsonViewEnabled;
        store.setState({ jsonViewEnabled: nextState });

        // Toggle UI
        els.btnToggleJson.classList.toggle('icon-btn--active', nextState);
        els.storyContainer.classList.toggle('hidden', nextState);
        els.jsonViewerContainer.classList.toggle('hidden', !nextState);

        if (nextState) {
            const session = sessionManager.getCurrentSession();
            renderJsonViewer(els.jsonViewerContainer, session);
        }
    });

    // Subscribe to store changes → re-render affected components
    store.subscribe((state) => {
        // Re-render is handled via explicit calls for now (MVP simplicity)
    });

    // Load sessions index
    await refreshSaveList();

    // Initialize seed pool for setup wizard
    initSeedPool();

    // Check for API keys
    if (!hasAnyApiKey()) {
        store.setState({ appState: 'auth' });
        // Hide main UI parts during auth if needed
        els.header.classList.add('hidden');
        renderAuthView(els.storyContainer, () => {
            els.header.classList.remove('hidden');
            handleStart();
        });
    } else {
        handleStart();
    }
}

/**
 * Common entry point after auth is confirmed.
 */
function handleStart() {
    handleHome();
}
/**
 * Refresh the session list from storage.
 */
async function refreshSaveList() {
    const sessions = await sessionManager.listSessions();
    store.setState({ sessionList: sessions });

    renderSaveList({
        headerEl: els.savelistHeader,
        bodyEl: els.savelistBody,
        sessions,
        activeSessionId: store.getState().activeSessionId,
        onNewGame: handleNewGame,
        onLoadSession: handleLoadSession,
        onDeleteSession: handleDeleteSession,
    });
}

/**
 * Apply theme colors from session data.
 */
function applyTheme(session) {
    if (!session || !session.themeColor) return;
    const { initialThemeColor, accentColor } = session.themeColor;

    if (initialThemeColor) {
        document.body.style.backgroundColor = initialThemeColor;
        document.documentElement.style.setProperty('--bg-primary', initialThemeColor);
        // Derive secondary/panel colors for sidebars + header
        document.documentElement.style.setProperty('--bg-secondary', blendColor(initialThemeColor, 0.08));
        document.documentElement.style.setProperty('--bg-panel', blendColor(initialThemeColor, 0.06));
    }
    if (accentColor) {
        document.documentElement.style.setProperty('--accent', accentColor);
        document.documentElement.style.setProperty('--accent-hover', accentColor);
        document.documentElement.style.setProperty('--accent-glow', accentColor + '40');
        document.documentElement.style.setProperty('--border', accentColor + '1a');
        document.documentElement.style.setProperty('--border-hover', accentColor + '4d');
    }
}

/**
 * Derive a brighter variant of a hex color for secondary surfaces.
 */
export function blendColor(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const nr = Math.min(255, Math.round(r + 255 * amount));
    const ng = Math.min(255, Math.round(g + 255 * amount));
    const nb = Math.min(255, Math.round(b + 255 * amount));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/**
 * Reset theme to defaults.
 */
function resetTheme() {
    document.body.style.backgroundColor = '';
    const props = ['--bg-primary', '--bg-secondary', '--bg-panel', '--accent', '--accent-hover', '--accent-glow', '--border', '--border-hover'];
    props.forEach(p => document.documentElement.style.removeProperty(p));
}

// ─── Handlers ──────────────────────────────────────────────────────


async function handleHome() {
    els.closeAllPanels();
    resetTheme();

    // Get last active session ID for the "Current" section
    const lastActiveId = await sessionManager.getActiveSessionId();
    const sessions = await sessionManager.listSessions();

    store.setState({ appState: 'home', activeSessionId: null });

    renderHomeView({
        container: els.storyContainer,
        sessions,
        lastActiveId,
        onNewGame: handleNewGame,
        onLoadSession: handleLoadSession,
        onDeleteSession: handleDeleteSession,
    });

    renderTreeNav({ container: els.treeContent, session: null, onNodeClick: () => { } });
}

function handleNewGame() {

    els.closeAllPanels();
    store.setState({ appState: 'setup', activeSessionId: null });
    resetTheme();

    renderSetupWizard({
        container: els.storyContainer,
        onComplete: handleSetupComplete,
        onCancel: () => {
            store.setState({ appState: 'idle' });
            renderStoryView({ container: els.storyContainer, session: null });
        },
    });

    renderTreeNav({ container: els.treeContent, session: null, onNodeClick: () => { } });
}

async function handleSetupComplete({ title, publicWorld, hiddenPlot, openingText, entryLabel, initialThemeColor, climaxThemeColor, accentColor, worldSchema }) {
    const settings = getSettings();

    // Create session
    const session = gameEngine.createSession({
        title,
        publicWorld,
        hiddenPlot,
        openingText,
        entryLabel,
        initialThemeColor,
        climaxThemeColor,
        accentColor,
        model: settings.model,
        temperature: settings.temperature,
        worldSchema,
    });


    sessionManager.setCurrentSession(session);
    store.setState({ appState: 'playing', activeSessionId: session.id });

    // Apply theme
    applyTheme(session);

    // Generate initial options (Turn 1) in background. 
    // We stay at Turn 0 (Prologue) rendered normally in StoryView.
    renderCurrentNode();
    await gameEngine.generateInitialOptions(session);

    showToast('새로운 모험이 시작됩니다!', 'success');
}

async function handleLoadSession(sessionId) {
    els.closeAllPanels(); // close sidebar overlay before switching
    const session = await sessionManager.loadSession(sessionId);
    if (!session) {
        showToast('세션을 불러올 수 없습니다.', 'error');
        return;
    }

    store.setState({ appState: 'playing', activeSessionId: session.id });
    applyTheme(session);

    // Sync background color to the current node's narrative phase
    const currentNode = session.nodesById[session.currentNodeId];
    if (currentNode) {
        updateThemeVisuals(session, currentNode.stateSnapshot);
    }

    renderCurrentNode(true); // instant — loading existing session
    await refreshSaveList();
    showToast('세션을 불러왔습니다.', 'info');
}

async function handleDeleteSession(sessionId) {
    await sessionManager.deleteSession(sessionId);
    showToast('세션이 삭제되었습니다.', 'info');

    if (store.getState().activeSessionId === sessionId) {
        handleHome();
    }


    await refreshSaveList();
}

async function handleOptionSelect(nodeId, optionId, customText) {
    const session = sessionManager.getCurrentSession();
    if (!session) return;

    if (session.currentNodeId !== nodeId) {
        // Rollback state computationally
        gameEngine.rollbackToNode(session, nodeId);

        // Visually remove future DOM nodes immediately so the user sees the timeline get clipped
        const turnEls = Array.from(els.storyContainer.querySelectorAll('.story-turn'));
        let found = false;
        turnEls.forEach(el => {
            if (found) el.remove();
            if (el.dataset.nodeId === nodeId) found = true;
        });

        const ending = els.storyContainer.querySelector('.ending-container');
        if (ending) ending.remove();
    }

    // Fix #4: Don't replace content — StoryView handles inline loading
    const result = await gameEngine.progressTurn(session, optionId, customText);

    if (!result.ok) {
        renderStoryError(els.storyContainer, result.error || 'LLM 호출 실패', () => {
            handleOptionSelect(nodeId, optionId, customText);
        });
        return;
    }

    if (result.reused) {
        showToast('이전에 탐험한 경로입니다.', 'info');
    }

    sessionManager.scheduleSave();
    renderCurrentNode(); // streaming enabled for new content
}

function handleTreeNodeClick(nodeId) {
    const session = sessionManager.getCurrentSession();
    if (!session) return;

    // Check if the node is already rendered in the DOM
    const turnEl = els.storyContainer.querySelector(`.story-turn[data-node-id="${nodeId}"]`);
    if (turnEl) {
        // Sync background color FIRST for visual feedback
        const targetNode = session.nodesById[nodeId];
        if (targetNode) {
            updateThemeVisuals(session, targetNode.stateSnapshot);
        }
        // Just scroll there
        turnEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    // Rollback game state computationally
    const result = gameEngine.rollbackToNode(session, nodeId);
    if (!result.ok) {
        showToast('해당 노드로 이동할 수 없습니다.', 'error');
        return;
    }

    // Sync background color to match the target node's narrative phase
    const targetNode = session.nodesById[nodeId];
    if (targetNode) {
        updateThemeVisuals(session, targetNode.stateSnapshot);
    }

    sessionManager.scheduleSave();
    renderCurrentNode(true); // instant — no streaming on rollback
}

/**
 * Render the current node + tree based on active session.
 * @param {boolean} [skipStreaming=false] — if true, show text instantly
 */
function renderCurrentNode(skipStreaming = false) {
    const session = sessionManager.getCurrentSession();
    if (!session) return;

    renderStoryView({
        container: els.storyContainer,
        session,
        onOptionSelect: handleOptionSelect,
        skipStreaming,
    });

    renderTreeNav({
        container: els.treeContent,
        session,
        onNodeClick: handleTreeNodeClick,
    });

    // Update JSON viewer if enabled
    if (store.getState().jsonViewEnabled) {
        renderJsonViewer(els.jsonViewerContainer, session);
    }

    // Fire-and-forget: prefetch all option responses in background
    triggerPrefetch();
}

/**
 * Prefetch LLM responses for all options on the current node.
 * Runs in background — errors are logged but never block the UI.
 */
function triggerPrefetch() {
    const session = sessionManager.getCurrentSession();
    if (!session) return;

    gameEngine.prefetchAllOptions(session)
        .then(() => {
            // Save prefetched nodes to persistent storage
            sessionManager.scheduleSave();
        })
        .catch((err) => {
            console.warn('[Prefetch] Background prefetch error:', err);
        });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

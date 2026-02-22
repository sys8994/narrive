/**
 * sessionManager.js — High-level session lifecycle manager
 * @module core/sessionManager
 *
 * Manages: create, load, save (with debounce), list, delete sessions.
 * Works with the global app store for current session state.
 */

import * as repo from '../storage/sessionRepo.js';
import { now } from './time.js';

/** @type {Object|null} current session blob */
let currentSession = null;

/** @type {number|null} debounce timer */
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 2000;

/**
 * Get the current session reference (mutable).
 * @returns {Object|null}
 */
export function getCurrentSession() {
    return currentSession;
}

/**
 * Set the current session (e.g. after creation or load).
 * @param {Object|null} session
 */
export async function setCurrentSession(session) {
    currentSession = session;
    if (session) {
        await repo.setActiveSessionId(session.id);
    } else {
        await repo.setActiveSessionId(null);
    }
}


/**
 * List all saved sessions.
 * @returns {Promise<Array>}
 */
export async function listSessions() {
    return repo.listSessions();
}

/**
 * Load a session by ID and set as current.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function loadSession(id) {
    const blob = await repo.getSession(id);
    if (blob) {
        currentSession = blob;
        await repo.setActiveSessionId(id);
    }
    return blob;
}


/**
 * Save the current session immediately.
 */
export async function saveCurrentSession() {
    if (!currentSession) return;
    currentSession.updatedAt = now();
    await repo.saveSession(currentSession);
}

/**
 * Schedule an auto-save (debounced).
 */
export function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        await saveCurrentSession();
        saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
}

/**
 * Delete a session by ID.
 * If it was the current session, clear current.
 * @param {string} id
 */
export async function deleteSession(id) {
    await repo.deleteSession(id);
    if (currentSession && currentSession.id === id) {
        currentSession = null;
    }
}

/**
 * Get the last active session ID from storage.
 * @returns {Promise<string|null>}
 */
export async function getActiveSessionId() {
    return repo.getActiveSessionId();
}


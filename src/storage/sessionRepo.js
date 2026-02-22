/**
 * sessionRepo.js — Session persistence (IndexedDB KV)
 * @module storage/sessionRepo
 *
 * Keys:
 *   "index:sessions"  → { [sessionId]: SessionMeta }
 *   "session:<id>"     → GameSessionBlob
 */

import * as kv from './kvdb.js';

const INDEX_KEY = 'index:sessions';
const ACTIVE_SESSION_KEY = 'active:sessionId';


/**
 * Get the sessions index map, creating it if missing.
 * @returns {Promise<Object.<string, {id:string, title:string, updatedAt:number}>>}
 */
async function getIndex() {
    return (await kv.get(INDEX_KEY)) || {};
}

/**
 * List all session metas, sorted by updatedAt desc.
 * @returns {Promise<Array<{id:string, title:string, updatedAt:number}>>}
 */
export async function listSessions() {
    const index = await getIndex();
    return Object.values(index).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a full session blob by ID.
 * @param {string} id
 * @returns {Promise<Object|undefined>}
 */
export async function getSession(id) {
    return kv.get(`session:${id}`);
}

/**
 * Save a session blob and update the index.
 * @param {Object} blob — full GameSessionBlob
 */
export async function saveSession(blob) {
    // Update index entry
    const index = await getIndex();
    index[blob.id] = {
        id: blob.id,
        title: blob.title,
        createdAt: blob.createdAt,
        updatedAt: blob.updatedAt,
    };
    await kv.put(INDEX_KEY, index);
    await kv.put(`session:${blob.id}`, blob);
}

/**
 * Delete a session and remove from index.
 * @param {string} id
 */
export async function deleteSession(id) {
    const index = await getIndex();
    delete index[id];
    await kv.put(INDEX_KEY, index);
    await kv.del(`session:${id}`);
}
/**
 * Get the ID of the last active session.
 * @returns {Promise<string|null>}
 */
export async function getActiveSessionId() {
    return (await kv.get(ACTIVE_SESSION_KEY)) || null;
}

/**
 * Set the ID of the last active session.
 * @param {string|null} id
 */
export async function setActiveSessionId(id) {
    if (id) {
        await kv.put(ACTIVE_SESSION_KEY, id);
    } else {
        await kv.del(ACTIVE_SESSION_KEY);
    }
}

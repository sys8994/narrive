/**
 * kvdb.js — IndexedDB Key-Value Store wrapper
 * @module storage/kvdb
 *
 * DB: "keyval-store", version 1, single object store "keyval"
 */

const DB_NAME = 'keyval-store';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

/**
 * Open (or reuse) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

/**
 * Run a transaction on the KV store.
 * @param {'readonly'|'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest} callback
 * @returns {Promise<any>}
 */
async function withStore(mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a value by key.
 * @param {string} key
 * @returns {Promise<any>}
 */
export function get(key) {
    return withStore('readonly', (store) => store.get(key));
}

/**
 * Put a value at key.
 * @param {string} key
 * @param {any} value — must be structured-clone compatible
 * @returns {Promise<void>}
 */
export function put(key, value) {
    return withStore('readwrite', (store) => store.put(value, key));
}

/**
 * Delete a key.
 * @param {string} key
 * @returns {Promise<void>}
 */
export function del(key) {
    return withStore('readwrite', (store) => store.delete(key));
}

/**
 * Get all keys in the store.
 * @returns {Promise<string[]>}
 */
export function keys() {
    return withStore('readonly', (store) => store.getAllKeys());
}

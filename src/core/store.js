/**
 * store.js — Simple pub-sub reactive state store
 * @module core/store
 *
 * Usage:
 *   const store = createStore({ count: 0 });
 *   store.subscribe((state) => console.log(state));
 *   store.setState({ count: 1 });
 */

/**
 * Create a reactive store with pub-sub.
 * @param {Object} initialState
 * @returns {{ getState: () => Object, setState: (partial: Object) => void, subscribe: (fn: Function) => Function }}
 */
export function createStore(initialState = {}) {
    let state = { ...initialState };
    const listeners = new Set();

    function getState() {
        return state;
    }

    function setState(partial) {
        state = { ...state, ...partial };
        listeners.forEach((fn) => {
            try { fn(state); } catch (e) { console.error('[Store] listener error:', e); }
        });
    }

    /**
     * Subscribe to state changes.
     * @param {Function} fn - called with new state on every setState
     * @returns {Function} unsubscribe function
     */
    function subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    return { getState, setState, subscribe };
}

/**
 * time.js — Timestamp utilities
 * @module core/time
 */

/** Current Unix timestamp in milliseconds */
export function now() {
    return Date.now();
}

/** Format a timestamp to a short localized string */
export function formatDate(ts) {
    return new Date(ts).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * id.js — UUID generator
 * @module core/id
 */

/** Generate a UUID v4 string */
export function generateId() {
  return crypto.randomUUID();
}

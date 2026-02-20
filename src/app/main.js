/**
 * main.js — Application entry point
 * @module app/main
 */

import { init } from './App.js';

document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
        console.error('[Narrive] Initialization failed:', err);
    });
});

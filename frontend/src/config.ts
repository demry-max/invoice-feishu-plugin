/**
 * Runtime configuration
 * Webpack: __API_BASE_URL__ / __FEISHU_MODE__ are replaced by DefinePlugin
 * Vite: falls back to defaults (Vite replaces import.meta.env in its own pipeline)
 */

/* eslint-disable no-var */
declare const __API_BASE_URL__: string | undefined;
declare const __FEISHU_MODE__: string | undefined;

// For Vite: read from globalThis where vite-env injects values
// We set these in a script tag or let Vite handle them
let _apiBaseUrl = 'http://localhost:3000';
let _feishuMode = 'mock';

try {
  // Webpack DefinePlugin will replace these at compile time
  if (typeof __API_BASE_URL__ !== 'undefined') _apiBaseUrl = __API_BASE_URL__;
} catch { /* not in webpack */ }

try {
  if (typeof __FEISHU_MODE__ !== 'undefined') _feishuMode = __FEISHU_MODE__;
} catch { /* not in webpack */ }

export const API_BASE_URL = _apiBaseUrl;
export const FEISHU_MODE = _feishuMode;

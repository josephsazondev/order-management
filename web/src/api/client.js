// Single API entry point used by every page. Picks the adapter based on VITE_API_MODE
// and attaches the current session's email as the call context.

import { API_MODE } from '../config.js';
import { mockCall, resetMockDb } from './mockAdapter.js';
import { appsScriptCall } from './appsScriptAdapter.js';

const adapter = API_MODE === 'appsscript' ? appsScriptCall : mockCall;

let currentEmail = null;

export function setSessionEmail(email) {
  currentEmail = email;
}

// Returns { ok, data } or { ok:false, error }. Throws on { ok:false } via callJSON below
// when callers prefer exceptions.
export async function call(action, payload) {
  return adapter(action, payload, { email: currentEmail });
}

// Convenience wrapper: returns data or throws.
export async function callOrThrow(action, payload) {
  const res = await call(action, payload);
  if (!res.ok) throw new Error(res.error || 'Request failed');
  return res.data;
}

export { API_MODE, resetMockDb };

// Talks to the deployed Google Apps Script web app.
//
// We POST JSON as text/plain so the browser does NOT send a CORS preflight (OPTIONS),
// which Apps Script web apps cannot answer. The server reads e.postData.contents.
//
// NOTE: in production the backend derives the caller's role from their Google session
// (Session.getActiveUser().getEmail()), so the `email` we pass is advisory only and is
// NOT trusted for authorization — the server ignores it for role decisions.

import { APPSCRIPT_URL } from '../config.js';

export async function appsScriptCall(action, payload, ctx) {
  if (!APPSCRIPT_URL) {
    return { ok: false, error: 'VITE_APPSCRIPT_URL is not set. See web/.env.example and apps-script/DEPLOY.md.' };
  }
  try {
    const res = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload: payload || {}, email: ctx && ctx.email }),
      redirect: 'follow',
    });
    const json = await res.json();
    return json; // { ok, data } | { ok:false, error }
  } catch (e) {
    return { ok: false, error: 'Network error: ' + (e.message || String(e)) };
  }
}

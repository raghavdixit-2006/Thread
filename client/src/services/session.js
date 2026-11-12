// services/session.js - owns the in-memory access token + single-flight silent refresh.
// The refresh token lives in an httpOnly cookie (server-scoped). Queued requests wait
// on one refresh promise, then replay with the new token (requirement PDF objective).
import apiClient from './apiClient.js';

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function onSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(token, user) {
  listeners.forEach((fn) => fn(token, user));
}

/** update memory + notify react layer (user must be a clean identity object) */
export function setSession(token, user) {
  accessToken = token || null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('thread.sessionEnded'); // fresh session: the notice is stale
    } catch {
      // storage unavailable
    }
  }
  if (token) {
    // normalize: malformed/absent identity recovers from /me; never emit a token as the user.
    // emit synchronously for a valid identity so guards (RequireAuth) see the session the
    // moment the caller navigates - otherwise login deep links race the auth route guard.
    if (user && typeof user === 'object') {
      emit(accessToken, user);
      return;
    }
    resolveIdentity(user).then((identity) => {
      if (identity) emit(accessToken, identity);
      else {
        accessToken = null;
        emit(null, null);
      }
    });
  } else emit(null, null);
}

/** guard: the UI needs a real user object; a malformed identity falls back to /me */
async function resolveIdentity(user) {
  if (user && typeof user === 'object') return user;
  try {
    const res = await apiClient.get('/api/auth/me');
    const identity = res.data && res.data.data;
    if (identity && typeof identity === 'object') return identity;
  } catch {
    // a stale token here surfaces as a session clear through the caller
  }
  return undefined;
}

export const getAccessToken = () => accessToken;

async function doRefresh() {
  try {
    const res = await apiClient.post('/api/auth/refresh', {}, { _skipAuth: true });
    const data = (res.data && res.data.data) || {};
    const token = data.accessToken;
    if (!token) throw new Error('no access token in refresh response');
    accessToken = token; // set first so the /me fallback goes out authenticated
    const user = await resolveIdentity(data.user);
    emit(token, user);
    return token;
  } catch (err) {
    const wasSessioned = Boolean(accessToken); // a mid-session failure, not a guest boot
    accessToken = null;
    if (wasSessioned && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem('thread.sessionEnded', '1'); // /auth shows a gentle notice
      } catch {
        // storage unavailable (private mode) - the silent clear is still graceful
      }
    }
    emit(null, null);
    throw err;
  } finally {
    refreshPromise = null;
  }
}

/** one shared refresh per burst (double-401 storm becomes one network call) */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = doRefresh();
  }
  return refreshPromise;
}

/** hard clear - used by the logout flow (server already revoked the refresh cookie) */
export function clearSession() {
  accessToken = null;
  emit(null, null);
}

/** identity-only update (profile rename) - keeps the current access token */
export function updateUser(user) {
  emit(accessToken, user);
}

/** called at app boot: resolves session if the refresh cookie exists */
export function bootstrapSession() {
  return refreshSession().catch(() => null);
}

/** google callback one-time code exchange mirrors login */
export async function exchangeOauthCode(code) {
  const res = await apiClient.post('/api/auth/google/complete', { code }, { _skipAuth: true });
  const { accessToken: token, user } = res.data.data;
  setSession(token, user);
  return user;
}

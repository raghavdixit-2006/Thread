// services/apiClient.js - axios instance + queued silent-refresh interceptor.
// Every 401 waits on the same single-flight refresh (services/session.js) and then
// replays, so a dashboard firing several queries at once never loses requests.
import axios from 'axios';
import { getAccessToken, refreshSession } from './session.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // refresh cookie
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  config._authToken = token || null; // record which token this request used
  if (token && !config._skipAuth) config.headers.Authorization = `Bearer ${token}`;

  // One idempotency key per placement, generated before the first send and kept on the
  // config so the 401 replay reuses it. The server returns the original order for a replay
  // instead of reserving stock twice.
  if (config.url === '/api/orders' && config.method === 'post' && config.data && typeof config.data === 'object') {
    if (!config.data.idempotencyKey) {
      config.data.idempotencyKey =
        globalThis.crypto?.randomUUID?.() || `Key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const isAuthEndpoint = typeof config.url === 'string' && config.url.startsWith('/api/auth/');

    if (status === 401 && !config._skipAuth && !config._retried && !isAuthEndpoint) {
      config._retried = true; // a replay that still 401s must not loop
      try {
        // If another request already rotated the token while this 401 was in flight,
        // just replay. Otherwise join the shared refresh promise: parallel admin
        // queries all wait for ONE refresh instead of being dropped with 401.
        const current = getAccessToken();
        if (!current || current === config._authToken) await refreshSession();
        return api.request(config); // request interceptor attaches the fresh token
      } catch {
        // refresh failed - session.js has already emitted the clear; reject original 401
      }
    }

    const payload = error.response?.data;
    const normalized = {
      status: status || 0,
      code: payload?.error?.code || 'NETWORK_ERROR',
      message: payload?.error?.message || (status === 0 ? 'Network error - is the API running?' : 'Request failed'),
      details: payload?.error?.details || null,
    };
    error.api = normalized;
    return Promise.reject(error);
  },
);

export default api;

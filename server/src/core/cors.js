// core/cors.js - CORS whitelist for the storefront and admin origins.
// Owner: Rahul (@rahulgheek)
//
// Allowed origins come from CORS_ORIGINS (JSON array or comma-separated list).
// Adding the deployed storefront URL is an env change only, no code change:
//   CORS_ORIGINS=["http://localhost:5173","https://your-storefront.example.com"]
// See docs/CORS.md for the full checklist.
import cors from 'cors';
import { env } from './env.js';

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Normalize one origin: trim, drop a trailing slash, lowercase the scheme/host. */
export function normalizeOrigin(origin) {
  return String(origin || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Parse the CORS_ORIGINS env value. Accepts a JSON array or a comma-separated list so
 * pasting a single deployed URL works without editing JSON syntax.
 */
export function parseOrigins(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  let list;
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  } else {
    list = raw.split(',');
  }
  return [...new Set(list.map(normalizeOrigin).filter(Boolean))];
}

/** A wildcard is only honoured outside production: cookies + wildcard is unsafe. */
export function wildcardAllowed() {
  return env.CORS_ORIGINS.includes('*') && env.NODE_ENV !== 'production';
}

/** True when the browser origin may call the API. A missing Origin (curl, same-origin) is fine. */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (wildcardAllowed()) return true;
  const candidate = normalizeOrigin(origin);
  if (env.CORS_ORIGINS.includes(candidate)) return true;
  // dev convenience: any localhost/127.0.0.1 port, never in production
  return env.NODE_ENV !== 'production' && LOCAL_ORIGIN.test(candidate);
}

/**
 * Express middleware. The whitelist callback throws CORS_REJECTED, which the error
 * boundary in core/app.js maps to a 403 JSON envelope.
 */
export function corsMiddleware() {
  return cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('CORS_REJECTED'));
    },
    credentials: true, // the refresh token lives in an httpOnly cookie on /api/auth
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key', 'X-Requested-With'],
    exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600, // cache preflight for 10 minutes
    optionsSuccessStatus: 204,
  });
}

// modules/auth/jwt.js - access tokens (JWT) + opaque refresh tokens with hashed rotation.
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../core/env.js';

export const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
export const REFRESH_COOKIE = 'thread_rt';

const hash = (token) => createHash('sha256').update(token).digest('hex');

export function signAccess(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, verified: user.isEmailVerified }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SEC,
  });
}

// opaque refresh tokens (random base64url, hashed at rest, rotated server-side).
// revocation and rotation happen against the user's doc in authDal - never parse tokens here.

export function verifyAccess(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    return null;
  }
}

export function issueRefreshToken() {
  const token = randomBytes(48).toString('base64url');
  const family = randomBytes(12).toString('base64url');
  return { token, family, tokenHash: hash(token), expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000) };
}

export const hashRefresh = hash;

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

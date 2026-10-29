// modules/auth/google.js - Google OAuth 2.0 authorization-code flow.
// State lives in Redis (60-600s, single-use) binding the browser session to a redirect path.
import { randomBytes } from 'node:crypto';
import { googleEnabled as enabled, env } from '../../core/env.js';
import { getRedis } from '../../core/redis.js';
import { badRequest, serviceUnavailable } from '../../core/httpError.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const stateKey = (s) => `oa:state:${s}`;
const oneTimeKey = (c) => `oa:code:${c}`;

export const googleEnabled = enabled;

export async function buildAuthUrl(redirectPath) {
  if (!googleEnabled) throw serviceUnavailable('Google sign-in is not configured');
  const state = randomBytes(24).toString('base64url');
  await getRedis().set(stateKey(state), redirectPath, 'EX', 600);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/** Consume the state param -> bound redirect. Single use (Google retry safety). */
export async function consumeState(state) {
  const value = await getRedis().getdel(stateKey(state));
  if (!value) throw badRequest('Sign-in session expired. Please try again.');
  return value || '/';
}

export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw badRequest('Google sign-in failed (token exchange)');
  const tokens = await res.json();
  const profileRes = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw badRequest('Google sign-in failed (profile fetch)');
  const profile = await profileRes.json();
  if (!profile.email || profile.email_verified === false) {
    throw badRequest('Google account email is not verified');
  }
  return { googleId: profile.sub, email: String(profile.email).toLowerCase(), name: profile.name || 'Google user', picture: profile.picture || '' };
}

/** Store a one-time code that carries the fresh access token for 60s. */
export async function createOneTimeCode(accessToken) {
  const code = randomBytes(24).toString('base64url');
  await getRedis().set(oneTimeKey(code), accessToken, 'EX', 60);
  return code;
}

export async function consumeOneTimeCode(code) {
  const access = await getRedis().getdel(oneTimeKey(code));
  if (!access) throw badRequest('Sign-in link expired. Please sign in again.');
  return access;
}

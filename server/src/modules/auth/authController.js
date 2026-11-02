// modules/auth/authController.js - HTTP transport only (no business logic here).
import { ok, created } from '../../utils/response.js';
import { env } from '../../core/env.js';
import * as service from './authService.js';
import * as google from './google.js';
import * as jwt from './jwt.js';
import { badRequest } from '../../core/httpError.js';

const accessTokenFrom = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

export async function register(req, res) {
  const result = await service.register(req.data.body, req);
  return created(res, result);
}

export async function login(req, res) {
  const result = await service.login(req.data.body, req);
  if (result.refreshToken) jwt.setRefreshCookie(res, result.refreshToken);
  const { refreshToken, ...payload } = result;
  return ok(res, payload);
}

// staff portal entry: same cookie mechanics, different endpoint
export async function adminLogin(req, res) {
  const result = await service.adminLogin(req.data.body, req);
  if (result.refreshToken) jwt.setRefreshCookie(res, result.refreshToken);
  const { refreshToken, ...payload } = result;
  return ok(res, payload);
}

export async function resendOtp(req, res) {
  const result = await service.resendOtp(req.data.body, req);
  return ok(res, result);
}

export async function verifyOtp(req, res) {
  const result = await service.verifyOtpFor(req.data.body, req);
  if (result.refreshToken) jwt.setRefreshCookie(res, result.refreshToken);
  const { refreshToken, ...payload } = result;
  return ok(res, payload);
}

export async function completeReset(req, res) {
  const result = await service.completeReset(req.data.body);
  if (result.refreshToken) jwt.setRefreshCookie(res, result.refreshToken);
  return ok(res, result);
}

export async function me(req, res) {
  return ok(res, await service.me(req.user.id));
}

export async function updateProfile(req, res) {
  return ok(res, await service.updateProfile(req.data.body, req.user.id));
}

export async function logout(req, res) {
  const cookie = req.cookies?.[jwt.REFRESH_COOKIE];
  const result = await service.logout(cookie, req, req.user?.id);
  jwt.clearRefreshCookie(res);
  return ok(res, result);
}

export async function sessions(req, res) {
  return ok(res, await service.sessions(req.user.id));
}

// silent refresh: rotates the refresh cookie + mints a new access token (no body, cookie-only)
export async function refresh(req, res) {
  const result = await service.refreshSession(req.cookies?.[jwt.REFRESH_COOKIE]);
  jwt.setRefreshCookie(res, result.refreshToken);
  const { refreshToken, ...payload } = result;
  return ok(res, payload);
}

// ---------------- Google OAuth -------------------------

export async function googleUrl(req, res) {
  const url = await service.google.buildAuthUrl(req.data.query.redirect);
  return ok(res, { url });
}

export async function googleCallback(req, res) {
  // Redirect-only endpoint: create session cookie via one-time code, bounce to SPA.
  const { code, state } = req.query;
  const redirectPath = await google.consumeState(state);
  const target = new URL(redirectPath || '/', env.CLIENT_URL);
  try {
    if (!code) throw new Error('missing code');
    const profile = await google.exchangeCode(code);
    const user = await service.upsertGoogleUser(profile);
    const session = await service.issueSession(user);
    jwt.setRefreshCookie(res, session.refreshToken);
    const oneTime = await google.createOneTimeCode(session.accessToken);
    target.searchParams.set('oauth', oneTime);
  } catch (err) {
    target.searchParams.set('oauthError', encodeURIComponent(err.message || 'Sign-in failed'));
  }
  return res.redirect(302, target.toString());
}

export async function googleComplete(req, res) {
  const accessToken = await google.consumeOneTimeCode(req.data.body.code);
  const result = await service.completeGoogle(accessToken);
  jwt.setRefreshCookie(res, result.refreshToken);
  const { refreshToken, ...payload } = result;
  return ok(res, payload);
}

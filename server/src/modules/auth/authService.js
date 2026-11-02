// modules/auth/authService.js - business logic (no HTTP, no DB objects returned to HTTP).
import bcrypt from '@node-rs/bcrypt';
import { createHash } from 'node:crypto';
import { publish, topics } from '../../core/eventBus.js';
import { unauthorized, badRequest, conflict, unprocessable, forbidden, HttpError } from '../../core/httpError.js';
import { logger } from '../../core/logger.js';
import { createOtp, verifyOtp, assertPurpose, hasPendingOtp } from './otp.js';
import { emailService } from '../emails/emailService.js';
import * as dal from './authDal.js';
import * as jwt from './jwt.js';

const BCRYPT_COST = 10;
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const hashPassword = (plain) => bcrypt.hash(plain, { cost: BCRYPT_COST });

function publicUser(u) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    role: u.role,
    isEmailVerified: u.isEmailVerified,
    authProvider: u.authProvider,
    avatarUrl: u.avatarUrl || '',
    addresses: (u.addresses || []).map((a) => (a && typeof a.toObject === 'function' ? a.toObject() : { ...a })),
    termsVersion: u.termsVersion,
    termsAcceptedAt: u.termsAcceptedAt,
    createdAt: u.createdAt,
  };
}

const ip = (req) => req.ip || 'unknown';

// ---------------------------------------------------------------------------
// Registration + OTP verification
// ---------------------------------------------------------------------------

export async function register(input, req) {
  const { name, email, password, accepted, termsVersion } = input;
  const existing = await dal.findByEmail(email, { withPassword: false });
  if (existing) {
    if (!existing.isEmailVerified) {
      // re-registration attempt before verification: issue a fresh OTP
      const code = await createOtp(email, 'verify', ip(req));
      await sendOtpEmail(email, existing.name, code, 'verify your THREAD account');
      return { status: 'otp-sent', email, requiresOtp: true, purpose: 'verify' };
    }
    throw conflict('An account with this email already exists. Try signing in.');
  }

  const passwordHash = await hashPassword(password);
  await dal.create({ name, email, passwordHash, role: 'user', authProvider: 'password', isEmailVerified: false, termsVersion: termsVersion || '1.0.0', termsAcceptedAt: accepted ? new Date() : null });

  const code = await createOtp(email, 'verify', ip(req));
  await sendOtpEmail(email, name, code, 'verify your THREAD account');

  publish(topics.USER_REGISTERED, { email, name });
  return { status: 'otp-sent', email, requiresOtp: true, purpose: 'verify' };
}

export async function resendOtp({ email, purpose }, req) {
  assertPurpose(purpose);
  if (purpose === 'reset' && !(await dal.findByEmail(email, { withPassword: false }))) {
    throw badRequest('No account with this email');
  }
  const user = await dal.findByEmail(email, { withPassword: false });
  const code = await createOtp(email, purpose, ip(req));
  const name = user?.name || 'there';
  await sendOtpEmail(email, name, code, purpose === 'verify' ? 'verify your THREAD account' : 'reset your THREAD password');
  return { status: 'otp-sent', email, purpose };
}

export async function verifyOtpFor({ email, purpose, code }, req) {
  assertPurpose(purpose);
  await verifyOtp(email, purpose, code);

  if (purpose === 'verify') {
    const user = await dal.findByEmail(email, { withPassword: false });
    if (!user) throw unauthorized('Account not found');
    if (user.isEmailVerified) return { status: 'already-verified', user: publicUser(user) };
    await dal.updateUser(user._id, { isEmailVerified: true });
    // issue pair immediately so the user lands in the app verified
    const userFull = await dal.findByIdFull(user._id);
    publish(topics.USER_VERIFIED, { email: userFull.email, name: userFull.name });
    return issueSession(userFull);
  }

  // purpose === 'reset': mint a one-shot token that gates the password change
  const user = await dal.findByEmail(email, { withPassword: true });
  if (!user) throw unauthorized('Account not found');
  const resetToken = jwt.signAccess({ _id: user._id, role: user.role }); // short-lived access token doubles as reset bearer
  return { status: 'reset-authorized', resetToken, minutes: 15 };
}

export async function completeReset({ resetToken, password }) {
  const claims = jwt.verifyAccess(resetToken);
  if (!claims) throw unauthorized('Reset session expired. Start the reset again.');
  const user = await dal.findByIdFull(claims.sub);
  if (!user) throw unauthorized('Account not found');
  if (!user.isEmailVerified) throw unauthorized('Verify your email first');

  if (user.authProvider === 'google' && !user.passwordHash) {
    throw unprocessable('This account signs in with Google. Use Google on the sign-in screen.', [
      { field: 'password', issue: 'google-authenticated account has no password' },
    ]);
  }

  const isSame = user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (isSame) throw unprocessable('New password must be different from the current one', [{ field: 'password', issue: 'matches current password' }]);

  const passwordHash = await hashPassword(password);
  await dal.updateUser(user._id, { passwordHash });
  await dal.revokeAll(user._id); // force re-login everywhere
  await emailService.sendPasswordChanged(user.email, user.name);
  return { status: 'password-reset', email: user.email };
}

// ---------------------------------------------------------------------------
// Login / session
// ---------------------------------------------------------------------------

export async function login({ email, password }, req) {
  const user = await dal.findByEmail(email, { withPassword: true });
  const valid = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) throw unauthorized('Email or password is incorrect');

  // staff accounts are rejected on the storefront endpoint, but only AFTER the password
  // proves them - so a 403 here can never be used to discover which emails are admins
  if (user.role === 'admin') {
    throw new HttpError(403, 'ADMIN_PORTAL_ONLY', 'Administrator accounts sign in at the admin portal. Open /admin/login.');
  }

  if (!user.isEmailVerified) {
    const code = await createOtp(email, 'verify', ip(req));
    await sendOtpEmail(email, user.name, code, 'verify your THREAD account');
    return { status: 'otp-sent', email, requiresOtp: true, purpose: 'verify' };
  }

  return issueSession(user);
}

// dedicated staff entry (/api/admin/login): password-first, then the role gate - a customer
// with valid credentials gets a 403, bad credentials get the generic 401 either way. The
// session mechanics are shared (cookie rotation unchanged), so the console is just another
// client of the same refresh family, not a parallel auth system.
export async function adminLogin({ email, password }, req) {
  const user = await dal.findByEmail(email, { withPassword: true });
  const valid = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) throw unauthorized('Email or password is incorrect');
  if (user.role !== 'admin') throw forbidden('This portal is for staff accounts only.');
  return issueSession(user);
}

export async function issueSession(user) {
  const accessToken = jwt.signAccess(user);
  const { token, tokenHash, family, expiresAt } = jwt.issueRefreshToken();
  await dal.persistRefreshToken(user._id, { tokenHash, family, expiresAt });
  logger.debug({ sub: String(user._id) }, 'session issued');
  return { status: 'authenticated', accessToken, refreshToken: token, user: publicUser(user) };
}

export async function refreshSession(refreshCookie) {
  if (!refreshCookie) throw unauthorized('No refresh session');
  const tokenHash = sha256(refreshCookie);

  // resolve the caller's refresh row; parallel tabs legally rotate past each other,
  // so a revoked token whose replacement is still live continues the chain instead
  // of dying as "reuse" (normal multi-tab browser flow).
  let claim = await dal.findRefreshOwner(tokenHash);
  if (!claim) throw unauthorized('Refresh session revoked. Please sign in again.');
  let hops = 0;
  while (claim.revokedAt && hops < 5) {
    if (!claim.replacedByHash) {
      await dal.revokeFamily(claim.id, claim.family); // genuine reuse -> kill family
      throw unauthorized('Session revoked due to reuse. Sign in again.');
    }
    claim = (await dal.findRefreshOwner(claim.replacedByHash)) || claim; // follow the heir
    hops += 1;
    if (!claim?.revokedAt) break;
  }
  if (claim.revokedAt) throw unauthorized('Refresh session expired. Please sign in again.');

  const user = await dal.findByIdFull(claim.id);
  if (!user || !user.isEmailVerified) throw unauthorized('Account unavailable. Contact support.');

  const accessToken = jwt.signAccess(user);
  const next = jwt.issueRefreshToken();
  // keep the same line; the hash this request presented is retired
  await dal.rotateRefreshToken(user._id, { fromHash: tokenHash, toHash: next.tokenHash, family: claim.family });
  return { status: 'authenticated', accessToken, refreshToken: next.token, user: publicUser(user) };
}

export async function logout(refreshCookie, req, userId) {
  // opaque token: revoke by stored hash against the caller's user doc (no-op when absent)
  if (refreshCookie && userId) await dal.revokeTokenHash(userId, sha256(refreshCookie));
  return { status: 'logged-out' };
}

export async function me(userId) {
  const user = await dal.findById(userId, { withPassword: false });
  if (!user) throw unauthorized('Please sign in again');
  return publicUser(user);
}

export async function updateProfile(input, userId) {
  const patch = {};
  if (input.currentPassword && input.newPassword) {
    const user = await dal.findByIdFull(userId);
    const valid = user?.passwordHash && (await bcrypt.compare(input.currentPassword, user.passwordHash));
    if (!valid) throw unauthorized('Current password is incorrect');
    patch.passwordHash = await hashPassword(input.newPassword);
  }
  if (input.name) patch.name = input.name;
  if (input.phone) patch.phone = input.phone;
  const updated = await dal.updateUser(userId, patch);
  return publicUser(updated);
}

export async function sessions(userId) {
  return { sessions: await dal.countLiveSessions(userId) };
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

export async function upsertGoogleUser(profile) {
  let user = await dal.findByEmailOrGoogle(profile.email, profile.googleId);
  if (!user) {
    user = await dal.create({
      name: profile.name,
      email: profile.email,
      authProvider: 'google',
      googleId: profile.googleId,
      avatarUrl: profile.picture || '',
      isEmailVerified: true, // Google already did this
      role: 'user',
    });
    publish(topics.USER_REGISTERED, { email: profile.email, name: profile.name });
    // Google already proved the address, so this account is verified at creation
    publish(topics.USER_VERIFIED, { email: profile.email, name: profile.name });
    return dal.findByIdFull(String(user._id));
  }
  if (!user.googleId) {
    // a password account signed in with Google for the first time -> link
    user = await dal.updateUser(String(user._id), { googleId: profile.googleId, avatarUrl: user.avatarUrl || profile.picture });
  }
  return dal.findByIdFull(String(user._id));
}

export async function completeGoogle(accessToken) {
  const claims = jwt.verifyAccess(accessToken);
  if (!claims) throw unauthorized('Sign-in link expired. Please sign in again.');
  const user = await dal.findByIdFull(claims.sub);
  if (!user) throw unauthorized('Account not found');
  const pairSuccess = await issueSession(user);
  return pairSuccess;
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

async function sendOtpEmail(email, name, code, blurb) {
  try {
    await emailService.sendOtp({ email, name, code, blurb });
  } catch (err) {
    logger.error({ err: err.message, email: `${email.slice(0, 3)}***` }, 'OTP email failed');
  }
}

export { publicUser };

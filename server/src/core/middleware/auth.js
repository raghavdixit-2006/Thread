// core/middleware/auth.js - JWT bearer verification + RBAC.
// Identity always comes from a verified server token, never from the client.
import { verifyAccess } from '../../modules/auth/jwt.js';
import { User } from '../../models/userModel.js';
import { unauthorized, forbidden } from '../httpError.js';

export function accessTokenFrom(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export async function authOptional(req, res, next) {
  if (!accessTokenFrom(req)) return next();
  try {
    req.user = await resolveUser(accessTokenFrom(req));
    next();
  } catch (err) {
    if (err.status === 401) return next(null); // optional auth: bad token == anonymous
    next(err);
  }
}

async function resolveUser(token) {
  const claims = verifyAccess(token);
  if (!claims) throw unauthorized('Session expired');
  const user = await User.findById(claims.sub).select('_id name email role isEmailVerified').lean();
  if (!user) throw unauthorized('Account not found');
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified };
}

/** Attach req.user; isAuthenticated flag instead of 401 (used by cart endpoints). */
export function attachIdentity(req, res, next) {
  authOptional(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}

export function authRequired(req, res, next) {
  if (!accessTokenFrom(req)) return next(unauthorized('Sign in to continue'));
  authOptional(req, res, (err) => {
    if (err) return next(err);
    if (!req.user) return next(unauthorized('Session expired'));
    next();
  });
}

export function adminRequired(req, res, next) {
  authRequired(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
    next();
  });
}

// modules/auth/authDal.js - all user persistence lives here (DAL pattern).
// Controllers/services never touch mongoose models for users.
import { User } from '../../models/userModel.js';
import { notFound } from '../../core/httpError.js';

/** non-sensitive projection used by auth flows */
const SAFE = { name: 1, phone: 1, email: 1, role: 1, isEmailVerified: 1, authProvider: 1, avatarUrl: 1, addresses: 1, termsVersion: 1, termsAcceptedAt: 1, createdAt: 1 };

export async function findById(id, { withPassword = false } = {}) {
  const query = User.findById(id);
  if (withPassword) query.select('+passwordHash');
  else query.select(SAFE);
  return query.lean({ virtuals: true });
}

export async function findByEmail(email, { withPassword = true } = {}) {
  const query = User.findOne({ email: String(email).toLowerCase() });
  if (withPassword) query.select('+passwordHash');
  else query.select(SAFE);
  return query.lean({ virtuals: true });
}

export async function findByEmailOrGoogle(email, googleId) {
  return User.findOne({
    $or: [{ email: String(email).toLowerCase() }, { googleId }],
  })
    .select('+passwordHash')
    .lean({ virtuals: true });
}

export async function create(doc) {
  return User.create(doc);
}

export async function updateUser(id, patch) {
  // lean: callers spread addresses into JSON responses, hydrated subdocs would leak $-internals
  const updated = await User.findByIdAndUpdate(id, { $set: patch }, { new: true }).select(SAFE).lean({ virtuals: true });
  if (!updated) throw notFound('User not found');
  return updated;
}

export async function findByIdFull(id) {
  // lean: refresh/reset never mint Mongoose subdocs through publicUser - JSON-safe shape
  return User.findById(id).select('+passwordHash').lean({ virtuals: true });
}

// ---------- refresh-token family management ----------

export async function persistRefreshToken(id, { tokenHash, family, expiresAt }) {
  // prune stale/revoked tokens so the array never grows unboundedly. updateOne (not
  // doc.save) keeps session issuance independent of unrelated profile validation.
  const now = new Date();
  await User.updateOne(
    { _id: id },
    { $pull: { refreshTokens: { $or: [{ expiresAt: { $lte: now } }, { revokedAt: { $type: 'date' } }] } } },
  );
  const result = await User.updateOne(
    { _id: id },
    { $push: { refreshTokens: { tokenHash, family, expiresAt } } },
  );
  if (!result.matchedCount) throw notFound('User not found');
  return null;
}

export async function rotateRefreshToken(id, { fromHash, toHash, family }) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  // retire the presented hash without loading/saving the whole user document
  const retired = await User.updateOne(
    { _id: id, 'refreshTokens.tokenHash': fromHash },
    { $set: { 'refreshTokens.$[t].revokedAt': now, 'refreshTokens.$[t].replacedByHash': toHash } },
    { arrayFilters: [{ 't.tokenHash': fromHash }] },
  );
  // a parallel tab may have rotated between lookup and write; still mint this successor
  await User.updateOne(
    { _id: id },
    { $push: { refreshTokens: { tokenHash: toHash, family, expiresAt } } },
  );
  return retired;
}

export async function revokeFamily(id, family) {
  await User.updateOne(
    { _id: id },
    { $set: { 'refreshTokens.$[t].revokedAt': new Date() } },
    { arrayFilters: [{ 't.family': family }] },
  );
}

export async function revokeAll(id) {
  await User.updateOne(
    { _id: id },
    { $set: { 'refreshTokens.$[].revokedAt': new Date() } },
  );
}

export async function revokeTokenHash(id, tokenHash) {
  await User.updateOne(
    { _id: id, 'refreshTokens.tokenHash': tokenHash },
    { $set: { 'refreshTokens.$.revokedAt': new Date() } },
  );
}

export async function findRefreshHash(id, tokenHash) {
  const user = await User.findById(id).select('refreshTokens');
  if (!user) return null;
  return user.refreshTokens.find((t) => t.tokenHash === tokenHash) || null;
}

// opaque refresh tokens carry no user id: resolve the owner from the stored hash
export async function findRefreshOwner(tokenHash) {
  const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash }, { _id: 1, refreshTokens: 1 }).lean();
  const entry = user?.refreshTokens?.find((t) => t.tokenHash === tokenHash);
  if (!user || !entry) return null;
  return { id: String(user._id), family: entry.family, revokedAt: entry.revokedAt || null, replacedByHash: entry.replacedByHash || null };
}

export async function countLiveSessions(id) {
  const user = await User.findById(id).select('refreshTokens');
  return (user?.refreshTokens || []).filter((t) => !t.revokedAt && t.expiresAt > new Date()).length;
}

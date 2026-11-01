// modules/users/usersModule.js - addresses book + profile endpoints (beyond auth's own /me).
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../../models/userModel.js';
import { ok, noContent } from '../../utils/response.js';
import { authRequired } from '../../core/middleware/auth.js';
import { writeLimiter } from '../../core/rateLimit.js';
import { validateBody, validateParams } from '../../core/validate.js';
import { notFound, unprocessable } from '../../core/httpError.js';

const addressSchema = z
  .object({
    label: z.string().trim().max(30).optional(),
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'A 10-digit Indian mobile number is required'),
    line1: z.string().trim().min(4).max(120),
    line2: z.string().trim().max(120).optional().default(''),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'A valid 6-digit pincode is required'),
    isDefault: z.boolean().optional().default(false),
  })
  .strict();

const addressId = z.object({ id: z.string().length(24, 'Invalid address id') }).strict();

async function getUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw unprocessable('Account unavailable');
  return user;
}

async function listAddresses(req, res) {
  const user = await getUser(req.user.id);
  return ok(res, { items: user.addresses || [] });
}

async function addAddress(req, res) {
  const user = await getUser(req.user.id);
  const count = user.addresses.length;
  if (count >= 20) throw unprocessable('Too many saved addresses (max 20)', [{ field: 'addresses', issue: 'max reached' }]);
  const address = { ...req.data.body, isDefault: req.data.body.isDefault && count === 0 ? true : req.data.body.isDefault };
  await User.updateOne({ _id: req.user.id }, { $push: { addresses: address } });
  return ok(res, address);
}

async function patchAddress(req, res) {
  const { id } = req.data.params;
  const updated = await User.updateOne({ _id: req.user.id, 'addresses._id': id }, { $set: { 'addresses.$': { ...req.data.body, _id: id } } });
  if (updated.matchedCount === 0) throw notFound('Address not found');
  return ok(res, { updated: true });
}

async function removeAddress(req, res) {
  const { id } = req.data.params;
  const removed = await User.updateOne({ _id: req.user.id }, { $pull: { addresses: { _id: id } } });
  if (removed.matchedCount === 0) throw notFound('Address not found');
  return noContent(res);
}

async function setDefaultAddress(req, res) {
  const { id } = req.data.params;
  const user = await getUser(req.user.id);
  const target = (user.addresses || []).find((a) => String(a._id) === id);
  if (!target) throw notFound('Address not found');
  await User.updateOne({ _id: req.user.id }, { $set: { 'addresses.$[].isDefault': false } });
  await User.updateOne({ _id: req.user.id, 'addresses._id': id }, { $set: { 'addresses.$.isDefault': true } });
  return ok(res, { defaultSet: true });
}

export function userRoutes() {
  const router = Router();
  router.use(authRequired);

  router.get('/me/addresses', listAddresses);
  router.post('/me/addresses', writeLimiter, validateBody(addressSchema), addAddress);
  router.patch('/me/addresses/:id', writeLimiter, validateParams(addressId), validateBody(addressSchema), patchAddress);
  router.delete('/me/addresses/:id', writeLimiter, validateParams(addressId), removeAddress);
  router.patch('/me/addresses/:id/default', writeLimiter, validateParams(addressId), setDefaultAddress);

  return router;
}

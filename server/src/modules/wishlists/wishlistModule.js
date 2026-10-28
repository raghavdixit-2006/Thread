// modules/wishlists/wishlistModule.js - wishlist (toggle, list with product enrichment).
import { Router } from 'express';
import { z } from 'zod';
import { Wishlist } from '../../models/wishlistModel.js';
import { Product } from '../../models/productModel.js';
import { ok } from '../../utils/response.js';
import { authRequired } from '../../core/middleware/auth.js';
import { writeLimiter } from '../../core/rateLimit.js';
import { validateBody } from '../../core/validate.js';
import { notFound } from '../../core/httpError.js';

const MAX_ITEMS = 200;
const PRODUCT_FIELDS = ['title', 'slug', 'images', 'price', 'mrp', 'category', 'brand', 'avgRating', 'ratingCount'];

const toggleSchema = z
  .object({
    productId: z.string().regex(/^[a-f\d]{24}$/i, 'productId must be a 24-hex id'),
  })
  .strict();

async function loadWishlist(userId) {
  return (await Wishlist.findOne({ userId }).lean()) || { userId, productIds: [] };
}

async function getByProductIds(ids) {
  if (!ids.length) return [];
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).select(PRODUCT_FIELDS).lean();
  const order = new Map(ids.map((id, i) => [String(id), i]));
  return products
    .map((p) => ({
      ...p,
      _id: String(p._id),
      image: (p.images || [])[0] || '',
    }))
    .sort((a, b) => (order.get(String(b._id)) ?? 0) - (order.get(String(a._id)) ?? 0));
}

async function toggleProduct(userId, productId) {
  const wishlist = await loadWishlist(userId);
  const exists = wishlist.productIds.map(String).includes(String(productId));
  const update = exists ? { $pull: { productIds: productId } } : { $addToSet: { productIds: productId } };

  if (!exists) {
    const count = wishlist.productIds.length;
    if (count >= MAX_ITEMS) throw notFound('Wishlist limit reached (200 items)');
    const product = await Product.exists({ _id: productId, isActive: true });
    if (!product) throw notFound('Product not found');
  }

  const updated = await Wishlist.findOneAndUpdate({ userId }, update, { upsert: true, new: true }).lean();
  return { active: !exists, total: updated.productIds.length };
}

// ---------------- HTTP ----------------

async function get(req, res) {
  const wishlist = await loadWishlist(req.user.id);
  return ok(res, { items: await getByProductIds(wishlist.productIds) });
}

async function toggle(req, res) {
  return ok(res, await toggleProduct(req.user.id, req.data.body.productId));
}

async function states(req, res) {
  const ids = String(req.query.ids || '')
    .split(',')
    .filter((v) => /^[a-f\d]{24}$/i.test(v));
  const wishlist = await loadWishlist(req.user.id);
  const set = new Set(wishlist.productIds.map(String));
  return ok(res, { states: ids.map((id) => ({ productId: id, active: set.has(id) })) });
}

export function wishlistRoutes() {
  const router = Router();
  router.use(authRequired);

  router.get('/', get);
  router.get('/states', states);
  router.post('/toggle', writeLimiter, validateBody(toggleSchema), toggle);

  return router;
}

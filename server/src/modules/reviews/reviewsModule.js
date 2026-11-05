// modules/reviews/reviewsModule.js - product reviews with verified-purchase badge.
import { Router } from 'express';
import { z } from 'zod';
import { Review } from '../../models/reviewModel.js';
import { Product } from '../../models/productModel.js';
import { Order } from '../../models/orderModel.js';
import { ok, created } from '../../utils/response.js';
import { authRequired } from '../../core/middleware/auth.js';
import { writeLimiter } from '../../core/rateLimit.js';
import { validateBody, validateParams, validateQuery } from '../../core/validate.js';
import { conflict, notFound, unprocessable } from '../../core/httpError.js';
import { publish, topics } from '../../core/eventBus.js';

const slugParams = z.object({ slug: z.string().trim().min(2).max(140) }).strict();
const listQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
const createSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(120).default(''),
    body: z.string().trim().min(5, 'Tell a little more about the fit (5+ characters)').max(2000),
  })
  .strict();

const REVIEW_FIELDS = { rating: 1, title: 1, body: 1, authorName: 1, verifiedPurchase: 1, createdAt: 1, userId: 1 };

async function productBySlug(slug) {
  const product = await Product.findOne({ slug, isActive: true }).select('_id slug').lean();
  if (!product) throw notFound('Product not found');
  return product;
}

async function hasVerifiedPurchase(userId, productId) {
  // a delivered order containing this product
  const order = await Order.exists({
    userId,
    items: { $elemMatch: { productId: productId } },
    status: 'delivered',
  });
  return Boolean(order);
}

async function listReviews(req, res) {
  const product = await productBySlug(req.data.params.slug);
  const { page, limit } = req.data.query;
  const [items, total] = await Promise.all([
    Review.find({ productId: product._id }).select(REVIEW_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments({ productId: product._id }),
  ]);
  return ok(res, { items: items.map((r) => ({ ...r, _id: String(r._id) })), meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
}

async function createReview(req, res) {
  const product = await productBySlug(req.data.params.slug);
  const exists = await Review.findOne({ productId: product._id, userId: req.user.id }).lean();
  if (exists) throw conflict('You already reviewed this product. One review per product.');

  const verifiedPurchase = await hasVerifiedPurchase(req.user.id, product._id);
  const review = await Review.create({
    productId: product._id,
    userId: req.user.id,
    authorName: req.user.name,
    verifiedPurchase,
    rating: req.data.body.rating,
    title: req.data.body.title,
    body: req.data.body.body,
  });

  await recomputeAggregates(product._id);
  publish(topics.PRODUCT_UPSERTED, { slug: product.slug });

  return created(res, { ...review.toObject(), _id: String(review._id) });
}

async function recomputeAggregates(productId) {
  const agg = (await Review.aggregate([{ $match: { productId: productId } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]))[0];
  await Product.findByIdAndUpdate(productId, { avgRating: agg?.avg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.count || 0 });
}

export function reviewRoutes() {
  const router = Router();

  router.get('/:slug', validateParams(slugParams), validateQuery(listQuery), listReviews);
  router.post('/:slug', authRequired, writeLimiter, validateParams(slugParams), validateBody(createSchema), createReview);

  return router;
}

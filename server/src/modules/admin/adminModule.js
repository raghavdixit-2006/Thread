// modules/admin/adminModule.js - admin panel APIs (RBAC-gated).
// Product CRUD aliases the products module controllers; order management lives in orders.
// The public staff login router mounts BEFORE the gated namespace (routes/index.js order),
// so POST /api/admin/login stays open while everything else requires an admin session.
import { Router } from 'express';
import { ok, created } from '../../utils/response.js';
import { adminRequired } from '../../core/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../../core/validate.js';
import { adminLoginLimiter } from '../../core/rateLimit.js';
import { createProductSchema, updateProductSchema, slugParamsSchema, adminListSchema } from '../products/schemas.js';
import { loginSchema } from '../auth/schemas.js';
import * as authController from '../auth/authController.js';
import * as productsController from '../products/productsController.js';
import { Product } from '../../models/productModel.js';
import { z } from 'zod';

const lowStockQuery = z
  .object({
    threshold: z.coerce.number().int().min(0).max(500).default(3),
  })
  .strict();

async function dashboard(req, res) {
  const [totalProducts, activeProducts, lowStockCount, outOfStockVariants] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, variants: { $elemMatch: { stock: { $gt: 0, $lte: 3 } } } }),
    Product.countDocuments({ isActive: true, variants: { $elemMatch: { stock: 0 } } }),
  ]);
  return ok(res, { totalProducts, activeProducts, lowStockCount, outOfStockVariants });
}

async function lowStock(req, res) {
  const threshold = req.data.query.threshold;
  const items = await Product.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$variants' },
    { $match: { 'variants.stock': { $lte: threshold } } },
    { $project: { _id: 0, slug: 1, title: 1, sku: '$variants.sku', size: '$variants.size', color: '$variants.color', stock: '$variants.stock' } },
    { $sort: { stock: 1 } },
    { $limit: 50 },
  ]);
  return ok(res, { items });
}

export function adminRoutes() {
  const router = Router();
  router.use(adminRequired);

  // catalogue aliases (same controllers the /api/products admin routes use)
  router.get('/products', validateQuery(adminListSchema), productsController.listAdmin);
  router.post('/products', validateBody(createProductSchema), productsController.create);
  // single piece for the admin edit page (any state, incl. hidden pieces)
  router.get('/products/:slug', validateParams(slugParamsSchema), productsController.adminGet);
  router.patch('/products/:slug', validateParams(slugParamsSchema), validateBody(updateProductSchema.partial()), productsController.update);
  router.delete('/products/:slug', validateParams(slugParamsSchema), productsController.remove);

  // inventory
  router.get('/inventory', validateQuery(lowStockQuery), lowStock);
  router.get('/dashboard', dashboard);

  return router;
}

// public staff entry point (no adminRequired): credential gate lives in the service
export function adminAuthRoutes() {
  const router = Router();
  router.post('/login', adminLoginLimiter, validateBody(loginSchema), authController.adminLogin);
  return router;
}

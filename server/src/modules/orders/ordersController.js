// modules/orders/ordersController.js + routes
import { Router } from 'express';
import { ok, created } from '../../utils/response.js';
import { authRequired, adminRequired } from '../../core/middleware/auth.js';
import { writeLimiter } from '../../core/rateLimit.js';
import { validateBody, validateParams, validateQuery } from '../../core/validate.js';
import { placeOrderSchema, orderPathSchema, cancelSchema, adminStatusSchema, adminOrderListSchema } from './schemas.js';
import * as service from './ordersService.js';
import { z } from 'zod';

const myOrderListSchema = z
  .object({
    status: z.enum(['created', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export async function place(req, res) {
  // accept the standard header too, so non-browser clients can replay safely
  const headerKey = String(req.get('Idempotency-Key') || '').trim();
  const idempotencyKey =
    req.data.body.idempotencyKey || (headerKey.length >= 8 && headerKey.length <= 64 ? headerKey : undefined);
  const { order, idempotentReplay } = await service.place(req.user.id, { ...req.data.body, idempotencyKey });
  return created(res, order, { idempotentReplay });
}

export async function getMine(req, res) {
  return ok(res, await service.getForUser(req.user.id, req.data.params.id));
}

export async function list(req, res) {
  return ok(res, await service.listMy(req.user.id, req.data.query));
}

export async function cancelOrder(req, res) {
  return ok(res, await service.cancel(req.user.id, req.data.params.id, req.data.body));
}

// admin
export async function adminGetList(req, res) {
  return ok(res, await service.adminList(req.data.query));
}

export async function adminGetOne(req, res) {
  return ok(res, await service.adminGet(req.data.params.id));
}

export async function adminPatchStatus(req, res) {
  return ok(res, await service.adminSetStatus(req.data.params.id, req.data.body));
}

export async function sales(req, res) {
  return ok(res, await service.report());
}

export function orderRoutes() {
  const router = Router();
  router.use(authRequired);

  router.post('/', writeLimiter, validateBody(placeOrderSchema), place);
  router.get('/', validateQuery(myOrderListSchema), list);
  router.get('/:id', validateParams(orderPathSchema), getMine);
  router.post('/:id/cancel', writeLimiter, validateParams(orderPathSchema), validateBody(cancelSchema), cancelOrder);

  return router;
}

export function orderAdminRoutes() {
  const router = Router();
  router.use(adminRequired);

  router.get('/', validateQuery(adminOrderListSchema), adminGetList);
  router.get('/:id', validateParams(orderPathSchema), adminGetOne);
  router.patch('/:id/status', validateParams(orderPathSchema), validateBody(adminStatusSchema), adminPatchStatus);
  router.get('/reports/sales', sales); // /api/admin/orders/reports/sales

  return router;
}

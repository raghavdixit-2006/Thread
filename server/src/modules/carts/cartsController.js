// modules/carts/cartsController.js + routes
import { ok } from '../../utils/response.js';
import { authRequired } from '../../core/middleware/auth.js';
import { writeLimiter } from '../../core/rateLimit.js';
import { validateBody } from '../../core/validate.js';
import { addItemSchema, setQtySchema, mergeSchema } from './schemas.js';
import { Router } from 'express';
import * as service from './cartsService.js';

export async function getCart(req, res) {
  return ok(res, await service.getCart(req.user.id));
}

export async function add(req, res) {
  return ok(res, await service.addItem(req.user.id, req.data.body));
}

export async function setQuantity(req, res) {
  return ok(res, await service.setQty(req.user.id, req.data.body));
}

export async function remove(req, res) {
  return ok(res, await service.removeItem(req.user.id, req.data.params.sku));
}

export async function clear(req, res) {
  return ok(res, await service.clearCart(req.user.id));
}

export async function mergeGuest(req, res) {
  return ok(res, await service.mergeGuest(req.user.id, req.data.body.items));
}

export function cartRoutes() {
  const router = Router();
  router.use(authRequired);

  router.get('/', getCart);
  router.post('/items', writeLimiter, validateBody(addItemSchema), add);
  router.patch('/items', writeLimiter, validateBody(setQtySchema), setQuantity);
  router.delete('/items/:sku', writeLimiter, remove);
  router.delete('/', writeLimiter, clear);
  router.post('/merge', writeLimiter, validateBody(mergeSchema), mergeGuest);

  return router;
}

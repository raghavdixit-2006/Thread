// modules/coupons/couponsModule.js - public validate endpoint + admin CRUD.
import { Router } from 'express';
import { z } from 'zod';
import { Coupon } from '../../models/couponModel.js';
import { ok, created } from '../../utils/response.js';
import { adminRequired } from '../../core/middleware/auth.js';
import { validateBody } from '../../core/validate.js';
import * as service from './couponsService.js';

const validateSchema = z
  .object({
    code: z.string().trim().min(2).max(20),
    subtotal: z.coerce.number().int().min(0), // paise
  })
  .strict();

const upsertSchema = z
  .object({
    code: z.string().trim().min(2).max(20),
    type: z.enum(['percent', 'fixed']),
    value: z.coerce.number().int().positive(),
    minOrder: z.coerce.number().int().min(0).default(0),
    maxDiscount: z.coerce.number().int().positive().nullish(),
    usageLimit: z.coerce.number().int().positive().nullish(),
    validTill: z.coerce.date(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'percent value must be 1-100', path: ['value'] });

async function validateCoupon(req, res) {
  return ok(res, await service.validate(req.data.body.code, req.data.body.subtotal));
}

async function upsert(adminReq, res) {
  const body = adminReq.data.body;
  const coupon = await Coupon.findOneAndUpdate(
    { code: body.code.toUpperCase() },
    { ...body, code: body.code.toUpperCase() },
    { upsert: true, new: true },
  ).lean();
  return created(res, coupon);
}

async function listCoupons(adminReq, res) {
  const coupons = await Coupon.find().sort({ validTill: -1 }).lean();
  return ok(res, { items: coupons });
}

export function couponRoutes() {
  const router = Router();

  router.post('/validate', validateBody(validateSchema), validateCoupon);

  router.get('/admin', adminRequired, listCoupons);
  router.post('/admin', adminRequired, validateBody(upsertSchema), upsert);

  return router;
}

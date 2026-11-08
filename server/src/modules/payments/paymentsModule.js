// modules/payments/paymentsModule.js - payment endpoints + the signature-verified webhook route.
//
// Mounting note: /webhook is registered from core/app.js with express.raw BEFORE the global
// express.json (Razorpay computes its HMAC over the exact request bytes; re-parsing and
// re-serializing the JSON would change them). The two authed endpoints live on /api/payments.
import express from 'express';
import { Router } from 'express';
import { ok } from '../../utils/response.js';
import { authRequired } from '../../core/middleware/auth.js';
import { paymentLimiter } from '../../core/rateLimit.js';
import { validateBody } from '../../core/validate.js';
import { createPaymentOrderSchema, verifyPaymentSchema } from './schemas.js';
import { createPaymentOrder, verifyPayment, handleWebhook } from './paymentsService.js';

export async function createRazorpayOrder(req, res) {
  return ok(res, await createPaymentOrder(req.user.id, req.data.body));
}

export async function verifyPaymentCallback(req, res) {
  const order = await verifyPayment(req.user.id, req.data.body);
  return ok(res, { verified: true, order });
}

export async function webhook(req, res) {
  // Razorpay retries on non-2xx; only signature failures may ever reject here
  return ok(res, await handleWebhook(req.body, req.get('x-razorpay-signature')));
}

export function rawPaymentRoutes() {
  const router = Router();
  // a signed raw body is required for the webhook HMAC; NOT rate limited on purpose -
  // gateway retries must never be throttled, the signature is the gate
  router.post('/webhook', express.raw({ type: 'application/json', limit: '256kb' }), webhook);
  return router;
}

export function paymentRoutes() {
  const router = Router();
  router.use(authRequired);
  router.post('/razorpay/orders', paymentLimiter, validateBody(createPaymentOrderSchema), createRazorpayOrder);
  router.post('/razorpay/verify', paymentLimiter, validateBody(verifyPaymentSchema), verifyPaymentCallback);
  return router;
}

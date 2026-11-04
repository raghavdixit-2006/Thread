// modules/payments/schemas.js - payment endpoint validation (IDs only; prices never come from the caller).
import { z } from 'zod';

const mangoId = /^[a-f\d]{24}$/;

export const createPaymentOrderSchema = z
  .object({
    orderId: z.string().regex(mangoId, 'Order id looks invalid'),
  })
  .strict();

export const verifyPaymentSchema = z
  .object({
    orderId: z.string().regex(mangoId, 'Order id looks invalid'),
    razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]+$/, 'The gateway order reference looks invalid'),
    razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/, 'The gateway payment reference looks invalid'),
    // Razorpay sends hex HMAC-SHA256 (64 chars) from the checkout widget callback
    razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/, 'The signature must be a 64-character hex HMAC'),
  })
  .strict();

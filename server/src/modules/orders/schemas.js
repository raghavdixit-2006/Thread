// modules/orders/schemas.js
import { z } from 'zod';

const addressSchema = z.object({
  label: z.string().trim().max(30).optional().default('Checkout'),
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'A 10-digit Indian mobile number is required'),
  line1: z.string().trim().min(4).max(120),
  line2: z.string().trim().max(120).default(''),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'A valid 6-digit pincode is required'),
});

export const placeOrderSchema = z
  .object({
    address: addressSchema,
    deliveryOption: z.enum(['standard', 'express']).default('standard'),
    paymentMethod: z.enum(['cod', 'razorpay']).default('cod'), // razorpay = online payment via the checkout widget
    couponCode: z.string().trim().max(20).optional(),
    saveAddress: z.boolean().default(false),
    idempotencyKey: z.string().trim().min(8).max(64).optional(), // client-generated UUID
  })
  .strict();

export const orderPathSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid order id') }).strict();

export const cancelSchema = z
  .object({
    reason: z.string().trim().max(240).default('Customer cancelled'),
  })
  .strict();

export const adminStatusSchema = z
  .object({
    status: z.enum(['packed', 'shipped', 'delivered', 'cancelled', 'refunded']),
    note: z.string().trim().max(240).optional().default(''),
  })
  .strict();

export const adminOrderListSchema = z
  .object({
    status: z.enum(['created', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

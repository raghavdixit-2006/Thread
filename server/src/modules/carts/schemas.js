// modules/carts/schemas.js
import { z } from 'zod';

export const addItemSchema = z
  .object({
    productId: z.string().regex(/^[a-f\d]{24}$/i, 'productId must be a 24-hex id'),
    sku: z.string().trim().min(3).max(40).toUpperCase(),
    qty: z.coerce.number().int().min(1).max(10).default(1),
  })
  .strict();

export const setQtySchema = z
  .object({
    sku: z.string().trim().min(3).max(40).toUpperCase(),
    qty: z.coerce.number().int().min(0).max(10), // 0 removes
  })
  .strict();

export const mergeSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().regex(/^[a-f\d]{24}$/i),
          sku: z.string().trim().min(3).max(40).toUpperCase(),
          qty: z.coerce.number().int().min(1).max(10),
        }),
      )
      .min(1)
      .max(30),
  })
  .strict();

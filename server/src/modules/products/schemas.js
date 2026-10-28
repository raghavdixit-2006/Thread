// modules/products/schemas.js
import { z } from 'zod';

const sortValues = ['featured', 'newest', 'price_asc', 'price_desc', 'rating', 'name'];

const CATEGORY_SLUGS = ['jackets', 'dresses', 'shirts', 't-shirts', 'jeans', 'sweaters'];

const categoryCsv = z
  .string()
  .trim()
  .max(150)
  .optional()
  .refine((value) => {
    if (!value) return true;
    const list = value.split(',').map((part) => part.trim()).filter(Boolean);
    return list.length > 0 && list.length <= 6 && list.every((part) => CATEGORY_SLUGS.includes(part));
  }, 'Unknown category in the categories filter');

export const listQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: z.enum(CATEGORY_SLUGS).optional(),
    categories: categoryCsv, // csv for the shop's independent multi-select chips
    brand: z.string().trim().max(60).optional(),
    sizes: z.string().trim().max(40).optional(), // comma list e.g. S,M,L
    colors: z.string().trim().max(80).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    featured: z.coerce.boolean().optional(),
    sort: z.enum(sortValues).default('featured'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict();

export const slugParamsSchema = z.object({ slug: z.string().trim().min(2).max(140) }).strict();

const SIZE_VALUES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** absolute URL (Cloudinary/other CDN) or server path (/products, /uploads).
    Deliberately NOT z.string().url(): seeded photography lives at /products/<file>. */
const imageEntry = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => /^(https?:\/\/\S+|\/\S+)$/i.test(value), 'Image must be an absolute URL or a server path starting with /');

const productBase = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(4000),
    category: z.enum(CATEGORY_SLUGS),
    brand: z.string().trim().min(1).max(60).optional(), // mongoose default THREAD on create
    price: z.coerce.number().int().positive().optional(), // IGNORED on input - the server derives the selling price from mrp + discountPercent
    mrp: z.coerce.number().int().positive(), // list price (strike-through when discounted)
    // NO defaults here: zod .partial() applies them on PATCH, silently resetting fields
    // on partial updates (was: discount zeroed on any PATCH without the field). The
    // service resolves absence; mongoose owns create-time defaults.
    discountPercent: z.coerce.number().int().min(0).max(90).optional(),
    // ordered gallery: index 0 renders as the MAIN image (shop/product/cart contract)
    images: z.array(imageEntry).min(1).max(8),
    colors: z.array(z.string().trim().min(1).max(30)).max(8).optional(), // derived from variants; incoming values are ignored
    sizes: z.array(z.enum(SIZE_VALUES)).max(6).optional(), // derived from variants; incoming values are ignored
    // colour-group photo links: each entry maps a variant colour to gallery photos
    variantImages: z
      .array(
        z.object({
          color: z.string().trim().min(1).max(30),
          images: z.array(imageEntry).min(1).max(8),
        }),
      )
      .max(6)
      .optional(),
    variants: z
      .array(
        // flat storage rows: the admin form groups them by colour (per-variant price).
        // sku is server-generated when omitted/blank, so SKUs stay unique catalogue-wide.
        z.object({
          sku: z.string().trim().max(40).optional(),
          size: z.enum(SIZE_VALUES),
          color: z.string().trim().min(1).max(30),
          stock: z.coerce.number().int().min(0).max(9999),
          price: z.coerce.number().int().positive().optional(), // paise; falls back to product price
        }),
      )
      .min(1)
      .max(60),
    isFeatured: z.boolean().optional(), // mongoose default false on create
    isActive: z.boolean().optional(), // mongoose default true on create
  })
  .strict();

// create: the invariant only applies when a price was sent at all - the normal flow
// omits it entirely (the server derives the selling price from mrp + discountPercent)
export const createProductSchema = productBase.refine((data) => data.price === undefined || data.mrp >= data.price, {
  message: 'mrp must be >= price',
  path: ['mrp'],
});

// PATCH body: partial is allowed here because the service re-checks mrp >= price on merged values
export const updateProductSchema = productBase;

export const adminListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(120).optional(),
  })
  .strict();

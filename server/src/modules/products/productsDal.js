// modules/products/productsDal.js - every mongoose product query lives here.
import { Product } from '../../models/productModel.js';
import { Category } from '../../models/categoryModel.js';
import { notFound } from '../../core/httpError.js';

const SAFE_PUBLIC = { title: 1, slug: 1, description: 1, images: 1, category: 1, brand: 1, price: 1, mrp: 1, discountPercent: 1, variantImages: 1, colors: 1, sizes: 1, variants: 1, avgRating: 1, ratingCount: 1, isActive: 1, isFeatured: 1, createdAt: 1 };

export function toPublicProduct(doc) {
  if (!doc) return null;
  const out = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete out.createdBy;
  delete out.__v;
  return { _id: String(out._id), ...out, variants: (out.variants || []).map((v) => ({ ...v, _id: undefined })) };
}

const SORTS = {
  featured: { isFeatured: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { avgRating: -1, ratingCount: -1 },
  name: { title: 1 },
};

export async function list({ filters, sort, page, limit }) {
  const query = { isActive: true, ...filters };
  const [items, total] = await Promise.all([
    Product.find(query)
      .select(SAFE_PUBLIC)
      .sort(SORTS[sort] || SORTS.featured)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: false }),
    Product.countDocuments(query),
  ]);
  return { items: items.map(toPublicProduct), total };
}

export async function bySlug(slug) {
  return (await Product.findOne({ slug, isActive: true }).select(SAFE_PUBLIC).lean()) || null;
}

/** admin + internal lookups (includes inactive) */
export async function byAnySlug(slug) {
  return (await Product.findOne({ slug }).lean()) || null;
}

export async function related({ excludeSlug, category, limit = 4 }) {
  return Product.find({ slug: { $ne: excludeSlug }, category, isActive: true })
    .select(SAFE_PUBLIC)
    .sort(SORTS.featured)
    .limit(limit)
    .lean();
}

export async function featured({ limit = 8 }) {
  return Product.find({ isFeatured: true, isActive: true }).select(SAFE_PUBLIC).sort(SORTS.newest).limit(limit).lean();
}

export async function listAllAdmin({ page, limit, q }) {
  const query = q ? { $text: { search: q } } : {};
  const [items, total] = await Promise.all([
    Product.find(query).select({ ...SAFE_PUBLIC, isActive: 1 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(query),
  ]);
  return { items: items.map(toPublicProduct), total };
}

export async function insert(doc) {
  const product = await Product.create(doc);
  return toPublicProduct(product);
}

export async function patch(slug, updates, unsetKeys = []) {
  const ops = { $set: updates };
  if (unsetKeys.length) ops.$unset = Object.fromEntries(unsetKeys.map((key) => [key, 1]));
  const updated = await Product.findOneAndUpdate({ slug }, ops, { new: true });
  if (!updated) throw notFound('Product not found');
  return toPublicProduct(updated);
}

export async function remove(slug) {
  return (await Product.findOneAndDelete({ slug })) || null;
}

export async function listCategories() {
  return Category.find().sort({ order: 1 }).lean();
}

export async function upsertCategory({ name, slug, description, order }) {
  return Category.findOneAndUpdate({ slug }, { name, slug, description, order }, { upsert: true, new: true }).lean();
}

/** variant-level atomic stock guard - used by orders via transactions */
export async function decrementVariantStock({ productId, sku, qty }, session) {
  const res = await Product.updateOne(
    { _id: productId, isActive: true, 'variants.sku': sku, 'variants.stock': { $gte: qty } },
    { $inc: { 'variants.$.stock': -qty } },
    { session },
  );
  if (res.matchedCount === 0) return false;
  return true;
}

export async function restoreVariantStock({ productId, sku, qty }, session) {
  const res = await Product.updateOne(
    { _id: productId, isActive: true, 'variants.sku': sku },
    { $inc: { 'variants.$.stock': qty } },
    { session },
  );
  return res.matchedCount > 0;
}

export async function findForOrder(productIds, session) {
  return session ? Product.find({ _id: { $in: productIds }, isActive: true }).session(session).lean() : Product.find({ _id: { $in: productIds }, isActive: true }).lean();
}

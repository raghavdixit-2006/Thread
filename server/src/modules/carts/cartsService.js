// modules/carts/cartsService.js - cart business rules; prices always recomputed server-side.
import { Product } from '../../models/productModel.js';
import { badRequest, unprocessable } from '../../core/httpError.js';
import * as dal from './cartsDal.js';

const FIND = ['_id', 'slug', 'title', 'brand', 'category', 'price', 'mrp', 'images', 'variantImages', 'sizes', 'colors', 'variants', 'isActive', 'avgRating', 'ratingCount'];

/** colour-linked photo first: a cart line shows the photo tagged to its variant colour */
function lineImage(product, color) {
  const linked = (product.variantImages || []).find((entry) => entry.color === color);
  return (linked?.images || []).find(Boolean) || (product.images || [])[0] || '';
}

export async function getCart(userId) {
  const raw = await dal.getRaw(userId);
  return enrich(raw.items || []);
}

export async function enrich(items) {
  if (!items.length) return { items: [], subtotal: 0, count: 0, unavailable: [] };
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } })
    .select(FIND)
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = [];
  const unavailable = [];
  for (const item of items) {
    const product = byId.get(String(item.productId));
    const variant = product?.variants?.find((v) => v.sku === item.sku);
    if (!product || !product.isActive || !variant) {
      unavailable.push({ sku: item.sku, reason: !product ? 'not-found' : !product.isActive ? 'inactive' : 'variant-missing' });
      continue;
    }
    const unitPrice = variant.price ?? product.price;
    lines.push({
      productId: String(product._id),
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      category: product.category,
      image: lineImage(product, variant.color),
      mrp: product.mrp,
      item: { sku: variant.sku, size: variant.size, color: variant.color, qty: item.qty, priceAtAdd: item.priceAtAdd },
      unitPrice,
      stock: variant.stock,
      lineTotal: unitPrice * item.qty,
      qtyCap: Math.min(dal.MAX_LINE_QTY, Math.max(0, variant.stock)),
    });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const count = lines.reduce((sum, l) => sum + l.item.qty, 0);
  return { items: lines, subtotal, count, unavailable };
}

export async function addItem(userId, payload) {
  const product = await Product.findById(payload.productId).lean();
  if (!product || !product.isActive) throw badRequest('Product not available');
  const variant = product.variants.find((v) => v.sku === payload.sku);
  if (!variant) throw unprocessable('Size/colour combination not found', [{ field: 'sku', issue: 'unknown sku for product' }]);

  const raw = await dal.getRaw(userId);
  const items = (raw.items || []).map((i) => ({ ...i }));
  const existing = items.find((i) => i.sku === payload.sku);
  const targetQty = Math.min(dal.MAX_LINE_QTY, variant.stock, existing ? existing.qty + payload.qty : payload.qty);
  if (targetQty <= 0) throw unprocessable(`Only ${variant.stock} units in stock`, [{ field: 'qty', issue: `stock: ${variant.stock}` }]);
  if (existing) existing.qty = targetQty;
  else items.push({ productId: product._id, sku: payload.sku, qty: targetQty, priceAtAdd: variant.price ?? product.price });

  const { items: merged } = await persistItems(userId, items);
  return enrich(merged);
}

export async function setQty(userId, payload) {
  const raw = await dal.getRaw(userId);
  let items = (raw.items || []).map((i) => ({ ...i }));
  const line = items.find((i) => i.sku === payload.sku);
  if (!line) throw badRequest('This item is not in your cart');

  if (payload.qty === 0) {
    items = items.filter((i) => i.sku !== payload.sku);
  } else {
    const product = await Product.findById(line.productId).lean();
    const variant = product?.variants?.find((v) => v.sku === payload.sku);
    if (!variant || variant.stock <= 0) throw unprocessable('This size is no longer available', [{ field: 'qty', issue: 'out of stock' }]);
    line.qty = Math.min(dal.MAX_LINE_QTY, variant.stock, payload.qty);
  }

  const { items: merged } = await persistItems(userId, items);
  return enrich(merged);
}

export const removeItem = (userId, sku) => setQty(userId, { sku: String(sku).toUpperCase(), qty: 0 });

export async function clearCart(userId) {
  await dal.upsertItems(userId, []);
  return { cleared: true };
}

export async function mergeGuest(userId, guestItems) {
  const raw = await dal.getRaw(userId);
  const current = (raw.items || []).map((i) => ({ ...i }));
  const products = await Product.find({ _id: { $in: guestItems.map((g) => g.productId) }, isActive: true }).lean();

  for (const guest of guestItems) {
    const product = products.find((p) => String(p._id) === String(guest.productId));
    if (!product) continue;
    const variant = product.variants.find((v) => v.sku === guest.sku);
    if (!variant || variant.stock <= 0) continue;
    const existing = current.find((i) => i.sku === guest.sku);
    const newQty = Math.min(dal.MAX_LINE_QTY, variant.stock, (existing?.qty || 0) + guest.qty);
    if (newQty <= 0) continue;
    if (existing) existing.qty = newQty;
    else current.push({ productId: product._id, sku: guest.sku, qty: newQty, priceAtAdd: variant.price ?? product.price });
  }

  const { items: merged } = await persistItems(userId, current);
  return enrich(merged);
}

async function persistItems(userId, items) {
  const cart = await dal.upsertItems(userId, items);
  return { items: cart?.items || [] };
}

export async function countItems(userId) {
  return dal.countTotalQty(userId);
}

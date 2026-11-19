// modules/products/productsService.js - catalog business rules + admin CRUD.
import { publish, topics } from '../../core/eventBus.js';
import { badRequest, notFound } from '../../core/httpError.js';
import { Product } from '../../models/productModel.js';
import { search as searchProducts } from '../search/mongoSearchService.js';
import { saveUploadedImage, saveUploadedImages, unsaveUploadedImageByUrl } from './imageUploads.js';
import * as dal from './productsDal.js';

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

async function uniqueSlug(title, exceptSlug = null) {
  const base = slugify(title) || 'product';
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (candidate === exceptSlug) return candidate;
    const clash = await dal.byAnySlug(candidate);
    if (!clash) return candidate;
  }
  throw badRequest('Could not derive a unique slug for this title');
}

/** listing: q search + facets run on Mongo (weighted text index, prefix pass); no q uses the index scan */
export async function listProducts(input) {
  if (input.q) {
    // faceted, relevance-sorted search straight from the catalogue (source of truth)
    return searchProducts(input);
  }
  const { category, categories, brand, sizes, colors, minPrice, maxPrice, minRating, featured, sort, page, limit } = input;
  const filters = {};
  // categories: independent multi-select (OR within the set); single value keeps the index-friendly equality
  const selectedCategories = [...new Set([...(category ? [category] : []), ...toList(categories || '')])];
  if (selectedCategories.length === 1) filters.category = selectedCategories[0];
  else if (selectedCategories.length > 1) filters.category = { $in: selectedCategories };
  if (brand) filters.brand = new RegExp(`^${escapeRegExp(brand)}$`, 'i');
  if (sizes) filters['sizes'] = { $in: toList(sizes) };
  if (colors) filters['colors'] = { $in: toList(colors) };
  if (minPrice !== undefined || maxPrice !== undefined) filters.price = { ...(minPrice !== undefined ? { $gte: minPrice } : {}), ...(maxPrice !== undefined ? { $lte: maxPrice } : {}) };
  if (minRating !== undefined) filters.avgRating = { $gte: minRating };
  if (featured) filters.isFeatured = true;

  const { items, total } = await dal.list({ filters, sort, page, limit });
  return { items, meta: paginateMeta(total, page, limit) };
}

function toList(csv) {
  return String(csv)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function paginateMeta(total, page, limit) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProduct(slug) {
  const product = await dal.bySlug(slug);
  if (!product) throw notFound('Product not found');
  return { product: dal.toPublicProduct(product) };
}

export async function getRelated(slug) {
  const product = await dal.bySlug(slug);
  if (!product) throw notFound('Product not found');
  const items = await dal.related({ excludeSlug: slug, category: product.category, limit: 4 });
  return { items: items.map(dal.toPublicProduct) };
}

export async function getFeatured(limit = 8) {
  const items = await dal.featured({ limit });
  return { items: items.map(dal.toPublicProduct) };
}

export async function getCategories() {
  const items = await dal.listCategories();
  return { items };
}

// ---------------- admin CRUD ----------------

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** sku owners outside the edited product (used to keep variant SKUs unique catalogue-wide) */
async function skuOwners(skus, exceptSlug) {
  const wanted = skus.filter(Boolean);
  if (!wanted.length) return new Set();
  const rows = await Product.find({ 'variants.sku': { $in: wanted }, ...(exceptSlug ? { slug: { $ne: exceptSlug } } : {}) })
    .select('variants.sku')
    .lean();
  const owners = new Set();
  for (const row of rows) for (const v of row.variants || []) owners.add(v.sku);
  return owners;
}

const skuCode = (value, max) => String(value || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, max) || 'XX';

/**
 * shared create/update normalisation: the wire format stays FLAT variant rows
 * ({sku?, size, color, stock, price?}) because cart/orders/stock take `variant.sku`
 * as their identity key; the admin form presents the same data as colour groups.
 * - duplicate (colour,size) pairs rejected (ambiguous rows in the shop pickers)
 * - blank/absent SKUs are generated and made unique across the whole catalogue
 * - a row price inherits the product (or group-merged) base price when omitted
 */
export async function normalizeVariants(rows, { basePrice, exceptSlug }) {
  const seenPairs = new Set();
  const cleaned = rows.map((row) => {
    const color = String(row.color || '').trim();
    const size = String(row.size || '').trim().toUpperCase();
    const pairKey = `${color.toLowerCase()}|${size}`;
    if (!color) throw badRequest('Every variant needs a colour');
    if (seenPairs.has(pairKey)) throw badRequest(`Size "${size}" appears twice for colour "${color}" - one stock count per size and colour`);
    seenPairs.add(pairKey);
    return { ...row, color, size: SIZE_ORDER.includes(size) ? size : row.size, sku: String(row.sku || '').trim().toUpperCase() || undefined };
  });

  const explicit = cleaned.filter((row) => row.sku).map((row) => row.sku);
  const taken = await skuOwners(explicit, exceptSlug);
  const seenSkus = new Set(explicit);
  for (const sku of explicit) {
    if (taken.has(sku)) throw badRequest(`SKU "${sku}" already belongs to another product`);
  }

  const generated = [];
  for (const row of cleaned) {
    if (row.sku) {
      generated.push(row);
      continue;
    }
    const head = skuCode(row.color, 4);
    const mid = skuCode(row.size, 3);
    let sku = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = `${head}-${mid}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      if (!seenSkus.has(candidate) && !(await skuOwners([candidate], exceptSlug)).has(candidate)) {
        sku = candidate;
        break;
      }
    }
    if (!sku) throw badRequest('Could not derive a unique SKU for a variant - try again');
    seenSkus.add(sku);
    generated.push({ ...row, sku });
  }

  return generated.map((row) => ({ ...row, price: row.price ?? basePrice ?? undefined }));
}

/** colours and sizes the shop filters key on are derived from the variant set */
export function deriveTaxonomy(variants) {
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizes = [...new Set(variants.map((v) => v.size))].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  return { colors, sizes };
}

/** selling price is ALWAYS derived server-side from mrp + the discount percent; client-sent prices are never trusted */
export function derivedPrice(mrp, pct) {
  return Math.round(Number(mrp) * (100 - (Number(pct) || 0)) / 100);
}

/** legacy rows were written without a stored percent - solve it so their % off survives an edit */
function solvedPercent(price, mrp) {
  return mrp > 0 && price > 0 && mrp > price ? Math.min(90, Math.round(((mrp - price) / mrp) * 100)) : 0;
}

/**
 * colour-group photo links (variantImages): each entry maps a variant colour to photos
 * that must come from the ordered product gallery (single source of truth), must match
 * an existing variant colour, and a photo may back at most one colour (stable order).
 * Unlinked gallery photos stay shared across every colour.
 */
export function normalizeVariantPhotos(links, gallery, variantColors) {
  if (!Array.isArray(links) || links.length === 0) return [];
  const index = new Map(gallery.map((url, at) => [String(url), at]));
  const colors = new Set((variantColors || []).map((c) => String(c).toLowerCase()));
  const claimed = new Map(); // gallery url -> owning colour (lowercase)
  const groups = [];
  for (const link of links) {
    const color = String(link?.color || '').trim();
    if (!color) throw badRequest('Photo groups need a colour');
    if (!colors.has(color.toLowerCase())) throw badRequest(`Photo group "${color}" does not match any variant colour`);
    const out = [];
    for (const url of link.images || []) {
      const entry = String(url);
      const owner = claimed.get(entry);
      if (owner && owner !== color.toLowerCase()) throw badRequest('A photo can be linked to only one colour');
      if (owner === color.toLowerCase() || out.includes(entry)) continue; // dedupe while keeping gallery order
      if (!index.has(entry)) throw badRequest(`Linked photo must be part of the product gallery: ${entry.slice(0, 80)}`);
      claimed.set(entry, color.toLowerCase());
      out.push(entry);
    }
    out.sort((a, b) => index.get(a) - index.get(b));
    if (out.length) groups.push({ color, images: out });
  }
  return groups;
}

export async function createProduct(input, user) {
  const slug = await uniqueSlug(input.title);
  const pct = input.discountPercent ?? 0;
  const price = derivedPrice(input.mrp, pct); // an incoming price (if any) is discarded
  const variants = await normalizeVariants(input.variants, { basePrice: price });
  const taxonomy = deriveTaxonomy(variants);
  const photos = normalizeVariantPhotos(input.variantImages, input.images, taxonomy.colors);
  const doc = {
    ...input,
    slug,
    createdBy: user.id,
    price,
    discountPercent: pct,
    variants,
    colors: taxonomy.colors,
    sizes: taxonomy.sizes,
    ...(photos.length ? { variantImages: photos } : {}),
  };
  const created = await dal.insert(doc);
  publish(topics.PRODUCT_UPSERTED, { slug: created.slug }); // pointer, not snapshot - consumer loads source of truth
  return created;
}

export async function updateProduct(slug, updates) {
  const current = await dal.byAnySlug(slug);
  if (!current) throw notFound('Product not found');
  const unsetKeys = []; // mongo keys to $unset on this patch (deletions, not $set)
  if (updates.title && updates.title !== current.title) {
    updates.slug = await uniqueSlug(updates.title, current.slug);
  }
  // money: the selling price derives from the merged mrp + the effective discount;
  // legacy rows without a stored percent keep their current % off on first edit
  const mergedMrp = updates.mrp ?? current.mrp;
  const pct = updates.discountPercent ?? current.discountPercent ?? solvedPercent(current.price, mergedMrp);
  updates.mrp = mergedMrp;
  updates.price = derivedPrice(mergedMrp, pct);
  updates.discountPercent = pct;
  if (mergedMrp < updates.price) throw badRequest('mrp must be >= price'); // only reachable on corrupt mrp
  if (updates.variants) {
    // the supplied set replaces the old one wholesale (same contract as before)
    updates.variants = await normalizeVariants(updates.variants, { basePrice: updates.price, exceptSlug: current.slug });
    const taxonomy = deriveTaxonomy(updates.variants);
    updates.colors = taxonomy.colors;
    updates.sizes = taxonomy.sizes;
  }
  if (updates.variantImages) {
    const photos = normalizeVariantPhotos(
      updates.variantImages,
      updates.images ?? current.images ?? [],
      updates.colors ?? current.colors ?? [],
    );
    if (photos.length) updates.variantImages = photos;
    else {
      // every link was removed - drop the stored field (a $set-only patch cannot)
      delete updates.variantImages;
      unsetKeys.push('variantImages');
    }
  }
  const updated = await dal.patch(slug, updates, unsetKeys);
  publish(topics.PRODUCT_UPSERTED, { slug: updated.slug });
  return updated;
}

export async function deleteProduct(slug) {
  const removed = await dal.remove(slug);
  if (!removed) throw notFound('Product not found');
  // images owned by this server (legacy local disk or our Cloudinary cloud) are
  // ownerless garbage after this - best-effort cleanup
  const owned = (removed.images || []).filter(
    (url) => String(url).startsWith('/uploads/') || /^https?:\/\/res\.cloudinary\.com\//i.test(String(url)),
  );
  await Promise.all(owned.map((url) => unsaveUploadedImageByUrl(url)));
  publish(topics.PRODUCT_DELETED, { slug });
  return null;
}

/** multipart upload transport -> persisted image metadata (see imageUploads.js for storage) */
export async function saveProductImage(file) {
  const saved = await saveUploadedImage(file);
  // Cloudinary returns an absolute URL; the local fallback returns a relative path the
  // client absolutizes against the API base (utils/images.js)
  return saved;
}

/** one multipart request carrying a whole gallery -> stored concurrently */
export async function saveProductImages(files) {
  return saveUploadedImages(files);
}

export async function listAllForAdmin({ page = 1, limit = 20, q }) {
  return dal.listAllAdmin({ page, limit, q });
}

/** single piece for the admin edit page: any state, including hidden/inactive products */
export async function adminProduct(slug) {
  const product = await dal.byAnySlug(slug);
  if (!product) throw notFound('Product not found');
  return dal.toPublicProduct(product);
}

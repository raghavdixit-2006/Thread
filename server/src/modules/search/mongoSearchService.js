// modules/search/mongoSearchService.js - catalogue search + facets, served by MongoDB.
//
// This is the only search implementation. The catalogue is the source of truth and
// the query runs directly against it, so there is no read model to sync and no
// external search cluster to keep alive:
//   { items, meta, facets } - same item fields as the no-q Mongo listing.
//
// Two passes for q, because $text cannot be OR-ed with a regex in one query:
//   1. text pass     - weighted text index ($text) + textScore relevance
//   2. prefix pass   - only when the text pass matched NOTHING: case-insensitive
//                      word-start regex on title/brand/category/colors (the
//                      live-typing stand-in for an autocomplete edge-ngram analyzer)
// Trade-off: no fuzziness, so typos ("chacoal") do not match. The prefix pass keeps
// partial typing functional, which is the common case while a shopper types.
import { Product } from '../../models/productModel.js';
import { toPublicProduct } from '../products/productsDal.js';
import { paginateMeta } from '../products/productsService.js';
import { logger } from '../../core/logger.js';

const SORTS = {
  featured: { isFeatured: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { avgRating: -1, ratingCount: -1 },
  name: { title: 1 },
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toList = (csv) => String(csv).split(',').map((v) => v.trim()).filter(Boolean);
const HIST_INTERVAL = 25_000; // paise - bar width for the price facet

function buildMatch(input, mode) {
  const match = { isActive: true };
  const selected = [...new Set([...(input.category ? [input.category] : []), ...toList(input.categories || '')])];
  if (selected.length === 1) match.category = selected[0];
  else if (selected.length > 1) match.category = { $in: selected };
  if (input.brand) match.brand = new RegExp(`^${escapeRegExp(input.brand)}$`, 'i');
  if (input.sizes) match.sizes = { $in: toList(input.sizes) };
  if (input.colors) match.colors = { $in: toList(input.colors) };
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    match.price = { ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}), ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}) };
  }
  if (input.minRating !== undefined) match.avgRating = { $gte: input.minRating };
  if (input.featured === true) match.isFeatured = true;

  if (input.q) {
    if (mode === 'text') {
      // $text must sit top-level; adding find-style predicates alongside it is fine
      match.$text = { $search: input.q };
      return match;
    }
    // word-start match so live typing works mid-title ("jack" finds "Rahul's Jacket")
    const prefix = new RegExp(`(^|\\s)${escapeRegExp(input.q)}`, 'i');
    match.$or = [{ title: prefix }, { brand: prefix }, { category: prefix }, { colors: prefix }];
  }
  return match;
}

function buildSort(input, mode) {
  // with q the relevance score leads and 'featured' is ignored; the text score
  // plays that role in the text pass
  if (mode === 'text') {
    const mapped = input.sort && input.sort !== 'featured' && SORTS[input.sort] ? SORTS[input.sort] : null;
    return { ...(mapped || {}), score: { $meta: 'textScore' } };
  }
  return SORTS[input.sort] || SORTS.featured;
}

async function runPipeline(input, mode) {
  const match = buildMatch(input, mode);
  const sort = buildSort(input, mode);

  // 1/3 - price stats; also sizes the histogram grid before the main aggregation
  const [statsRow] = await Product.aggregate([
    { $match: match },
    { $group: { _id: null, count: { $sum: 1 }, min: { $min: '$price' }, max: { $max: '$price' }, sum: { $sum: '$price' } } },
  ]);

  // 2/3 - one aggregation: paged items + total + term facets
  // ($text runs in the leading $match so the textScore metadata is available to
  // the top-level $sort; the $facet sub-pipelines keep the incoming order)
  const termFacet = (field, size, unwind = false) => [
    ...(unwind ? [{ $unwind: `$${field}` }] : []),
    { $group: { _id: `$${field}`, doc_count: { $sum: 1 } } },
    { $sort: { doc_count: -1, _id: 1 } },
    { $limit: size },
  ];
  const [agg] = await Product.aggregate([
    { $match: match },
    { $sort: sort },
    {
      $facet: {
        pageData: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
        total: [{ $count: 'count' }],
        categories: termFacet('category', 20),
        brands: [{ $match: { brand: { $exists: true, $ne: null } } }, ...termFacet('brand', 30)],
        colors: termFacet('colors', 30, true),
        sizes: termFacet('sizes', 10, true),
      },
    },
  ]);

  // 3/3 - price histogram over fixed grid edges ($bucket needs a known upper edge
  // from the stats pass; widened on expensive catalogues so the bar count stays sane)
  let histogram = [];
  if (statsRow) {
    let step = HIST_INTERVAL;
    if (Math.floor(statsRow.max / HIST_INTERVAL) > 63) step = Math.ceil(statsRow.max / 63 / HIST_INTERVAL) * HIST_INTERVAL;
    const boundaries = [0];
    for (let edge = step; edge <= statsRow.max + step; edge += step) boundaries.push(edge);
    const rows = await Product.aggregate([
      { $match: match },
      { $bucket: { groupBy: '$price', boundaries, default: 'other', output: { doc_count: { $sum: 1 } } } },
    ]);
    histogram = rows.filter((row) => Number.isFinite(row._id)).map((row) => ({ key: row._id, doc_count: row.doc_count }));
  }

  const items = (agg?.pageData || []).map(toPublicProduct);
  const total = agg?.total?.[0]?.count || 0;
  const buckets = (rows) => (rows || []).map((row) => ({ key: row._id, doc_count: row.doc_count }));
  return {
    items,
    total,
    facets: {
      categories: buckets(agg?.categories),
      brands: buckets(agg?.brands),
      colors: buckets(agg?.colors),
      sizes: buckets(agg?.sizes),
      price: statsRow ? { count: statsRow.count, min: statsRow.min, max: statsRow.max, avg: statsRow.sum / statsRow.count, sum: statsRow.sum } : null,
      priceHistogram: histogram,
    },
  };
}

export async function search(input) {
  let result = input.q ? await runPipeline(input, 'text') : await runPipeline(input, 'prefix');
  // full-token miss with nothing typed yet: give the prefix pass a chance
  // (live typing "jac" still finds the jackets - there is no fuzziness)
  if (input.q && result.total === 0) result = await runPipeline(input, 'prefix');
  return {
    items: result.items,
    meta: paginateMeta(result.total, input.page, input.limit),
    facets: result.facets,
  };
}

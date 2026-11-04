// modules/search/searchService.js - typo-tolerant search + facets (Elasticsearch read model).
// Mongo is the source of truth; this is the search read model (synced via event consumers).
import { client, INDEX } from '../../core/elastic.js';
import { serviceUnavailable } from '../../core/httpError.js';

const toList = (csv) => String(csv).split(',').map((v) => v.trim()).filter(Boolean);

export async function search(input) {
  const filters = [
    { term: { isActive: true } },
    ...(input.category ? [{ term: { category: input.category } }] : []),
    ...(input.categories ? [{ terms: { category: toList(input.categories) } }] : []),
    ...(input.brand ? [{ term: { brand: input.brand } }] : []),
    ...(input.sizes ? [{ term: { sizes: toList(input.sizes) } }] : []),
    ...(input.colors ? [{ term: { colors: toList(input.colors) } }] : []),
    ...(input.minPrice !== undefined || input.maxPrice !== undefined
      ? [
          {
            range: {
              price: {
                ...(input.minPrice !== undefined ? { gte: input.minPrice } : {}),
                ...(input.maxPrice !== undefined ? { lte: input.maxPrice } : {}),
              },
            },
          },
        ]
      : []),
    ...(input.minRating !== undefined ? [{ range: { avgRating: { gte: input.minRating } } }] : []),
    ...(input.featured === true ? [{ term: { isFeatured: true } }] : []),
  ];

  const params = {
    index: INDEX,
    from: (input.page - 1) * input.limit,
    size: input.limit,
    track_total_hits: true,
    query: {
      bool: {
        ...(input.q
          ? {
              must: [
                {
                  multi_match: {
                    query: input.q,
                    fields: ['title^2.5', 'description', 'brand^2', 'colors', 'autocomplete_text'],
                    fuzziness: 'AUTO',
                    operator: 'and',
                  },
                },
              ],
            }
          : { match_all: {} }),
        filter: filters,
      },
    },
    sort: SORT_MAP[input.sort] || ['_score'],
    aggs: {
      categories: { terms: { field: 'category', size: 20 } },
      brands: { terms: { field: 'brand', size: 30 } },
      colors: { terms: { field: 'colors', size: 30 } },
      sizes: { terms: { field: 'sizes', size: 10 } },
      price_stats: { stats: { field: 'price' } },
      price_histogram: { histogram: { field: 'price', interval: 25_000 } },
    },
  };

  let resp;
  try {
    resp = await client.search(params);
  } catch (err) {
    const type = err?.meta?.body?.error?.type || err?.cause?.type || 'unreachable';
    loggerSearchMiss(type, err);
    throw serviceUnavailable('Search engine unavailable right now', { reason: type });
  }

  const items = resp.hits.hits.map((h) => ({ ...h._source, score: h._score }));
  const total = resp.hits.total?.value ?? items.length;
  const bucket = (name) => resp.aggregations?.[name]?.buckets || [];

  return {
    items,
    meta: { total, page: input.page, limit: input.limit, pages: Math.max(1, Math.ceil(total / input.limit)) },
    facets: {
      categories: bucket('categories'),
      brands: bucket('brands'),
      colors: bucket('colors'),
      sizes: bucket('sizes'),
      price: resp.aggregations?.price_stats || null,
      priceHistogram: bucket('price_histogram'),
    },
  };
}

const SORT_MAP = {
  price_asc: [{ price: 'asc' }, '_score'],
  price_desc: [{ price: 'desc' }, '_score'],
  newest: [{ createdAt: 'desc' }, '_score'],
  rating: [{ avgRating: 'desc' }, { ratingCount: 'desc' }, '_score'],
  name: [{ 'title.raw': 'asc' }, '_score'],
};

import { logger } from '../../core/logger.js';
function loggerSearchMiss(type, err) {
  logger.warn({ type, err: err?.message }, 'elasticsearch search failed');
}

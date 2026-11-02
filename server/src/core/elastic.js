// core/elastic.js - Elasticsearch client + product index management.
// Mongo stays the source of truth; this is the read/search model.
import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
import { logger } from './logger.js';

export const client = new Client({ node: env.ELASTIC_NODE, maxRetries: 2, requestTimeout: 10_000 });
export const INDEX = env.ELASTIC_INDEX;

const mapping = {
  settings: {
    analysis: {
      analyzer: {
        autocomplete: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'edge_ngram_filter'] },
      },
      filter: {
        edge_ngram_filter: { type: 'edge_ngram', min_gram: 2, max_gram: 15 },
      },
    },
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      mongoId: { type: 'keyword' },
      slug: { type: 'keyword' },
      title: { type: 'text', fields: { raw: { type: 'keyword' } } },
      description: { type: 'text' },
      autocomplete_text: { type: 'text', analyzer: 'autocomplete', search_analyzer: 'standard' },
      brand: { type: 'keyword' },
      category: { type: 'keyword' },
      colors: { type: 'keyword' },
      sizes: { type: 'keyword' },
      price: { type: 'integer' }, // paise
      mrp: { type: 'integer' },
      avgRating: { type: 'half_float' },
      ratingCount: { type: 'integer' },
      isActive: { type: 'boolean' },
      isFeatured: { type: 'boolean' },
      image: { type: 'keyword' },
      createdAt: { type: 'date' },
    },
  },
};

export async function ensureIndex() {
  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    await client.indices.create({ index: INDEX, ...mapping });
    logger.info({ index: INDEX }, 'elastic index created');
  }
}

export async function getAll() {
  const result = await client.search({ index: INDEX, size: 10_000, query: { match_all: {} } });
  return result.hits.hits.map((h) => h._source);
}

export async function deleteIndex() {
  const exists = await client.indices.exists({ index: INDEX });
  if (exists) await client.indices.delete({ index: INDEX });
}

export async function reindexAll(products) {
  await deleteIndex();
  await ensureIndex();
  if (!products.length) return 0;
  await bulkIndex(docs(products));
  return products.length;
}

export const docs = (products) => products.filter((p) => p.isActive);

export async function bulkIndex(products) {
  if (!products.length) return;
  const body = products.flatMap((p) => [{ index: { _index: INDEX, _id: p.mongoId } }, p]);
  const resp = await client.bulk({ refresh: true, operations: body });
  if (resp.errors) {
    const sample = resp.items.find((i) => i.index.error)?.index.error;
    logger.warn({ sample }, 'elastic bulk indexing had errors');
  }
}

export async function upsert(product) {
  await client.index({ index: INDEX, id: String(product.mongoId), document: product, refresh: false });
}

export async function remove(mongoId) {
  try {
    await client.delete({ index: INDEX, id: String(mongoId) });
  } catch (err) {
    if (err.meta?.statusCode === 404) return;
    throw err;
  }
}

/** delete every indexed copy of a product by slug - used by the PRODUCT_DELETED
    consumer, which cannot reload the doc (it is already gone from Mongo). Everyone
    prior to this leaked ghosts into search. */
export async function removeBySlug(slug) {
  try {
    await client.deleteByQuery({ index: INDEX, query: { term: { slug: String(slug) } }, refresh: true });
  } catch (err) {
    if (err.meta?.statusCode === 404) return;
    throw err;
  }
}

export async function elasticHealth() {
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

let upState = { at: 0, value: false };
/** true when ES answers a ping; cached briefly so event consumers don't hammer a dead node. */
export async function isElasticUp(maxAgeMs = 15_000) {
  const now = Date.now();
  if (now - upState.at < maxAgeMs) return upState.value;
  upState.value = await elasticHealth();
  upState.at = now;
  return upState.value;
}

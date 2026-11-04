// modules/search/searchConsumers.js - keeps the ES read model in sync with Mongo events.
// Elasticsearch is optional infra: while it is unreachable the consumers idle instead
// of failing every catalog event - the Mongo fallback serves q search from the source
// of truth itself (modules/search/mongoSearchService.js), and ES catches back up via
// the seeder's full reindex the next time it is up.
import { subscribe, topics } from '../../core/eventBus.js';
import { upsert as elasticUpsert, bulkIndex, isElasticUp, removeBySlug as elasticRemoveBySlug } from '../../core/elastic.js';
import { toElasticDoc } from '../products/productDto.js';
import { Product } from '../../models/productModel.js';
import * as productsDal from '../products/productsDal.js';
import { logger } from '../../core/logger.js';

export function registerSearchConsumers() {
  const guarded = (work) => async (payload) => {
    if (!(await isElasticUp())) return;
    await work(payload);
  };

  subscribe(topics.PRODUCT_UPSERTED, guarded(async (pointer) => {
    // payload is a pointer, not a snapshot: load the source of truth before indexing
    const product = pointer?.slug ? await productsDal.byAnySlug(pointer.slug) : null;
    if (!product) return;
    const doc = toElasticDoc(product);
    if (doc.isActive) await elasticUpsert(doc);
    else await elasticRemove(doc.mongoId);
  }));

  subscribe(topics.PRODUCT_DELETED, guarded(async (pointer) => {
    // the doc is already gone from Mongo: purging by slug must NOT reload it
    // (the old code looked it up post-delete, got null and silently leaked the doc)
    if (!pointer?.slug) return;
    await elasticRemoveBySlug(pointer.slug);
  }));

  logger.info('search consumers registered');
}

/** Full rebuild from Mongo: used by the seeder. */
export async function reindexFromMongo() {
  const products = await Product.find({ isActive: true }).lean();
  const docs = products.map((p) => toElasticDoc({ ...p, _id: String(p._id) }));
  await bulkIndex(docs);
  logger.info({ count: docs.length }, 'elasticsearch reindexed from mongo');
  return docs.length;
}

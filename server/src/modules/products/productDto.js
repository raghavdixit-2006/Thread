// modules/products/productDto.js - shared mapping to the Elasticsearch document shape.
import { client as elasticClient, INDEX } from '../../core/elastic.js';

export function toElasticDoc(product) {
  const image = (product.images || [])[0] || '';
  return {
    mongoId: typeof product._id === 'object' ? String(product._id) : product._id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    autocomplete_text: `${product.title} ${product.brand || ''} ${product.category || ''} ${(product.colors || []).join(' ')}`,
    brand: product.brand,
    category: product.category,
    colors: product.colors || [],
    sizes: product.sizes || [],
    price: product.price,
    mrp: product.mrp,
    avgRating: product.avgRating || 0,
    ratingCount: product.ratingCount || 0,
    isActive: product.isActive !== false,
    isFeatured: Boolean(product.isFeatured),
    image,
    createdAt: product.createdAt || new Date(0).toISOString(),
  };
}

export async function indexOne(product) {
  const doc = toElasticDoc(product);
  if (doc) await elasticClient.index({ index: INDEX, id: doc.mongoId, document: doc });
}

// modules/products/productsController.js
import { ok, created } from '../../utils/response.js';
import { badRequest } from '../../core/httpError.js';
import * as service from './productsService.js';

export async function list(req, res) {
  return ok(res, await service.listProducts(req.data.query));
}

export async function get(req, res) {
  const { product } = await service.getProduct(req.data.params.slug);
  return ok(res, { product });
}

export async function related(req, res) {
  return ok(res, await service.getRelated(req.data.params.slug));
}

export async function featured(req, res) {
  return ok(res, await service.getFeatured(8));
}

export async function categories(req, res) {
  return ok(res, await service.getCategories());
}

// admin
export async function create(req, res) {
  return created(res, await service.createProduct(req.data.body, req.user));
}

export async function update(req, res) {
  return ok(res, await service.updateProduct(req.data.params.slug, req.data.body));
}

export async function remove(req, res) {
  await service.deleteProduct(req.data.params.slug);
  return res.status(204).send();
}

export async function listAdmin(req, res) {
  return ok(res, await service.listAllForAdmin(req.data.query));
}

// single piece for the admin edit page (any state, incl. hidden products)
export async function adminGet(req, res) {
  return ok(res, { product: await service.adminProduct(req.data.params.slug) });
}

// admin image upload (multipart): "images" accepts a batch (up to 8), "image" keeps the
// one-file contract. Storage rules live in imageUploads.
export async function uploadImage(req, res) {
  const files = [...(req.files?.images || []), ...(req.files?.image || [])];
  if (!files.length) throw badRequest('No image files in the request - use the "images" field');
  const saved = await service.saveProductImages(files);
  // top-level url/filename preserves the original single-image response; images is the batch
  return ok(res, { ...saved[0], images: saved });
}

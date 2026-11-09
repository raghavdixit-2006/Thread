// modules/products/routes.js
import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../core/validate.js';
import { adminRequired } from '../../core/middleware/auth.js';
import { uploadLimiter } from '../../core/rateLimit.js';
import { listQuerySchema, slugParamsSchema, createProductSchema, updateProductSchema, adminListSchema } from './schemas.js';
import { imageUpload, mapUploadError, MAX_BATCH_FILES } from './imageUploads.js';
import * as controller from './productsController.js';

export function productRoutes() {
  const router = Router();

  router.get('/', validateQuery(listQuerySchema), controller.list);
  router.get('/categories', controller.categories);
  router.get('/featured', controller.featured);

  // admin catalogue management (declared before /:slug so "admin" is never swallowed)
  router.get('/admin', adminRequired, validateQuery(adminListSchema), controller.listAdmin);
  // single piece for the edit page (includes inactive - public GET would 404 them)
  router.get('/admin/:slug', adminRequired, validateParams(slugParamsSchema), controller.adminGet);

  // admin image upload (Cloudinary when configured, local disk fallback; multipart,
  // content-sniffed, 4MB/file, up to 8 files). "images" is the batch field, "image"
  // remains accepted for single-file callers. Multer errors become HttpError here.
  router.post(
    '/admin/uploads',
    adminRequired,
    uploadLimiter,
    (req, res, next) =>
      imageUpload.fields([
        { name: 'images', maxCount: MAX_BATCH_FILES },
        { name: 'image', maxCount: 1 },
      ])(req, res, (err) => next(err ? mapUploadError(err) || err : undefined)),
    controller.uploadImage,
  );

  router.get('/:slug', validateParams(slugParamsSchema), controller.get);
  router.get('/:slug/related', validateParams(slugParamsSchema), controller.related);

  router.post('/admin', adminRequired, validateBody(createProductSchema), controller.create);
  // params validated like every other :slug route - req.data.params is null without it
  router.patch('/admin/:slug', adminRequired, validateParams(slugParamsSchema), validateBody(updateProductSchema.partial()), controller.update);
  router.delete('/admin/:slug', adminRequired, validateParams(slugParamsSchema), controller.remove);

  return router;
}

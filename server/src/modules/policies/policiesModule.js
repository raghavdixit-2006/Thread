// modules/policies/policiesModule.js - legal content served from the backend (docs skill §9).
// Public read endpoints; admin upserts. Register flow stores the terms version.
import { Router } from 'express';
import { z } from 'zod';
import { Policy } from '../../models/policyModel.js';
import { ok, created } from '../../utils/response.js';
import { adminRequired } from '../../core/middleware/auth.js';
import { validateBody } from '../../core/validate.js';

const upsertSchema = z
  .object({
    slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
    title: z.string().trim().min(3).max(120),
    category: z.enum(['legal', 'shipping', 'terms', 'privacy', 'cookie', 'contact']).default('legal'),
    bodyMarkdown: z.string().trim().min(50).max(200_000),
    version: z.string().trim().max(16).default('1.0.0'),
    effectiveDate: z.coerce.date().optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

async function listPolicies(_req, res) {
  const items = await Policy.find({ isActive: true }).select('slug title category version effectiveDate updatedAt').sort({ updatedAt: -1 }).lean();
  return ok(res, { items });
}

async function getPolicy(req, res) {
  const slug = String(req.params.slug).toLowerCase();
  const policy = await Policy.findOne({ slug, isActive: true }).lean();
  if (!policy) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No policy named ${slug}` } });
  }
  return ok(res, { policy });
}

async function upsert(req, res) {
  const body = req.data.body;
  const policy = await Policy.findOneAndUpdate({ slug: body.slug }, { ...body }, { upsert: true, new: true }).lean();
  return created(res, policy);
}

export function policyRoutes() {
  const router = Router();
  router.get('/', listPolicies);
  router.get('/:slug', getPolicy);
  return router;
}

export function policyAdminRoutes() {
  const router = Router();
  router.use(adminRequired);
  router.post('/', validateBody(upsertSchema), upsert);
  return router;
}

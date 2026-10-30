// modules/products/imageUploads.js - dynamic product image storage.
// Admin uploads go to Cloudinary (signed REST API, credentials from CLOUDINARY_*)
// when configured; local disk (server/uploads, served as /uploads) is the fallback.
// Batches are content-checked FIRST and then stored concurrently, so a gallery upload
// is one fast request instead of N sequential round-trips.
// Static landing-page imagery never passes through here - it lives in client/public.
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { HttpError } from '../../core/httpError.js';
import { env, cloudinaryEnabled } from '../../core/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// modules/products -> server/uploads (same root as the /products photography dir)
export const UPLOADS_DIR = path.join(here, '..', '..', '..', 'uploads');

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB per image
export const MAX_BATCH_FILES = 8; // a full product gallery in one request
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const CLOUDINARY_HOST = 'res.cloudinary.com';

// zero-trust: the multipart mimetype header is client-controlled, so saved files are
// re-proved by content (magic bytes) before storage accepts them
function detectMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  const riff = buffer.subarray(0, 4).toString('latin1');
  const webpTag = buffer.subarray(8, 12).toString('latin1');
  if (riff === 'RIFF' && webpTag === 'WEBP') return 'image/webp';
  const ftyp = buffer.subarray(4, 8).toString('latin1');
  const brand = buffer.subarray(8, 12).toString('latin1').trim();
  if (ftyp === 'ftyp' && ['avif', 'av01', 'avis', 'mif1', 'msf1'].includes(brand)) return 'image/avif';
  return null;
}

export const imageUpload = multer({
  storage: multer.memoryStorage(), // nothing is stored until the signature check passes
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_BATCH_FILES },
  fileFilter: (_req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) {
      return cb(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, WebP or AVIF images are accepted'));
    }
    cb(null, true);
  },
});

/** multer middleware errors -> HttpError so the boundary keeps the JSON envelope */
export function mapUploadError(err) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return new HttpError(400, 'IMAGE_TOO_LARGE', 'Each image must be 4MB or smaller');
  }
  if (err?.code === 'LIMIT_FILE_COUNT') {
    return new HttpError(400, 'TOO_MANY_IMAGES', `Upload at most ${MAX_BATCH_FILES} images at a time`);
  }
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return new HttpError(400, 'UPLOAD_REJECTED', 'Use the "images" field for uploads');
  }
  if (err?.name === 'MulterError') {
    return new HttpError(400, 'UPLOAD_REJECTED', 'Upload rejected');
  }
  return null;
}

function validatedUpload(file) {
  const mime = detectMime(file?.buffer);
  if (!mime || !EXT_BY_MIME[mime]) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'File content is not a supported image (JPEG, PNG, WebP, AVIF)');
  }
  return { buffer: file.buffer, mime };
}

// ---------- Cloudinary driver (signed REST, no SDK dependency) ----------

/** Cloudinary signs the alphabetically-sorted params with the API secret (sha1). */
function cloudinarySignature(params) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(payload + env.CLOUDINARY_API_SECRET).digest('hex');
}

function cloudinaryEndpoint(action) {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/${action}`;
}

async function uploadToCloudinary(buffer, mime) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = env.CLOUDINARY_FOLDER;
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), `upload.${EXT_BY_MIME[mime]}`);
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', cloudinarySignature({ folder, timestamp }));

  let response;
  try {
    response = await fetch(cloudinaryEndpoint('upload'), {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(502, 'IMAGE_STORAGE_UNAVAILABLE', 'Image storage is unreachable, please try again');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.secure_url) {
    throw new HttpError(502, 'IMAGE_STORAGE_UNAVAILABLE', 'Image storage rejected the upload, please try again');
  }
  let parsed;
  try {
    parsed = new URL(data.secure_url);
  } catch {
    throw new HttpError(502, 'IMAGE_STORAGE_UNAVAILABLE', 'Image storage returned an invalid URL');
  }
  // never persist a URL that does not point at our Cloudinary account
  if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) {
    throw new HttpError(502, 'IMAGE_STORAGE_UNAVAILABLE', 'Image storage returned an unexpected URL');
  }
  return { filename: String(data.public_id || ''), url: data.secure_url, bytes: data.bytes || buffer.length, mime };
}

/** public_id from a Cloudinary delivery URL (ours only: matching cloud name). */
function cloudinaryPublicId(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (decodeURIComponent(parts[0] || '') !== env.CLOUDINARY_CLOUD_NAME) return null;
    const uploadAt = parts.indexOf('upload');
    if (uploadAt === -1) return null;
    let rest = parts.slice(uploadAt + 1);
    if (/^v\d+$/.test(rest[0] || '')) rest = rest.slice(1);
    // transformations may prefix the path; the public id is still the trailing path
    const publicId = decodeURIComponent(rest.join('/')).replace(/\.(jpe?g|png|webp|avif)$/i, '');
    return publicId || null;
  } catch {
    return null;
  }
}

async function destroyOnCloudinary(url) {
  const publicId = cloudinaryPublicId(url);
  if (!publicId) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', cloudinarySignature({ public_id: publicId, timestamp }));
  await fetch(cloudinaryEndpoint('destroy'), {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
}

async function storeValidated(buffer, mime) {
  if (cloudinaryEnabled) return uploadToCloudinary(buffer, mime);

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `p_${randomUUID().replace(/-/g, '')}.${EXT_BY_MIME[mime]}`;
  const target = path.join(UPLOADS_DIR, filename);
  if (!target.startsWith(UPLOADS_DIR)) throw new HttpError(400, 'UPLOAD_REJECTED', 'Bad upload path'); // belt+braces
  await fs.writeFile(target, buffer);
  return { filename, url: `/uploads/${filename}`, bytes: buffer.length, mime };
}

// ---------- public storage API ----------

/**
 * Persist one batch: every file is content-proved before ANY write, then the batch is
 * stored concurrently. If one remote write fails, already-written siblings are removed
 * so a failed gallery upload leaves no orphans.
 */
export async function saveUploadedImages(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new HttpError(400, 'UPLOAD_REJECTED', 'No image files were received');
  }
  if (files.length > MAX_BATCH_FILES) {
    throw new HttpError(400, 'TOO_MANY_IMAGES', `Upload at most ${MAX_BATCH_FILES} images at a time`);
  }
  const validated = files.map(validatedUpload); // throws before storage if any file is bogus
  const results = await Promise.allSettled(validated.map(({ buffer, mime }) => storeValidated(buffer, mime)));
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    const written = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    await Promise.all(written.map((entry) => unsaveUploadedImageByUrl(entry.url)));
    throw failed.reason;
  }
  return results.map((result) => result.value);
}

/** persist a single validated upload (kept for the one-file contract). */
export async function saveUploadedImage(file) {
  const [saved] = await saveUploadedImages([file]);
  return saved;
}

/** best-effort removal of an image this server owns (local /uploads or our Cloudinary cloud). */
export async function unsaveUploadedImageByUrl(url) {
  const value = String(url || '');
  if (cloudinaryEnabled && cloudinaryPublicId(value)) {
    try {
      await destroyOnCloudinary(value);
    } catch {
      // cleanup must never fail the API answer
    }
    return;
  }
  try {
    const file = value.split('/uploads/')[1];
    if (!file || file.includes('/') || file.includes('..')) return;
    await fs.rm(path.join(UPLOADS_DIR, file), { force: true });
  } catch {
    // cleanup must never fail the API answer
  }
}

// components/features/ProductImagesEditor.jsx - ordered product gallery in the admin form.
// The first slot is the MAIN image everywhere in the shop (product page, home, cart).
// Each photo may be linked to a variant colour (single-owner tags, node in the hook) -
// the linked photo is what the product page shows for that colour and what cart/order
// lines show. Two sources: direct file upload (POST /api/products/admin/uploads,
// Cloudinary when configured) and pasted image URLs. The returned url goes onto the
// list verbatim, so the storage driver stays server-side.
import { useRef, useState } from 'react';
import { useAdminUploadImageMutation } from '../../services/productsApi.js';
import { productImageUrl } from '../../utils/images.js';
import { MAX_IMAGES } from '../../hooks/useProductForm.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const COMPRESS_ABOVE_BYTES = 1_000_000; // anything bigger is downscaled before the network hop
const MAX_UPLOAD_EDGE = 2000;

function uploadErrorText(error) {
  const message = error?.data?.message || error?.data?.error?.message || error?.message || '';
  return message || 'Upload failed - try again';
}

/** Downscale/re-encode big camera files locally so a gallery upload stays fast and under 4MB. */
async function shrinkImage(file) {
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === 'function') bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file; // unsupported decoder / canvas failure: send the original
  }
}

export default function ProductImagesEditor({ images, colors, formError, linkError, onImages, onPhotoColor }) {
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);
  const [uploadImage] = useAdminUploadImageMutation();

  async function onFilesPicked(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setNote('Up to 8 images per product');
      return;
    }
    setNote(null);
    setUploading(true);
    setUploadTotal(Math.min(files.length, room));
    try {
      // one multipart request: the server uploads the batch to Cloudinary concurrently
      const prepared = await Promise.all(files.slice(0, room).map(shrinkImage));
      const data = new FormData();
      prepared.forEach((file) => data.append('images', file, file.name));
      const saved = await uploadImage(data).unwrap();
      const stored = (Array.isArray(saved?.images) ? saved.images : [saved]).filter((entry) => entry?.url);
      if (!stored.length) throw new Error('The server stored no images');
      onImages([...images, ...stored.map((entry) => ({ url: entry.url, color: '' }))]);
      if (files.length > stored.length) setNote(`Gallery is full - ${stored.length} of ${files.length} image(s) added`);
    } catch (error) {
      setNote(uploadErrorText(error));
    } finally {
      setUploading(false);
      setUploadTotal(0);
    }
  }

  function onAddUrl(event) {
    event.preventDefault();
    const clean = urlInput.trim();
    if (!/^(https?:\/\/\S+|\/\S+)$/i.test(clean)) {
      setNote('Enter an absolute http(s) image link or a server path');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setNote('Up to 8 images per product');
      return;
    }
    setNote(null);
    onImages([...images, { url: clean, color: '' }]);
    setUrlInput('');
  }

  function onRemove(index) {
    setNote(null);
    const next = images.filter((_v, at) => at !== index);
    onImages(next);
  }

  function onMakeMain(index) {
    setNote(null);
    const next = [...images];
    const [picked] = next.splice(index, 1);
    onImages([picked, ...next]);
  }

  return (
    <div className="field admin-editor">
      <span className="form-label">
        Images - the first one is the main image. Link a photo to a colour so that colour gets its own photos
      </span>
      {(formError || linkError || note) && (
        <p className="field-error" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden="true" /> {formError || linkError || note}
        </p>
      )}

      {images.length === 0 ? (
        <p className="hint">No images yet. Upload photo files (or paste a URL) below - re-order to put the cover shot first.</p>
      ) : (
        <div className="admin-gallery">
          {images.map((entry, index) => (
            <figure className={`admin-img ${index === 0 ? 'is-main' : ''}`} key={`${entry.url}-${index}`}>
              <img src={productImageUrl(entry.url)} alt="" loading="lazy" />
              <figcaption className="admin-img-tag">
                {index === 0 ? 'Main' : `Side ${index}`}
                {entry.color.trim() ? ` - linked: ${entry.color.trim()}` : ' - shared'}
              </figcaption>
              <select
                className="admin-img-color"
                value={entry.color}
                onChange={(event) => onPhotoColor(index, event.target.value)}
                aria-label={`Colour link for image ${index + 1}`}
              >
                <option value="">All colours (shared)</option>
                {colors.map((color) => (
                  <option key={color} value={color}>Linked: {color}</option>
                ))}
              </select>
              <div className="admin-img-actions">
                {index === 0 ? (
                  <span className="admin-img-quiet">Cover shot</span>
                ) : (
                  <button type="button" className="text-link" onClick={() => onMakeMain(index)}>
                    Set as main
                  </button>
                )}
                <button type="button" className="icon-link admin-img-remove" onClick={() => onRemove(index)} aria-label={`Remove image ${index + 1}`}>
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <div className="admin-img-sources">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={onFilesPicked}
          className="visually-hidden-input"
          aria-label="Upload image files"
          disabled={uploading}
        />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <i className={uploading ? 'bi bi-arrow-repeat spin' : 'bi bi-cloud-arrow-up'} aria-hidden="true" />
          {uploading ? (uploadTotal > 1 ? `Uploading ${uploadTotal} images` : 'Uploading') : 'Upload image files'}
        </button>
        <span className="admin-img-or">or</span>
        {/* plain div: a nested <form> here would be collapsed by the browser inside
            ProductForm and the button would submit the outer form instead */}
        <div className="admin-img-url">
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://... image URL"
            aria-label="Image URL"
          />
          <button type="button" className="btn" onClick={onAddUrl} disabled={uploading}>
            Add URL
          </button>
        </div>
      </div>
      <p className="hint">Select several files at once (up to 8 per upload). JPEG, PNG, WebP or AVIF, 4MB each - large photos are compressed in your browser first. External URLs stay as links. One photo per colour - tagging again moves the link.</p>
    </div>
  );
}


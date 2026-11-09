// components/features/ProductForm.jsx - create/edit catalogue piece (admin, RBAC enforced server-side).
// Money contract: MRP + discount % are entered and the SERVER derives the selling price -
// nothing else is sent. Image gallery (upload/URL, main + sides, colour links) and colour
// groups (per-variant price, per-size stock) live in ProductImagesEditor /
// ProductVariantsEditor; state and money conversions in hooks/useProductForm.js.
// Colours and sizes taxonomy is derived server-side from the variants.
import { useState } from 'react';
import { useAdminCreateProductMutation, useAdminUpdateProductMutation } from '../../services/productsApi.js';
import useProductForm, { derivedPricePaise } from '../../hooks/useProductForm.js';
import { formatINR } from '../../utils/format.js';
import { PRODUCT_CATEGORIES } from '../../utils/constants.js';
import ProductImagesEditor from './ProductImagesEditor.jsx';
import ProductVariantsEditor from './ProductVariantsEditor.jsx';
import ErrorNote from '../common/ErrorNote.jsx';

export default function ProductForm({ product, productSlug, onClose }) {
  const isEdit = Boolean(product);
  const { form, errors, setField, setImages, setPhotoColor, setGroupField, addGroup, removeGroup, addRow, setRow, removeRow, validate } = useProductForm(product);
  const [createProduct, { isLoading: creating }] = useAdminCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useAdminUpdateProductMutation();
  const [apiError, setApiError] = useState(null);

  const saving = creating || updating;
  const sellPaise = derivedPricePaise(form.mrpRupees, form.discountPercent);
  const basePriceLabel = sellPaise ? formatINR(sellPaise).replace(/^₹/, 'Rs ') : 'the derived price';
  const colorsPicked = [...new Set(form.groups.map((group) => group.color.trim()).filter(Boolean))];
  const sizesPicked = [...new Set(form.groups.flatMap((group) => group.sizes.map((row) => row.size)).filter(Boolean))];

  /** unlink a colour-tagged photo straight from the variant group it backs */
  function unlinkPhoto(url) {
    const at = form.images.findIndex((entry) => entry.url === url);
    if (at !== -1) setPhotoColor(at, '');
  }

  async function onSubmit(event) {
    event.preventDefault();
    setApiError(null);
    const payload = validate();
    if (!payload) return;
    try {
      if (isEdit) await updateProduct({ slug: productSlug, ...payload }).unwrap();
      else await createProduct(payload).unwrap();
      onClose();
    } catch (error) {
      setApiError(error);
    }
  }

  return (
    <form className="panel product-form" onSubmit={onSubmit} noValidate>
      <div className="section-head">
        <h3>{isEdit ? `Edit: ${product.title}` : 'New catalogue piece'}</h3>
        <button type="button" className="text-link" onClick={onClose} aria-label="Close product form">
          <i className="bi bi-x-lg" aria-hidden="true" /> Close
        </button>
      </div>

      {apiError && <ErrorNote error={apiError} />}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="prod-title">Title</label>
          <input id="prod-title" value={form.title} onChange={(event) => setField('title', event.target.value)} required minLength={3} maxLength={120} />
          {errors.title && <span className="result-count">{errors.title}</span>}
        </div>
        <div className="field">
          <label htmlFor="prod-category">Category</label>
          <select id="prod-category" value={form.category} onChange={(event) => setField('category', event.target.value)}>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="prod-description">Description</label>
        <textarea id="prod-description" rows={3} value={form.description} onChange={(event) => setField('description', event.target.value)} required minLength={10} />
        {errors.description && <span className="result-count">{errors.description}</span>}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="prod-mrp">MRP (rupees)</label>
          <input id="prod-mrp" inputMode="numeric" value={form.mrpRupees} onChange={(event) => setField('mrpRupees', event.target.value)} required />
          {errors.mrpRupees && <span className="result-count">{errors.mrpRupees}</span>}
        </div>
        <div className="field">
          <label htmlFor="prod-discount">Discount % off MRP (0-90, blank = none)</label>
          <input
            id="prod-discount"
            inputMode="numeric"
            value={form.discountPercent}
            onChange={(event) => setField('discountPercent', event.target.value.replace(/\D/g, '').slice(0, 2))}
          />
          {errors.discountPercent && <span className="result-count">{errors.discountPercent}</span>}
        </div>
        <div className="field">
          <label htmlFor="prod-brand">Brand</label>
          <input id="prod-brand" value={form.brand} onChange={(event) => setField('brand', event.target.value)} />
        </div>
      </div>
      <p className="hint derived-price-hint">
        {sellPaise ? (
          <>
            Selling price the shop shows: <strong>{formatINR(sellPaise)}</strong>
            {Number(form.discountPercent) > 0 ? ` (MRP ${formatINR(derivedPricePaise(form.mrpRupees, 0))})` : ' - sold at MRP'}
            . The server computes it from MRP + discount; a per-colour or per-size price below overrides it in rupees.
          </>
        ) : (
          'Enter an MRP and the selling price is computed from the discount.'
        )}
      </p>

      <ProductImagesEditor
        images={form.images}
        colors={colorsPicked}
        formError={errors.images}
        linkError={errors.photos}
        onImages={setImages}
        onPhotoColor={setPhotoColor}
      />

      <ProductVariantsEditor
        groups={form.groups}
        photos={form.images}
        basePriceLabel={basePriceLabel}
        errors={errors}
        ops={{ setGroupField, addGroup, removeGroup, addRow, setRow, removeRow, unlinkPhoto }}
      />
      {(colorsPicked.length > 0 || sizesPicked.length > 0) && (
        <p className="hint product-form-derived">
          The shop reads colours and sizes from the variant rows above
          {colorsPicked.length ? ` - colours: ${colorsPicked.join(', ')}` : ''}
          {sizesPicked.length ? ` - sizes: ${sizesPicked.join(', ')}` : ''}.
        </p>
      )}

      <div className="form-row admin-product-toggles">
        <label htmlFor="prod-featured">
          <input id="prod-featured" type="checkbox" checked={form.isFeatured} onChange={(event) => setField('isFeatured', event.target.checked)} />
          Featured on the home page
        </label>
        <label htmlFor="prod-active">
          <input id="prod-active" type="checkbox" checked={form.isActive} onChange={(event) => setField('isActive', event.target.checked)} />
          Active in the shop
        </label>
      </div>

      <div className="product-form-actions">
        <button type="submit" className="btn" disabled={saving}>
          <i className="bi bi-save" aria-hidden="true" /> {saving ? 'Saving' : isEdit ? 'Save changes' : 'Create product'}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}


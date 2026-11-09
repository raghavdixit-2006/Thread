// components/features/ProductVariantsEditor.jsx - colour groups in the product form.
// Colour/size prices stay ABSOLUTE rupees (blank inherits the derived selling price - the
// server computes it from MRP + discount %, so no selling price is entered anywhere);
// each size row inside the group carries its own stock count and an optional per-size
// price override. Photos linked to the colour show under the group head with unlink
// actions; the rows are expanded to flat server-side variant rows by the form hook.
import { PRODUCT_SIZES } from '../../utils/constants.js';

export default function ProductVariantsEditor({ groups, photos, basePriceLabel, errors, ops }) {
  // ops: { setGroupField, addGroup, removeGroup, addRow, setRow, removeRow, unlinkPhoto }
  const linked = (group) => {
    const owner = group.color.trim().toLowerCase();
    if (!owner) return [];
    return photos.filter((entry) => entry.color.trim().toLowerCase() === owner);
  };
  return (
    <div className="field admin-editor">
      <span className="form-label">Variants - a colour group holds its own price and a stock count per size</span>
      {errors.groups && (
        <p className="field-error" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden="true" /> {errors.groups}
        </p>
      )}

      {groups.map((group, gi) => {
        const linkedPhotos = linked(group);
        return (
          <section className="variant-group" key={gi} aria-label={`Colour group ${gi + 1}`}>
            <div className="form-grid variant-group-head">
              <div className="field">
                <label htmlFor={`g${gi}-color`}>Colour / variant name</label>
                <input
                  id={`g${gi}-color`}
                  value={group.color}
                  onChange={(event) => ops.setGroupField(gi, 'color', event.target.value)}
                  className={errors[`g${gi}-color`] ? 'is-invalid' : ''}
                  aria-invalid={Boolean(errors[`g${gi}-color`])}
                  aria-describedby={errors[`g${gi}-color`] ? `g${gi}-color-error` : undefined}
                  placeholder="Charcoal"
                />
                {errors[`g${gi}-color`] && (
                  <p className="field-error" id={`g${gi}-color-error`} role="alert">
                    <i className="bi bi-exclamation-circle" aria-hidden="true" /> {errors[`g${gi}-color`]}
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor={`g${gi}-price`}>Variant price (rupees, blank = {basePriceLabel})</label>
                <input
                  id={`g${gi}-price`}
                  inputMode="numeric"
                  value={group.price}
                  onChange={(event) => ops.setGroupField(gi, 'price', event.target.value.replace(/[^\d.]/g, '').slice(0, 7))}
                  className={errors[`g${gi}-price`] ? 'is-invalid' : ''}
                  aria-invalid={Boolean(errors[`g${gi}-price`])}
                  placeholder={`Inherits ${basePriceLabel}`}
                />
                {errors[`g${gi}-price`] && (
                  <p className="field-error" role="alert">
                    <i className="bi bi-exclamation-circle" aria-hidden="true" /> {errors[`g${gi}-price`]}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="icon-link variant-group-remove"
                onClick={() => ops.removeGroup(gi)}
                aria-label={`Remove colour group ${gi + 1}`}
                title="Remove this colour"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {linkedPhotos.length > 0 ? (
              <div className="variant-linked" aria-label={`Photos linked to ${group.color}`}>
                <span className="admin-img-or">Photos of this colour:</span>
                {linkedPhotos.map((entry) => (
                  <figure className="variant-linked-item" key={entry.url}>
                    <img src={entry.url} alt={`Photo linked to ${group.color}`} loading="lazy" />
                    <button
                      type="button"
                      className="icon-link variant-linked-unlink"
                      onClick={() => ops.unlinkPhoto(entry.url)}
                      aria-label={`Unlink photo from ${group.color}`}
                      title="Unlink from this colour"
                    >
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="hint variant-linked-empty">No photo linked to this colour - it shares the gallery until you tag one above.</p>
            )}

            {errors[`g${gi}-rows`] && (
              <p className="field-error" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden="true" /> {errors[`g${gi}-rows`]}
              </p>
            )}

            <div className="variant-rows" role="table" aria-label={`Sizes in ${group.color || `colour group ${gi + 1}`}`}>
              <span className="variant-cols" role="columnheader">Size</span>
              <span className="variant-cols" role="columnheader">Stock</span>
              <span className="variant-cols" role="columnheader">Price override (Rs, blank = variant)</span>
              <span className="variant-cols" role="columnheader" />
              {group.sizes.map((row, ri) => (
                <div className="variant-grid-row" key={ri} role="row">
                  <select
                    className={errors[`g${gi}-r${ri}-size`] ? 'is-invalid' : ''}
                    aria-label={`Size in colour group ${gi + 1}, row ${ri + 1}`}
                    value={row.size}
                    onChange={(event) => ops.setRow(gi, ri, 'size', event.target.value)}
                  >
                    <option value="" disabled>Size</option>
                    {PRODUCT_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <input
                    inputMode="numeric"
                    aria-label={`Stock for size ${row.size || 'in colour group ' + (gi + 1)}, row ${ri + 1}`}
                    placeholder="Units"
                    value={row.stock}
                    onChange={(event) => ops.setRow(gi, ri, 'stock', event.target.value.replace(/\D/g, '').slice(0, 4))}
                    className={errors[`g${gi}-r${ri}-stock`] ? 'is-invalid' : ''}
                  />
                  <input
                    inputMode="numeric"
                    aria-label={`Price override for size ${row.size || 'in colour group ' + (gi + 1)}, row ${ri + 1}`}
                    placeholder="Variant price"
                    value={row.price}
                    onChange={(event) => ops.setRow(gi, ri, 'price', event.target.value.replace(/[^\d.]/g, '').slice(0, 7))}
                  />
                  <button
                    type="button"
                    className="icon-link"
                    onClick={() => ops.removeRow(gi, ri)}
                    aria-label={`Remove row ${ri + 1} in colour group ${gi + 1}`}
                    title="Remove size row"
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {(errors[`g${gi}-r0-size`] || errors[`g${gi}-r1-size`]) && (
              <p className="field-error" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden="true" /> {errors[`g${gi}-r0-size`] || errors[`g${gi}-r1-size`]}
              </p>
            )}
            <div className="variant-group-foot">
              <button type="button" className="text-link" onClick={() => ops.addRow(gi)}>
                <i className="bi bi-plus-lg" aria-hidden="true" /> Add size row
              </button>
            </div>
          </section>
        );
      })}

      <div>
        <button type="button" className="text-link" onClick={ops.addGroup}>
          <i className="bi bi-plus-lg" aria-hidden="true" /> Add colour variant
        </button>
      </div>
    </div>
  );
}


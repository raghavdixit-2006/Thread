// components/features/AdminProducts.jsx - admin catalogue list: searchable (incl.
// inactive), delete with confirm, RBAC handled server-side. Add and edit open their own
// pages (/admin/products/new, /admin/products/:slug/edit) - no inline form here anymore.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminListProductsQuery,
  useAdminRemoveProductMutation,
} from '../../services/productsApi.js';
import { formatINR, discountPercent } from '../../utils/format.js';
import { productImageUrl } from '../../utils/images.js';
import ErrorNote from '../common/ErrorNote.jsx';
import Spinner from '../common/Spinner.jsx';
import Pagination from '../common/Pagination.jsx';

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [q, setQ] = useState('');
  const [rowError, setRowError] = useState(null);
  const navigate = useNavigate();

  const [removeProduct, { isLoading: removing }] = useAdminRemoveProductMutation();
  const list = useAdminListProductsQuery({ page, limit: 20, ...(q ? { q } : {}) });

  const rows = list.data?.items || [];
  // listAllAdmin returns { items, total } (no meta) - build meta for the shared pager
  const total = list.data?.total ?? 0;
  const meta = { page, pages: Math.max(1, Math.ceil(total / 20)), total };

  // add/edit live on their own pages - this list only points at them
  function openAdd() {
    navigate('/admin/products/new');
  }
  function openEdit(product) {
    navigate(`/admin/products/${encodeURIComponent(product.slug)}/edit`);
  }

  async function onDelete(product) {
    if (!window.confirm(`Delete "${product.title}"? The piece leaves the shop and the catalogue index.`)) return;
    setRowError(null);
    try {
      await removeProduct(product.slug).unwrap();
    } catch (error) {
      setRowError(error);
    }
  }

  function onSearch(event) {
    event.preventDefault();
    setQ(queryInput.trim());
    setPage(1);
  }

  return (
    <section aria-label="Product catalogue management">
      <div className="shop-toolbar">
        <form className="admin-search" onSubmit={onSearch}>
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search title or slug"
            aria-label="Search catalogue"
          />
          <button type="submit" className="btn" aria-label="Search catalogue">
            <i className="bi bi-search" aria-hidden="true" />
          </button>
        </form>
        <span className="sort-box">
          <button type="button" className="btn" onClick={openAdd}>
            <i className="bi bi-plus-lg" aria-hidden="true" /> Add product
          </button>
        </span>
      </div>

      {rowError && <ErrorNote error={rowError} onRetry={list.refetch} />}
      {list.error && <ErrorNote error={list.error} onRetry={list.refetch} />}
      {list.isLoading && <Spinner label="Loading the catalogue" />}

      {list.data && (
        <div className="shop-meta">
          <span className="result-count">
            {total} piece{total === 1 ? '' : 's'}
            {q ? ` matching "${q}"` : ''}
          </span>
        </div>
      )}

      {list.data && rows.length === 0 && (
        <p className="result-count">No products in this view. {q ? 'Try another search.' : 'Add the first piece.'}</p>
      )}

      {rows.length > 0 && (
        <div className="admin-rows">
          {rows.map((product) => {
            const stock = (product.variants || []).reduce((sum, variant) => sum + (variant.stock || 0), 0);
            const off = discountPercent(product.price, product.mrp);
            return (
              <article key={product.slug} className="admin-product-row">
                <img className="admin-product-thumb" src={productImageUrl((product.images || [])[0])} alt="" loading="lazy" />
                <span className="admin-product-main">
                  <strong>{product.title}</strong>
                  <span className="admin-row-sub">
                    {product.slug} - {product.category} - {product.brand}
                  </span>
                </span>
                <span className="admin-product-meta">
                  <strong className="price">
                    {formatINR(product.price)} {off && <span className="price-off">{off}</span>}
                  </strong>
                  <span className="admin-row-sub">{product.mrp > product.price ? `${formatINR(product.mrp)} mrp` : 'no discount'}</span>
                </span>
                <span className="admin-product-meta">
                  <strong>{stock} in stock</strong>
                  <span className="admin-row-sub">{(product.variants || []).length} variant(s)</span>
                </span>
                <span className={`order-status ${product.isActive ? 'delivered' : 'cancelled'}`}>
                  {product.isActive ? 'Active' : 'Hidden'}
                </span>
                <span className="admin-actions admin-actions-inline">
                  <button type="button" className="btn" onClick={() => openEdit(product)} disabled={removing}>
                    <i className="bi bi-pencil" aria-hidden="true" /> Edit
                  </button>
                  <button type="button" className="btn" onClick={() => onDelete(product)} disabled={removing}>
                    <i className="bi bi-trash3" aria-hidden="true" /> Delete
                  </button>
                </span>
              </article>
            );
          })}
          <Pagination meta={meta} onNavigate={setPage} />
        </div>
      )}

    </section>
  );
}




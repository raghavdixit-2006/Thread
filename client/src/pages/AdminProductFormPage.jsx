// pages/AdminProductFormPage.jsx - dedicated add/edit pages for catalogue pieces.
// /admin/products/new renders creation immediately; /admin/products/:slug/edit loads the
// piece through the admin single GET (any state, incl. hidden pieces) and edits it.
// ProductForm carries the whole editing UX; this page resolves the product and navigates
// back to the catalogue list on save or cancel.
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminGetProductQuery } from '../services/productsApi.js';
import ProductForm from '../components/features/ProductForm.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import Spinner from '../components/common/Spinner.jsx';

export default function AdminProductFormPage({ mode = 'new' }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const loaded = useAdminGetProductQuery(slug, { skip: !isEdit });

  const back = () => navigate('/admin/products', { replace: true });

  return (
    <div className="container admin-form-page">
      <div className="page-head">
        <h1>{isEdit ? 'Edit piece' : 'New piece'}</h1>
        <p>
          {isEdit ? (
            <>Update the gallery, colour groups, prices or stock, then save. <Link to="/admin/products">Back to the catalogue</Link></>
          ) : (
            <>A new piece goes live in the shop the moment you create it. <Link to="/admin/products">Back to the catalogue</Link></>
          )}
        </p>
      </div>

      {isEdit && loaded.isLoading && <Spinner label="Loading the piece" />}
      {isEdit && loaded.error && (
        <div className="panel">
          <ErrorNote error={loaded.error} onRetry={loaded.refetch} />
          <p><Link to="/admin/products">Back to the catalogue</Link></p>
        </div>
      )}

      {(!isEdit || loaded.data) && (
        <ProductForm
          key={isEdit ? slug : 'new'}
          product={isEdit ? loaded.data : undefined}
          productSlug={isEdit ? slug : undefined}
          onClose={back}
        />
      )}
    </div>
  );
}


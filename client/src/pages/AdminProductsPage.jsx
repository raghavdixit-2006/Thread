// pages/AdminProductsPage.jsx - dedicated catalogue page: searchable list with delete;
// "Add product" and per-row "Edit" open their own pages (/admin/products/new,
// /admin/products/:slug/edit). Route: /admin/products (guarded by RequireAdmin).
import AdminProducts from '../components/features/AdminProducts.jsx';

export default function AdminProductsPage() {
  return (
    <div className="container">
      <div className="page-head">
        <h1>Product catalogue</h1>
        <p>Every piece in the shop, hidden ones included. Add and edit live on their own pages; delete stays one click away.</p>
      </div>
      <AdminProducts />
    </div>
  );
}


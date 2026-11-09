// pages/AdminPage.jsx - staff console: the incoming order queue. Catalogue management
// lives on its own pages (/admin/products, /admin/products/new, /admin/products/:slug/edit).
// Routes are session-guarded by RequireAdmin (guests -> the staff portal, customers -> home);
// this page keeps the same internal gate for the moments between route change and render.
// RBAC is enforced server-side too (adminRequired on every /api/admin route) - UX only.
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useSessionSync.js';
import { useAdminListOrdersQuery, useAdminSetStatusMutation, useSalesReportQuery } from '../services/ordersApi.js';
import { formatINR, formatDate, orderStatusLabel } from '../utils/format.js';
import { ADMIN_NEXT_STATUSES, ORDER_STATUSES } from '../utils/constants.js';
import ErrorNote from '../components/common/ErrorNote.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Pagination from '../components/common/Pagination.jsx';

const ACTION_LABELS = { packed: 'Mark packed', shipped: 'Mark shipped', delivered: 'Mark delivered', cancelled: 'Cancel order', refunded: 'Mark refunded' };

export default function AdminPage() {
  const { isAuthed, hydrated, user } = useAuth();

  if (!hydrated) return <Spinner label="Checking your session" />;
  if (!isAuthed || user?.role !== 'admin') {
    // RequireAuth already bounces guests to /auth; an authed customer goes home
    return <Navigate to="/" replace />;
  }
  return <AdminConsole />;
}

function AdminConsole() {
  return (
    <div className="container">
      <div className="page-head">
        <h1>Admin</h1>
        <p>
          Orders coming in from every account. Catalogue management lives on{' '}
          <Link to="/admin/products">its own page</Link>.
        </p>
      </div>
      <OrderQueue />
    </div>
  );
}

function OrderQueue() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const orders = useAdminListOrdersQuery({ page, limit: 20, ...(statusFilter ? { status: statusFilter } : {}) });
  const report = useSalesReportQuery();
  const [setStatus, { isLoading: mutating }] = useAdminSetStatusMutation();

  const [rowError, setRowError] = useState(null);

  function pickFilter(status) {
    setStatusFilter(status);
    setPage(1);
  }

  async function advance(order, status) {
    setRowError(null);
    // server enforces the transition graph; the note rides into the order timeline
    const note = status === 'cancelled' ? window.prompt('Reason for cancelling this order:', 'Cancelled by admin') : '';
    if (status === 'cancelled' && note === null) return; // prompt dismissed
    try {
      await setStatus({ id: order._id, status, note: note || `Marked ${status} by admin` }).unwrap();
    } catch (error) {
      setRowError(error);
    }
  }

  // server truth recomputes money; report totals arrive in paise already
  const reportTotals = report.data?.totals || { orders: 0, revenue: 0 };

  return (
    <>
      <div className="admin-stats">
        <div className="panel">
          <p className="eyebrow">Orders (30d)</p>
          <strong className="price">{reportTotals.orders}</strong>
        </div>
        <div className="panel">
          <p className="eyebrow">Revenue (30d)</p>
          <strong className="price">{formatINR(reportTotals.revenue)}</strong>
        </div>
        <div className="panel">
          <p className="eyebrow">In queue</p>
          <strong className="price">{(report.data?.byStatus || []).filter((s) => ['confirmed', 'packed'].includes(s._id)).reduce((sum, s) => sum + s.count, 0)}</strong>
        </div>
      </div>

      <div className="filters" role="group" aria-label="Filter orders by status">
        <button type="button" className={`chip ${statusFilter === '' ? 'active' : ''}`} onClick={() => pickFilter('')}>
          All
        </button>
        {ORDER_STATUSES.map((status) => (
          <button key={status} type="button" className={`chip ${statusFilter === status ? 'active' : ''}`} onClick={() => pickFilter(status)}>
            {orderStatusLabel(status)}
          </button>
        ))}
      </div>

      {rowError && <ErrorNote error={rowError} onRetry={orders.refetch} />}
      {orders.error && <ErrorNote error={orders.error} onRetry={orders.refetch} />}

      {orders.isLoading && <Spinner label="Loading orders" />}

      {orders.data && orders.data.items.length === 0 && (
        <p className="result-count">No orders in this filter yet.</p>
      )}

      {orders.data && orders.data.items.length > 0 && (
        <div className="admin-rows">
          {orders.data.items.map((order) => {
            const nextStatuses = ADMIN_NEXT_STATUSES[order.status] || [];
            const customer = order.customer || {};
            const address = order.address || {};
            return (
              <article key={order._id} className="admin-row">
                <details>
                  <summary>
                    <span className="admin-row-main">
                      <strong>{order.orderNumber}</strong>
                      <span className="admin-row-sub">{formatDate(order.createdAt, { withTime: true })}</span>
                    </span>
                    <span className="admin-row-customer">
                      <strong>{customer.name || 'Unknown customer'}</strong>
                      <span className="admin-row-sub">{customer.phone || 'No phone on file'}</span>
                    </span>
                    <span className="admin-row-items">
                      {(order.items || []).slice(0, 2).map((line) => `${line.title} x ${line.qty}`).join(', ')}
                      {order.items?.length > 2 ? ` +${order.items.length - 2} more` : ''}
                    </span>
                    <strong className="price">{formatINR(order.amountBreakup?.total)}</strong>
                    <span className={`order-status ${order.status}`}>{orderStatusLabel(order.status)}</span>
                  </summary>

                  <div className="admin-row-body">
                    <div>
                      <p className="eyebrow">Deliver to</p>
                      <p>
                        {customer.name || 'Unknown customer'}
                        <br />
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}
                        <br />
                        {address.city}, {address.state} - {address.pincode}
                        <br />
                        {customer.email}
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow">Items</p>
                      <ul className="admin-items">
                        {(order.items || []).map((line) => (
                          <li key={line.sku}>
                            {line.title} - {line.size}, {line.color} - {line.qty} x {formatINR(line.unitPrice)} = {formatINR(line.lineTotal)}
                          </li>
                        ))}
                      </ul>
                      <p className="result-count">
                        {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod}
                        {order.paymentStatus === 'paid' ? ' - collected' : ' - collect at the door'}
                        {order.couponCode ? ` - coupon ${order.couponCode}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow">Timeline</p>
                      <ul className="admin-timeline">
                        {(order.timeline || []).slice().reverse().map((entry, index) => (
                          <li key={`${entry.at}-${index}`}>
                            {orderStatusLabel(entry.status)} - {formatDate(entry.at, { withTime: true })}
                            {entry.by && entry.by !== 'system' ? ` (${entry.by})` : ''}
                            {entry.note ? ` - ${entry.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {nextStatuses.length > 0 && (
                    <div className="admin-actions">
                      {nextStatuses.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="btn"
                          disabled={mutating}
                          onClick={() => advance(order, status)}
                        >
                          {ACTION_LABELS[status] || orderStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  )}
                </details>
              </article>
            );
          })}
          <Pagination
            meta={{ page: orders.data.page, pages: orders.data.pages, total: orders.data.total }}
            onNavigate={setPage}
          />
        </div>
      )}
    </>
  );
}



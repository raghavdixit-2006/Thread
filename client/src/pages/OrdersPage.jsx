// pages/OrdersPage.jsx - legacy .orders-page of .order-cards; status chips + server pager.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useListMyOrdersQuery } from '../services/ordersApi.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import Pagination from '../components/common/Pagination.jsx';
import { ORDER_STATUSES } from '../utils/constants.js';
import { formatINR, formatDate, orderStatusLabel } from '../utils/format.js';

const VISIBLE_STATUSES = ORDER_STATUSES;

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page') || 1);
  const orders = useListMyOrdersQuery({ page, limit: 10, status: status || undefined });
  const [error, setError] = useState(null);

  function patchParams(next) {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) merged.set(key, String(value));
      else merged.delete(key);
    });
    setSearchParams(merged);
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>Your orders</h1>
        <p>Every THREAD parcel, with its live status and notes.</p>
      </div>

      <div className="filters" style={{ marginBottom: 26 }}>
        <button type="button" className={`chip ${status === '' ? 'active' : ''}`} onClick={() => patchParams({ status: '', page: 1 })}>
          All
        </button>
        {VISIBLE_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${status === value ? 'active' : ''}`}
            onClick={() => patchParams({ status: status === value ? '' : value, page: 1 })}
          >
            {orderStatusLabel(value)}
          </button>
        ))}
      </div>

      {orders.isLoading && <p className="result-count">Loading orders</p>}
      {(orders.error || error) && (
        <ErrorNote error={orders.error || error} onRetry={() => { setError(null); orders.refetch(); }} />
      )}

      {orders.data && orders.data.items.length === 0 && (
        <EmptyState
          icon="receipt"
          title="No orders yet"
          description={status ? `Nothing with status "${orderStatusLabel(status)}".` : 'When you place a COD order it appears here instantly.'}
        >
          <Link to="/shop" className="btn">Start shopping</Link>
        </EmptyState>
      )}

      {orders.data?.items.length > 0 && (
        <>
          <div className="orders-page">
            {orders.data.items.map((order) => (
              <div key={order._id} className="order-card">
                <div className="order-card-head">
                  <div>
                    <p className="eyebrow">Order</p>
                    <h3>{order.orderNumber}</h3>
                  </div>
                  <span className={`order-status ${order.status}`}>{orderStatusLabel(order.status)}</span>
                </div>
                <p>
                  {formatDate(order.createdAt, { withTime: true })}
                  {order.items?.length ? ` - ${order.items.length} item${order.items.length === 1 ? '' : 's'}` : ''}
                  {order.items?.[0] && ` - ${order.items[0].title}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}`}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <strong className="price">{formatINR(order.amountBreakup?.total)}</strong>
                  <Link to={`/orders/${order._id}`} className="text-link">
                    View details <i className="bi bi-arrow-right" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <Pagination meta={orders.data.meta} onNavigate={(nextPage) => patchParams({ page: nextPage })} />
        </>
      )}
    </div>
  );
}

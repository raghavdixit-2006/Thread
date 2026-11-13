// pages/OrderDetailPage.jsx - legacy detail: summary-card tick, order-table, timeline, cancel + Razorpay retry.
import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useGetMyOrderQuery, useCancelOrderMutation, useCreateRazorpaySessionMutation, useVerifyRazorpayPaymentMutation } from '../services/ordersApi.js';
import { useGetConfigQuery } from '../services/configApi.js';
import Spinner from '../components/common/Spinner.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import Timeline from '../components/features/Timeline.jsx';
import OrderSummary from '../components/features/OrderSummary.jsx';
import { productImageUrl } from '../utils/images.js';
import { formatINR, formatDate, orderStatusLabel, titleize } from '../utils/format.js';
import { CANCELLABLE_STATUSES } from '../utils/constants.js';
import { payWithRazorpay } from '../utils/razorpay.js';
import useAuth from '../hooks/useSessionSync.js';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const justPlaced = searchParams.get('placed') === '1';
  const order = useGetMyOrderQuery(id);
  const config = useGetConfigQuery();
  const onlinePayments = config.data?.payments?.razorpay === true;
  const [cancelOrder, { isLoading: cancelling, error: cancelError }] = useCancelOrderMutation();
  const [createSession] = useCreateRazorpaySessionMutation();
  const [verifyPayment] = useVerifyRazorpayPaymentMutation();
  const [reason, setReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [paying, setPaying] = useState(false);
  // a widget/verification failure handed over from checkout (script blocked, signature rejected)
  const [payError, setPayError] = useState(location.state?.payError || null);

  if (order.isLoading) return <Spinner label="Loading order" />;
  if (order.error || !order.data) {
    return (
      <div className="container page-head">
        <ErrorNote error={order.error || { message: 'Order not found' }} onRetry={order.refetch} />
        <Link to="/orders" className="btn">All orders</Link>
      </div>
    );
  }

  const data = order.data;
  const cancellable = CANCELLABLE_STATUSES.includes(data.status) && data.paymentStatus !== 'refunded';
  // online orders parked without money: pay now, retry after a gateway failure, or cancel (stock restores)
  const retryable = data.paymentMethod === 'razorpay' && ['initiated', 'failed'].includes(data.paymentStatus) && !['cancelled', 'refunded'].includes(data.status);

  async function handleRetry() {
    setPaying(true);
    setPayError(null);
    try {
      const outcome = await payWithRazorpay({ order: data, user, contact: data.address?.phone || '', createSession, verifyPayment });
      if (outcome.status === 'unverified') setPayError(outcome.error); // signature/verify rejection surface
      order.refetch(); // the attempt wrote timeline notes either way
    } catch (error) {
      setPayError(error); // gateway session rejection (unconfigured, already paid, network)
    } finally {
      setPaying(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelOrder({ id, reason: reason.trim() || 'Customer cancelled' }).unwrap();
      setShowCancel(false);
      setReason('');
    } catch {
      // server envelope displayed below
    }
  }

  return (
    <div className="container">
      <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ paddingTop: 32 }}>
        <Link to="/orders">Orders</Link> /
        <span>{data.orderNumber}</span>
      </nav>

      {justPlaced && (
        <div className="summary-card" style={{ marginTop: 14, marginBottom: 26, display: 'flex', gap: 16, alignItems: 'center', margin: '14px auto 26px', maxWidth: 560 }}>
          <span className="tick" style={{ margin: 0 }}>
            <i className="bi bi-check-lg" aria-hidden="true" />
          </span>
          <div>
            <h3 style={{ margin: '0 0 4px' }}>Order placed</h3>
            <p className="result-count" style={{ margin: 0 }}>
              {data.paymentMethod === 'razorpay'
                ? `${formatINR(data.amountBreakup?.total)} paid online via Razorpay - the order is confirmed; updates will follow by email.`
                : `Pay ${formatINR(data.amountBreakup?.total)} in cash on delivery - we will email the confirmation and updates.`}
            </p>
          </div>
        </div>
      )}

      <div className="cart-head page-head" style={{ paddingTop: justPlaced ? 0 : 44 }}>
        <div>
          <h1>{data.orderNumber}</h1>
          <p>Placed {formatDate(data.createdAt, { withTime: true })} - {titleize(data.paymentMethod)} ({orderStatusLabel(data.paymentStatus)})</p>
        </div>
        <span className={`order-status ${data.status}`}>{orderStatusLabel(data.status)}</span>
      </div>

      <div className="order-detail-grid">
        <div>
          <div className="panel">
            <h3>Items</h3>
            <table className="order-table">
              <tbody>
                {data.items?.map((line, index) => (
                  <tr key={`${line.sku}-${index}`}>
                    <td style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {line.image ? (
                        <span className="summary-item-thumb"><img src={productImageUrl(line.image)} alt={line.title} /></span>
                      ) : (
                        <span className="summary-item-thumb placeholder-block" />
                      )}
                      <span>
                        <Link to={`/product/${line.slug}`}>{line.title}</Link>
                        <br />
                        <span className="result-count">{line.size} - {line.color} - {line.qty} x {formatINR(line.unitPrice)}</span>
                      </span>
                    </td>
                    <td><strong>{formatINR(line.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <OrderSummary breakup={data.amountBreakup} />
          </div>

          <div className="panel">
            <h3>Delivering to</h3>
            <p className="address-lines">
              {data.address?.fullName}
              <br />{data.address?.line1}{data.address?.line2 ? `, ${data.address.line2}` : ''}
              <br />{data.address?.city}, {data.address?.state} - {data.address?.pincode}
              <br />{data.address?.phone}
            </p>
            {data.deliveryOption && (
              <p className="result-count">
                <i className="bi bi-truck" aria-hidden="true" /> {titleize(data.deliveryOption)} delivery
                {data.couponCode ? ` - coupon ${data.couponCode} applied` : ''}
              </p>
            )}
          </div>

          <div className="panel">
            <h3>Status history</h3>
            <Timeline events={data.timeline} />
          </div>
        </div>

        <aside className="summary-card" aria-label="Actions" style={{ minHeight: 120 }}>
          <h3>Need to change something?</h3>
          {retryable && onlinePayments && (
            <div style={{ marginBottom: 16 }}>
              <p className="result-count">
                {data.paymentStatus === 'failed' ? 'The last payment attempt failed - ' : 'This order is waiting for payment - '}
                complete the payment to confirm it.
              </p>
              <button type="button" className="btn block" onClick={handleRetry} disabled={paying}>
                {paying ? 'Opening payment' : 'Retry payment'}
              </button>
            </div>
          )}
          {retryable && !config.isLoading && !onlinePayments && (
            <p className="result-count" style={{ marginBottom: 16 }}>
              Online payment is temporarily unavailable, so this order stays parked. Nothing was charged; contact support to complete or cancel it.
            </p>
          )}
          {payError && <ErrorNote error={payError} onRetry={onlinePayments ? handleRetry : undefined} />}
          {cancellable ? (
            <>
              <p className="result-count">Orders can be cancelled any time before they ship.</p>
              {!showCancel ? (
                <button type="button" className="btn ghost block" onClick={() => setShowCancel(true)}>
                  Cancel this order
                </button>
              ) : (
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label htmlFor="cancel-reason">Reason (optional)</label>
                    <input id="cancel-reason" maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Change of mind, wrong size..." />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn block" onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? 'Cancelling' : 'Confirm cancel'}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setShowCancel(false)}>Keep it</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="result-count">
              This order is already {orderStatusLabel(data.status)} - it can no longer be cancelled here.
            </p>
          )}
          <ErrorNote error={cancelError} onRetry={handleCancel} />
          <div className="summary-notes">
            <span>
              <i className="bi bi-file-earmark-text" aria-hidden="true" />
              Read the <Link to="/policies/cancellation-policy" className="link">cancellation policy</Link>
            </span>
            <span>
              <i className={data.paymentMethod === 'razorpay' ? 'bi bi-shield-check' : 'bi bi-cash-coin'} aria-hidden="true" />
              {data.paymentMethod === 'razorpay' ? 'Payment state is verified by Razorpay signatures' : 'COD amount is collected by the courier'}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

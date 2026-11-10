// pages/CartPage.jsx - cart: free-shipping meter, line rows, sticky summary card.
// Guest bag lives in the slice; member bag streams from the server snapshot. Same markup.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCartSnapshot, setCartQty, removeCartLine, clearWholeCart } from '../store/cartSlice.js';
import useAuth from '../hooks/useSessionSync.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import QuantityStepper from '../components/common/QuantityStepper.jsx';
import OrderSummary from '../components/features/OrderSummary.jsx';
import { useToast } from '../components/common/ToastProvider.jsx';
import { productImageUrl } from '../utils/images.js';
import { estimateBreakup } from '../utils/pricing.js';
import { formatINR } from '../utils/format.js';
import { FREE_SHIPPING_THRESHOLD_PAISE } from '../utils/constants.js';

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const snapshot = useSelector(selectCartSnapshot);
  const { items, subtotal, unavailable } = snapshot;
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!items.length && unavailable.length === 0) {
    return (
      <div className="container page-head">
        <h1>Your bag</h1>
        <EmptyState
          icon="bag"
          title="Your bag is empty"
          description="Add a jacket, a shirt, or both. Standard shipping is free past Rs 2,000."
        >
          <Link to="/shop" className="btn">Browse the shop</Link>
        </EmptyState>
      </div>
    );
  }

  async function handleQty(sku, qty) {
    await dispatch(setCartQty({ sku, qty })).catch(() => {});
  }

  async function handleRemove(sku, title) {
    await dispatch(removeCartLine({ sku })).catch(() => {});
    toast.push(`${title || 'Piece'} removed from your bag`);
  }

  async function handleClear() {
    setConfirmClear(false);
    await dispatch(clearWholeCart()).catch(() => {});
    toast.push('Your bag is empty again');
  }

  // guests get merged into the account at sign-in; checkout itself needs a session (COD address)
  function goToCheckout() {
    navigate(isAuthed ? '/checkout' : `/auth?next=${encodeURIComponent('/checkout')}`);
  }

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_PAISE - subtotal);
  const progress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_PAISE) * 100));

  return (
    <div className="container">
      <div className="cart-head page-head">
        <div>
          <h1>Your bag</h1>
          <p>{snapshot.count} item{snapshot.count === 1 ? '' : 's'} ready when you are.</p>
        </div>
        <Link to="/shop" className="text-link">
          Continue shopping <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      </div>

      <div className="cart-layout">
        <div className="cart-lines">
          <div className={`shipping-meter ${remaining === 0 ? 'is-complete' : ''}`}>
            <div className="shipping-meter-copy">
              <span>
                {remaining === 0
                  ? 'Standard shipping is free on this order.'
                  : `${formatINR(remaining)} away from free standard shipping.`}
              </span>
              <span className="shipping-meter-value">{progress}%</span>
            </div>
            <div className="shipping-meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} aria-label="Progress to free shipping">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          {unavailable.length > 0 && (
            <p className="cart-note">
              {unavailable.length} item{unavailable.length === 1 ? ' is' : 's are'} no longer available and will be dropped at checkout.
            </p>
          )}

          {items.map((raw, index) => {
            // tolerate stale cache lines: item/sku/qty carry defaults, never undefined references
            const item = raw.item || { sku: raw.sku || '', size: '', color: '', qty: raw.qty ?? 1 };
            const stockCap = Math.max(1, Math.min(10, raw.qtyCap ?? raw.stock ?? 10));
            const atCap = item.qty >= stockCap;
            const lineTotal = raw.lineTotal ?? (raw.unitPrice ?? 0) * item.qty;
            return (
              <div className="cart-row" key={item.sku || raw.productId || String(index)}>
                <Link to={`/product/${raw.slug || ''}`} className="cart-thumb">
                  {raw.image ? (
                    <img src={productImageUrl(raw.image)} alt={raw.title} width="96" height="116" />
                  ) : (
                    <span className="placeholder-block cart-placeholder" />
                  )}
                </Link>
                <div className="cart-info">
                  <h3><Link to={`/product/${raw.slug || ''}`}>{raw.title || 'Product'}</Link></h3>
                  <p className="meta-line">{raw.brand || 'THREAD'} - size {item.size || '-'}, {item.color || '-'}</p>
                  <p className="meta-line">{formatINR(raw.unitPrice ?? 0)} each{atCap ? ' - stock limit reached' : ''}</p>
                  <QuantityStepper
                    value={item.qty}
                    max={stockCap}
                    onChange={(next) => handleQty(item.sku, next)}
                  />
                </div>
                <div className="cart-line-right">
                  <p className="price">{formatINR(lineTotal)}</p>
                  <button type="button" className="remove-btn" onClick={() => handleRemove(item.sku, raw.title)}>
                    <i className="bi bi-x" aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
            );
          })}

          {items.length > 0 && (
            <button type="button" className="remove-btn clear-bag" onClick={() => setConfirmClear(true)}>
              <i className="bi bi-bag-x" aria-hidden="true" /> Empty the bag
            </button>
          )}
        </div>

        <aside className="cart-side" aria-label="Order summary">
          <div className="summary-card">
            <h3>Summary</h3>
            <OrderSummary breakup={estimateBreakup({ subtotal })} />
            <p className="result-count summary-note">
              Final totals confirm on checkout. Coupons apply there.
            </p>
            <button type="button" className="btn block" onClick={goToCheckout}>
              {isAuthed ? 'Go to checkout' : 'Sign in to checkout'}
            </button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Empty your bag?"
        description="Every piece will be removed. Saved wishlist items stay put."
        confirmLabel="Empty the bag"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

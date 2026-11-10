// components/features/OrderSummary.jsx - money breakup display.
// The numbers shown are estimates confirmed by the order document after placement
// (the server recomputes everything; money rules live server-side by contract).
import { formatINR } from '../../utils/format.js';

export default function OrderSummary({ breakup, savings = null }) {
  if (!breakup) return null;
  const { subtotal, discount, shipping, tax, total } = breakup;
  return (
    <dl className="order-summary">
      <div className="summary-row">
        <dt>Subtotal</dt>
        <dd>{formatINR(subtotal)}</dd>
      </div>
      {discount > 0 && (
        <div className="summary-row discount">
          <dt>Coupon discount</dt>
          <dd>-{formatINR(discount)}</dd>
        </div>
      )}
      <div className="summary-row">
        <dt>Shipping</dt>
        <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
      </div>
      <div className="summary-row">
        <dt>GST (5%)</dt>
        <dd>{formatINR(tax)}</dd>
      </div>
      <div className="summary-row total">
        <dt>Total</dt>
        <dd>{formatINR(total)}</dd>
      </div>
      {savings != null && savings > 0 && (
        <p className="summary-savings">You save {formatINR(savings)} on this order</p>
      )}
    </dl>
  );
}

// pages/CheckoutPage.jsx - COD / Razorpay placement (address, delivery, payment, coupon) in legacy panels.
// The server recomputes every amount; the estimate labels stay honest about that.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useListAddressesQuery, useAddAddressMutation } from '../services/usersApi.js';
import { useValidateCouponMutation } from '../services/couponsApi.js';
import { usePlaceOrderMutation, useCreateRazorpaySessionMutation, useVerifyRazorpayPaymentMutation } from '../services/ordersApi.js';
import { useGetConfigQuery } from '../services/configApi.js';
import { selectCartSnapshot } from '../store/cartSlice.js';
import useAuth from '../hooks/useSessionSync.js';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorNote from '../components/common/ErrorNote.jsx';
import AddressCard from '../components/features/AddressCard.jsx';
import OrderSummary from '../components/features/OrderSummary.jsx';
import { productImageUrl } from '../utils/images.js';
import { estimateBreakup } from '../utils/pricing.js';
import { formatINR } from '../utils/format.js';
import { DELIVERY_OPTIONS } from '../utils/constants.js';
import { payWithRazorpay } from '../utils/razorpay.js';

const BLANK_ADDRESS = { label: '', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

// mirrors the server contract so a typed address can be used without a save round trip
const draftComplete = (draft) =>
  draft.fullName.trim().length >= 2 &&
  /^[6-9]\d{9}$/.test(draft.phone.trim()) &&
  draft.line1.trim().length >= 4 &&
  draft.city.trim().length >= 2 &&
  draft.state.trim().length >= 2 &&
  /^[1-9]\d{5}$/.test(draft.pincode.trim());

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const snapshot = useSelector(selectCartSnapshot);
  const saved = useListAddressesQuery(undefined, { skip: !isAuthed });
  const [addAddress, { isLoading: savingAddress }] = useAddAddressMutation();
  const [validateCoupon, { isLoading: checkingCoupon }] = useValidateCouponMutation();
  const [placeOrder, { isLoading: placing, error: placeError }] = usePlaceOrderMutation();
  const [createSession, { error: sessionError }] = useCreateRazorpaySessionMutation();
  const [verifyPayment] = useVerifyRazorpayPaymentMutation();
  const config = useGetConfigQuery();
  const onlinePayments = config.data?.payments?.razorpay === true;
  const gatewayMode = config.data?.payments?.mode;
  const [paymentMethod, setPaymentMethod] = useState('cod');
  // the method the server will actually be asked for: online only when the gateway is configured
  const effectiveMethod = onlinePayments ? paymentMethod : 'cod';
  const [paying, setPaying] = useState(false); // the whole place + open-widget + verify cycle

  const savedAddresses = saved.data?.items || [];
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [draft, setDraft] = useState(BLANK_ADDRESS);
  const [draftSaving, setDraftSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const chosen = useMemo(() => {
    const preferred = savedAddresses.find((address) => String(address._id) === String(selectedId));
    if (preferred) return preferred;
    return savedAddresses.find((address) => address.isDefault) || savedAddresses[0] || null;
  }, [savedAddresses, selectedId]);

  const [deliveryOption, setDeliveryOption] = useState('standard');
  // a typed address is enough to order; the address book is a convenience, not a gate
  const typedAddress = draftComplete(draft) ? { ...draft, label: draft.label || 'Checkout' } : null;
  // an open form with a complete address wins: that is what "deliver somewhere else" means
  const shippingAddress = (showAddressForm && typedAddress) || chosen || typedAddress;
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // {code, discount}
  const [couponError, setCouponError] = useState(null);
  const [addressError, setAddressError] = useState(null);
  const [saveAddress, setSaveAddress] = useState(false);

  const { items, subtotal, count } = snapshot;
  const breakup = useMemo(
    () => estimateBreakup({ subtotal, discount: coupon?.discount || 0, deliveryOption }),
    [subtotal, coupon, deliveryOption],
  );

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveAddress(event) {
    event.preventDefault();
    setDraftSaving(true);
    setAddressError(null);
    try {
      const created = await addAddress({ ...draft, label: draft.label || 'Checkout', isDefault: savedAddresses.length === 0 }).unwrap();
      saved.refetch();
      setSelectedId(created._id || null);
      setShowAddressForm(false);
      setDraft({ ...BLANK_ADDRESS, fullName: user?.name || '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', label: '' });
    } catch (error) {
      setAddressError(error);
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleCoupon(event) {
    event.preventDefault();
    setCouponError(null);
    if (!couponCode.trim()) return;
    try {
      const result = await validateCoupon({ code: couponCode.trim(), subtotal }).unwrap();
      if (result.valid || typeof result.discount === 'number') {
        setCoupon({ code: result.code || couponCode.trim(), discount: result.discount || 0 });
        setCouponError(null);
      } else {
        setCoupon(null);
        setCouponError(result.reason ? { message: result.reason } : { message: 'Coupon not applicable on this amount' });
      }
    } catch (error) {
      setCoupon(null);
      setCouponError(error);
    }
  }

  async function handlePlace() {
    if (!items.length) return;
    if (!shippingAddress) {
      setAddressError({ message: 'Add a delivery address before placing the order.' });
      setShowAddressForm(true);
      return;
    }
    setPaying(true);
    // never ask the gateway for a method the server cannot honour (missing keys -> 503)
    const method = effectiveMethod;
    let order;
    try {
      order = await placeOrder({
        address: {
          label: shippingAddress.label || 'Checkout',
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode,
        },
        deliveryOption,
        paymentMethod: method,
        couponCode: coupon?.code,
        saveAddress,
      }).unwrap();
    } catch {
      // the server envelope (stock conflicts, coupon races) renders below
      setPaying(false);
      return;
    }

    if (method === 'razorpay') {
      // online: the cart is already emptied and stock reserved at placement - the widget
      // decides whether the order is paid now or retried later from the order page
      try {
        const outcome = await payWithRazorpay({ order, user, contact: shippingAddress.phone, createSession, verifyPayment });
        navigate(
          outcome.status === 'paid' ? `/orders/${order._id}?placed=1` : `/orders/${order._id}`,
          outcome.status === 'unverified' ? { state: { payError: outcome.error } } : undefined,
        );
      } catch (error) {
        // widget script blocked or gateway session refused: the parked order can be paid from its page
        navigate(`/orders/${order._id}`, { state: { payError: error } });
      }
      return;
    }

    // cart cache refresh: ordersApi.onQueryStarted invalidates the Cart tag; nothing else needed
    navigate(`/orders/${order._id}?placed=1`);
    setPaying(false);
  }

  if (!isAuthed) {
    return (
      <div className="container page-head">
        <EmptyState
          icon="lock"
          title="Sign in to checkout"
          description="Your bag is saved; cash on delivery orders need an account for the address book and order history."
        >
          <Link to="/auth?next=/checkout" className="btn">Sign in</Link>
        </EmptyState>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container page-head">
        <EmptyState icon="bag" title="Nothing to check out" description="Your bag is empty - pick something first.">
          <Link to="/shop" className="btn">Browse the shop</Link>
        </EmptyState>
      </div>
    );
  }

  if (saved.isLoading) return <Spinner label="Preparing checkout" />;

  return (
    <div className="container">
      <div className="page-head cart-head">
        <div>
          <h1>Checkout</h1>
          <p>{count} item{count === 1 ? '' : 's'} - {formatINR(subtotal)} subtotal. Choose how to pay.</p>
        </div>
        <Link to="/cart" className="text-link">
          Back to the bag <i className="bi bi-arrow-left" aria-hidden="true" />
        </Link>
      </div>

      <div className="checkout-grid">
        <div className="checkout-form">
          <div className="panel">
            <h2>Delivery address</h2>
            {savedAddresses.length > 0 && (
              <div className="address-grid" style={{ marginBottom: 16 }}>
                {savedAddresses.map((address) => (
                  <AddressCard
                    key={address._id}
                    address={address}
                    selected={chosen && String(address._id) === String(chosen._id)}
                    onSelectActions={{ onUse: (picked) => setSelectedId(picked._id), onSetDefault: null, onRemove: null, onEdit: null }}
                  />
                ))}
              </div>
            )}
            {savedAddresses.length > 0 ? (
              <button type="button" className="text-link" onClick={() => setShowAddressForm((open) => !open)}>
                <i className="bi bi-plus-lg" aria-hidden="true" /> {showAddressForm ? 'Hide new address form' : 'Deliver somewhere else'}
              </button>
            ) : null}
            {(showAddressForm || savedAddresses.length === 0) && (
              <form className="form-grid" onSubmit={handleSaveAddress} noValidate style={{ marginTop: 12 }}>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="co-label">Label (optional)</label>
                    <input id="co-label" value={draft.label} onChange={(event) => updateDraft('label', event.target.value)} placeholder="Home, Office" />
                  </div>
                  <div className="field">
                    <label htmlFor="co-name">Full name</label>
                    <input id="co-name" autoComplete="name" value={draft.fullName} onChange={(event) => updateDraft('fullName', event.target.value)} required minLength={2} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="co-phone">Phone (10 digit)</label>
                  <input id="co-phone" autoComplete="tel" inputMode="numeric" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} required pattern="\d{10}" />
                </div>
                <div className="field">
                  <label htmlFor="co-l1">Address line 1</label>
                  <input id="co-l1" autoComplete="address-line1" value={draft.line1} onChange={(event) => updateDraft('line1', event.target.value)} required minLength={4} />
                </div>
                <div className="field">
                  <label htmlFor="co-l2">Address line 2 (optional)</label>
                  <input id="co-l2" autoComplete="address-line2" value={draft.line2} onChange={(event) => updateDraft('line2', event.target.value)} />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="co-city">City</label>
                    <input id="co-city" autoComplete="address-level2" value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="co-state">State</label>
                    <input id="co-state" autoComplete="address-level1" value={draft.state} onChange={(event) => updateDraft('state', event.target.value)} required />
                  </div>
                </div>
                <div className="field" style={{ maxWidth: 220 }}>
                  <label htmlFor="co-pin">Pincode</label>
                  <input id="co-pin" autoComplete="postal-code" inputMode="numeric" value={draft.pincode} onChange={(event) => updateDraft('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} required pattern="\d{6}" />
                </div>
                <div className="checkbox-line" style={{ marginBottom: 12 }}>
                  <input id="co-save-addr" type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} />
                  <label htmlFor="co-save-addr">Save this address to my account</label>
                </div>
                <div>
                  <button type="submit" className="btn ghost" disabled={draftSaving || savingAddress}>
                    {draftSaving ? 'Saving' : 'Save address'}
                  </button>
                </div>
              </form>
            )}
            {addressError && <ErrorNote error={addressError} compact />}
            {saved.error && !savedAddresses.length && (
              <ErrorNote error={saved.error} onRetry={saved.refetch} compact />
            )}
          </div>

          <div className="panel">
            <h2>Items</h2>
            {items.map((line) => (
              <div className="summary-item" key={line.item.sku}>
                <span className="summary-item-thumb">
                  {line.image ? (
                    <img src={productImageUrl(line.image)} alt={line.title} />
                  ) : (
                    <span className="placeholder-block" style={{ width: '100%', height: '100%' }} />
                  )}
                </span>
                <span className="summary-item-info">
                  {line.title}
                  <br />
                  Size {line.item.size} - {line.item.color} - Qty {line.item.qty}
                </span>
                <strong className="summary-item-price">{formatINR(line.lineTotal)}</strong>
              </div>
            ))}
          </div>
        </div>

        <aside className="checkout-summary" aria-label="Payment summary">
          <div className="summary-card">
            <h3>Order summary</h3>

            <fieldset className="field payment-field">
              <legend>Payment</legend>
              <div className="payment-options">
                <label className={`payment-option ${(onlinePayments ? paymentMethod : 'cod') === 'cod' ? 'is-selected' : ''}`}>
                  <input type="radio" name="payment-method" value="cod" checked={(onlinePayments ? paymentMethod : 'cod') === 'cod'} onChange={() => setPaymentMethod('cod')} />
                  <span>
                    <strong>Cash on delivery</strong>
                    <small>Pay the courier when the parcel arrives.</small>
                  </span>
                </label>
                {config.isLoading && (
                  <p className="payment-pending">Checking online payment availability</p>
                )}
                {!config.isLoading && onlinePayments && (
                  <label className={`payment-option ${paymentMethod === 'razorpay' ? 'is-selected' : ''}`}>
                    <input type="radio" name="payment-method" value="razorpay" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} />
                    <span>
                      <strong>
                        Pay online
                        {gatewayMode === 'test' && <span className="payment-mode">Sandbox</span>}
                      </strong>
                      <small>UPI, cards and netbanking through Razorpay.</small>
                    </span>
                  </label>
                )}
                {!config.isLoading && !onlinePayments && (
                  <p className="payment-pending">
                    Online payment is not available right now. Cash on delivery is open and needs no card.
                  </p>
                )}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="co-delivery">Delivery speed</label>
              <select id="co-delivery" className="checkout-delivery" value={deliveryOption} onChange={(event) => setDeliveryOption(event.target.value)}>
                {DELIVERY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <form className="coupon-row" onSubmit={handleCoupon}>
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Coupon code"
                aria-label="Coupon code"
              />
              <button type="submit" className="icon-btn" disabled={checkingCoupon || !couponCode.trim()}>
                {checkingCoupon ? '...' : 'Apply'}
              </button>
            </form>
            {coupon && (
              <p className="coupon-ok">
                <i className="bi bi-ticket-perforated-fill" aria-hidden="true" /> {coupon.code} applied - you save {formatINR(coupon.discount)}
              </p>
            )}
            {couponError && <ErrorNote error={couponError} compact />}

            <OrderSummary breakup={breakup} />

            <ErrorNote error={placeError} onRetry={handlePlace} />
            <ErrorNote error={sessionError} onRetry={handlePlace} />

            <button
              type="button"
              className="btn block"
              onClick={handlePlace}
              disabled={paying || !shippingAddress || !items.length}
            >
              {paying
                ? effectiveMethod === 'razorpay'
                  ? 'Opening payment'
                  : 'Placing order'
                : `Place order - ${formatINR(breakup.total)}`}
            </button>
            <p className="result-count checkout-note">
              {!shippingAddress
                ? 'Add a delivery address to place the order.'
                : effectiveMethod === 'cod'
                  ? 'Pay in cash when the parcel arrives.'
                  : `${formatINR(breakup.total)} is collected online via Razorpay; the order confirms once the payment is verified.`}
            </p>
            <ul className="checkout-assurance">
              <li><i className="bi bi-shield-check" aria-hidden="true" /> Prices and stock confirmed by the server</li>
              <li><i className="bi bi-truck" aria-hidden="true" /> Free standard shipping over Rs 2,000</li>
              <li><i className="bi bi-arrow-repeat" aria-hidden="true" /> 7-day returns on unused pieces</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

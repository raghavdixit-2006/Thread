// pages/ProfilePage.jsx - account essentials (name, phone), saved addresses, order history.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useSessionSync.js';
import { useUpdateProfileMutation } from '../services/authApi.js';
import { useListMyOrdersQuery } from '../services/ordersApi.js';
import {
  useListAddressesQuery,
  useAddAddressMutation,
  usePatchAddressMutation,
  useRemoveAddressMutation,
  useSetDefaultAddressMutation,
} from '../services/usersApi.js';
import ErrorNote from '../components/common/ErrorNote.jsx';
import AddressCard from '../components/features/AddressCard.jsx';
import { updateUser } from '../services/session.js';
import { formatINR, formatDate, orderStatusLabel } from '../utils/format.js';

const BLANK_ADDRESS = { label: '', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export default function ProfilePage() {
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileNote, setProfileNote] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const [updateProfile, { isLoading: profileSaving }] = useUpdateProfileMutation();

  const addresses = useListAddressesQuery();
  const [addAddress, { isLoading: addingAddress }] = useAddAddressMutation();
  const [patchAddress] = usePatchAddressMutation();
  const [removeAddress] = useRemoveAddressMutation();
  const [setDefaultAddress] = useSetDefaultAddressMutation();

  const history = useListMyOrdersQuery({ limit: 4 });

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(BLANK_ADDRESS);
  const [editingId, setEditingId] = useState(null);
  const [addressError, setAddressError] = useState(null);

  async function onProfileSubmit(event) {
    event.preventDefault();
    setProfileNote(null);
    setProfileError(null);
    const phoneDigits = phone.replace(/\D/g, '').slice(0, 10);
    const payload = {};
    if (name.trim() && name.trim() !== user?.name) payload.name = name.trim();
    if (phoneDigits && phoneDigits !== (user?.phone || '')) payload.phone = phoneDigits;
    if (!Object.keys(payload).length) {
      setProfileNote('Nothing to change yet');
      return;
    }
    if (payload.phone && payload.phone.length !== 10) {
      setProfileError({ message: 'A 10-digit Indian mobile number is required' });
      return;
    }
    try {
      const updated = await updateProfile(payload).unwrap();
      updateUser(updated); // identity-only emit; the access token is untouched
      setName(updated.name || name);
      setPhone(updated.phone || phoneDigits);
      setProfileNote('Profile saved');
    } catch (error) {
      setProfileError(error);
    }
  }

  async function onAddressSubmit(event) {
    event.preventDefault();
    setAddressError(null);
    try {
      const body = { ...draft, label: draft.label || (editingId ? 'Address' : 'Home') };
      if (editingId) await patchAddress({ id: editingId, ...body }).unwrap();
      else await addAddress(body).unwrap();
      addresses.refetch();
      setDraft(BLANK_ADDRESS);
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      setAddressError(error);
    }
  }

  function editAddress(address) {
    setEditingId(address._id);
    setDraft({
      label: address.label || '',
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    });
    setShowForm(true);
  }

  async function onDeleteAddress(address) {
    if (!window.confirm('Remove this saved address?')) return;
    try {
      await removeAddress(address._id).unwrap();
      addresses.refetch();
    } catch (error) {
      setAddressError(error);
    }
  }

  async function onMakeDefault(address) {
    try {
      await setDefaultAddress(address._id).unwrap();
      addresses.refetch();
    } catch (error) {
      setAddressError(error);
    }
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>Profile</h1>
        <p>
          Signed in as {user?.email}{user?.authProvider === 'google' ? ' (Google account)' : '.'}
        </p>
      </div>

      <div className="profile-layout">
        <div className="panel" aria-label="Account essentials">
          <h3>Account</h3>
          <form className="form-grid" onSubmit={onProfileSubmit} noValidate>
            <div className="field">
              <label htmlFor="profile-name">Full name</label>
              <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
            </div>

            <div className="field">
              <label htmlFor="profile-phone">Phone</label>
              <input
                id="profile-phone"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                pattern="\d{10}"
                placeholder="10-digit mobile number"
              />
            </div>

            {profileError && <ErrorNote error={profileError} compact />}
            {profileNote && <p className="coupon-ok"><i className="bi bi-check-circle" aria-hidden="true" /> {profileNote}</p>}
            <div>
              <button type="submit" className="btn" disabled={profileSaving}>
                {profileSaving ? 'Saving' : 'Save changes'}
              </button>
            </div>
          </form>

          <dl className="profile-essentials">
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{user?.createdAt ? formatDate(user.createdAt) : 'Just now'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role === 'admin' ? 'Administrator' : 'Customer'}</dd>
            </div>
          </dl>
        </div>

        <section aria-label="Order history">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h2>Order history</h2>
            <Link to="/orders" className="text-link">
              View all orders <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>

          {history.isLoading && <p className="result-count">Loading orders</p>}
          {history.error && <ErrorNote error={history.error} onRetry={history.refetch} />}

          <div className="orders-page">
            {(history.data?.items || []).map((order) => (
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
            {history.data && history.data.items.length === 0 && (
              <p className="result-count">No orders yet - placed orders appear here with their status.</p>
            )}
          </div>
        </section>

        <section aria-label="Saved addresses">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h2>Saved addresses</h2>
            <button
              type="button"
              className="text-link"
              onClick={() => { setShowForm((open) => !open); setEditingId(null); setDraft(BLANK_ADDRESS); }}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" /> {showForm ? 'Close form' : 'Add address'}
            </button>
          </div>

          {addressError && <ErrorNote error={addressError} compact />}
          {addresses.isLoading && <p className="result-count">Loading addresses</p>}
          {addresses.error && <ErrorNote error={addresses.error} onRetry={addresses.refetch} />}

          {(showForm || editingId) && (
            <form className="panel" onSubmit={onAddressSubmit} noValidate style={{ marginBottom: 18 }}>
              <h3>{editingId ? 'Edit address' : 'New address'}</h3>
              <div className="form-grid">
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="addr-label">Label</label>
                    <input id="addr-label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Home, Office" />
                  </div>
                  <div className="field">
                    <label htmlFor="addr-name">Full name</label>
                    <input id="addr-name" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} required minLength={2} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="addr-phone">Phone</label>
                  <input id="addr-phone" inputMode="numeric" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} required pattern="\d{10}" />
                </div>
                <div className="field">
                  <label htmlFor="addr-l1">Line 1</label>
                  <input id="addr-l1" value={draft.line1} onChange={(event) => setDraft({ ...draft, line1: event.target.value })} required minLength={4} />
                </div>
                <div className="field">
                  <label htmlFor="addr-l2">Line 2 (optional)</label>
                  <input id="addr-l2" value={draft.line2} onChange={(event) => setDraft({ ...draft, line2: event.target.value })} />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="addr-city">City</label>
                    <input id="addr-city" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required />
                  </div>
                  <div className="field">
                    <label htmlFor="addr-state">State</label>
                    <input id="addr-state" value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })} required />
                  </div>
                </div>
                <div className="field" style={{ maxWidth: 220 }}>
                  <label htmlFor="addr-pin">Pincode</label>
                  <input id="addr-pin" inputMode="numeric" value={draft.pincode} onChange={(event) => setDraft({ ...draft, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} required pattern="\d{6}" />
                </div>
                <div>
                  <button type="submit" className="btn" disabled={addingAddress}>
                    {addingAddress ? 'Saving' : editingId ? 'Update address' : 'Add address'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="address-grid">
            {(addresses.data?.items || []).map((address) => (
              <AddressCard
                key={address._id}
                address={address}
                onSelectActions={{ onEdit: editAddress, onRemove: onDeleteAddress, onSetDefault: onMakeDefault }}
              />
            ))}
            {!addresses.isLoading && addresses.data?.items.length === 0 && (
              <p className="result-count">No saved addresses yet - checkout can store one for you.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

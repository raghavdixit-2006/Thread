// components/features/WishlistHeart.jsx - wishlist toggle (auth gate -> /auth redirect).
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useSessionSync.js';
import { useWishlistStatesQuery, useToggleWishlistMutation } from '../../services/wishlistApi.js';
import { useToast } from '../common/ToastProvider.jsx';

export default function WishlistHeart({ productId, large = false }) {
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toggle, { isLoading }] = useToggleWishlistMutation();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const { data } = useWishlistStatesQuery([productId], { skip: !isAuthed || !productId });
  const active = Boolean(
    isAuthed && data?.states?.length && data.states.some((state) => state.active),
  );

  async function handleToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthed) {
      toast.push('Sign in to save pieces to your wishlist', 'error');
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      await toggle({ productId }).unwrap();
      toast.push(active ? 'Removed from your wishlist' : 'Saved to your wishlist');
    } catch {
      toast.push('Wishlist did not update. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`wishlist-heart ${large ? 'wishlist-heart-lg' : ''} ${active ? 'is-active' : ''}`}
      onClick={handleToggle}
      disabled={busy || isLoading}
      aria-pressed={active}
      aria-label={active ? 'Remove from wishlist' : 'Save to wishlist'}
    >
      <i className={`bi ${active ? 'bi-heart-fill' : 'bi-heart'} ${busy || isLoading ? 'opacity-half' : ''}`} aria-hidden="true" />
    </button>
  );
}

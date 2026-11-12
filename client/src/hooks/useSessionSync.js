// hooks/useSessionSync.js - mounts once in App: session.js events -> Redux + cart merge.
// Also exposes `useAuth()` for components (reads the synced slice).
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { onSession } from '../services/session.js';
import { sessionUpdated, sessionCleared, selectUser, selectIsAuthed, selectAuthHydrated } from '../store/authSlice.js';
import { mergeGuestCartIfNeeded, cartCacheSet, cartCacheCleared, selectServerCart } from '../store/cartSlice.js';
import { readCartCache, clearCartCache } from '../store/cartCache.js';
import { authApi } from '../services/authApi.js';
import { cartApi } from '../services/cartApi.js';
import { wishlistApi } from '../services/wishlistApi.js';
import { ordersApi } from '../services/ordersApi.js';

const USER_SCOPED_APIS = [cartApi, wishlistApi, ordersApi];

export function useSessionSync() {
  const dispatch = useDispatch();

  // token/user emitter: only `user !== undefined` means identity actually changed
  useEffect(() => onSession((hasToken, user) => {
    if (!hasToken) {
      dispatch(sessionCleared());
      return;
    }
    dispatch(sessionUpdated({ hasToken: Boolean(hasToken), user }));
  }), [dispatch]);

  // sync user-scoped data whenever identity flips (bootstrap, login, logout)
  const user = useSelector(selectUser);
  useEffect(() => {
    if (user) {
      // per-user cart cache: restore this account's snapshot immediately (JWT-matched id),
      // then merge the guest bag and let the live server cart override it
      const cached = readCartCache(user.id);
      if (cached) dispatch(cartCacheSet({ owner: user.id, snapshot: cached }));
      dispatch(mergeGuestCartIfNeeded());
      dispatch(cartApi.util.invalidateTags(['Cart']));
      dispatch(wishlistApi.util.invalidateTags(['Wishlist']));
      return undefined;
    }
    // signed out: drop every user-scoped cache (and every saved cart line) so nothing
    // leaks into the next session - the cache is per account AND per session lifetime
    USER_SCOPED_APIS.forEach((api) => dispatch(api.util.resetApiState()));
    dispatch(cartCacheCleared());
    clearCartCache();
    return undefined;
  }, [dispatch, user]);

  // persist this account's cart while the session lives (server snapshot -> local cache)
  const serverCart = useSelector(selectServerCart);
  useEffect(() => {
    if (!user?.id || !serverCart) return undefined;
    dispatch(cartCacheSet({ owner: user.id, snapshot: serverCart }));
    return undefined;
  }, [dispatch, user?.id, serverCart]);
}

const useAuth = () => ({
  user: useSelector(selectUser),
  isAuthed: useSelector(selectIsAuthed),
  hydrated: useSelector(selectAuthHydrated),
});

export function useRequireAuth() {
  const { isAuthed, hydrated } = useAuth();
  return { isAuthed, hydrated };
}

// named re-export for guard components
export { selectIsAuthed };

export default useAuth;

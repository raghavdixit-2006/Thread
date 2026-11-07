// store/cartSlice.js - one cart, two storage modes, one uniform view.
// Signed in: RTK Query owns the server cart (cartApi) - the slice never mirrors it.
// Guest: lines live here and are persisted to localStorage by main.jsx's store
// subscription; on sign-in they are merged into the server cart, then dropped.
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { GUEST_CART_STORAGE_KEY } from '../utils/constants.js';
import { selectIsAuthed } from './authSlice.js';
import { cartsEndpoints } from '../services/cartApi.js';

const GUEST_MAX_QTY = 10;

function readGuestStorage() {
  try {
    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed.filter((i) => i && i.productId && i.sku && i.qty > 0);
  } catch {
    // corrupted storage behaves like an empty cart
  }
  return [];
}

const initialState = { guestItems: [], merging: false, mergedOnce: false, cacheOwner: null, cachedSnapshot: null };

export const cartSlice = createSlice({
  name: 'cart',
  initialState: { ...initialState, guestItems: readGuestStorage() },
  reducers: {
    guestItemAdded(state, { payload }) {
      // payload: { productId, sku, qty, product: { slug, title, brand, image, unitPrice, mrp, size, color, stock } }
      const { productId, sku, qty = 1, product = {} } = payload;
      const existing = state.guestItems.find((i) => i.sku === sku);
      if (existing) existing.qty = Math.min(GUEST_MAX_QTY, existing.qty + qty);
      else state.guestItems.push({ productId, sku, qty: Math.min(GUEST_MAX_QTY, qty), product });
    },
    guestQtySet(state, { payload }) {
      const { sku, qty } = payload;
      if (qty <= 0) state.guestItems = state.guestItems.filter((i) => i.sku !== sku);
      else {
        const line = state.guestItems.find((i) => i.sku === sku);
        if (line) line.qty = Math.min(GUEST_MAX_QTY, qty);
      }
    },
    guestCleared(state) {
      state.guestItems = [];
    },
    mergeStarted(state) {
      state.merging = true;
    },
    mergeFinished(state) {
      state.merging = false;
    },
    /** signed-in display cache: { owner (user id), snapshot } - server data always wins over this */
    cartCacheSet(state, { payload }) {
      const { owner, snapshot } = payload;
      if (owner == null || !snapshot) return;
      state.cacheOwner = String(owner);
      state.cachedSnapshot = snapshot;
    },
    /** session end: forget the cached identity and its lines */
    cartCacheCleared(state) {
      state.cacheOwner = null;
      state.cachedSnapshot = null;
    },
  },
});

export const { guestItemAdded, guestQtySet, guestCleared, mergeStarted, mergeFinished, cartCacheSet, cartCacheCleared } = cartSlice.actions;

// ---------------------------------------------------------------------------
// thunks (the only mutation surface pages use)
// ---------------------------------------------------------------------------

function incrementServerCart(dispatch, endpoint, payload) {
  return dispatch(endpoint.initiate(payload)).unwrap();
}

export const addToCart = createAsyncThunk('cart/add', ({ productId, sku, qty = 1, product }, { dispatch, getState }) =>
  selectIsAuthed(getState())
    ? incrementServerCart(dispatch, cartsEndpoints.addItem, { productId, sku, qty })
    : (dispatch(guestItemAdded({ productId, sku, qty, product })), Promise.resolve(null)),
);

export const setCartQty = createAsyncThunk('cart/setQty', ({ sku, qty }, { dispatch, getState }) =>
  selectIsAuthed(getState())
    ? incrementServerCart(dispatch, cartsEndpoints.setQty, { sku, qty })
    : (dispatch(guestQtySet({ sku, qty })), Promise.resolve(null)),
);

export const removeCartLine = createAsyncThunk('cart/remove', ({ sku }, { dispatch, getState }) =>
  selectIsAuthed(getState())
    ? incrementServerCart(dispatch, cartsEndpoints.setQty, { sku, qty: 0 })
    : (dispatch(guestQtySet({ sku, qty: 0 })), Promise.resolve(null)),
);

export const clearWholeCart = createAsyncThunk('cart/clear', (_, { dispatch, getState }) =>
  selectIsAuthed(getState())
    ? incrementServerCart(dispatch, cartsEndpoints.clearCart, undefined)
    : (dispatch(guestCleared()), Promise.resolve(null)),
);

/** called once per sign-in (useSessionSync) - pushes guest lines to the account */
export const mergeGuestCartIfNeeded = createAsyncThunk('cart/mergeGuest', async (_, { dispatch, getState }) => {
  const guest = getState().cart.guestItems;
  let snapshot = null;
  if (guest.length) {
    dispatch(mergeStarted());
    try {
      snapshot = await dispatch(
        cartsEndpoints.mergeGuest.initiate({
          items: guest.map(({ productId, sku, qty }) => ({ productId, sku, qty })),
        }),
      ).unwrap();
      dispatch(guestCleared());
    } finally {
      dispatch(mergeFinished());
    }
  }
  return snapshot;
});

// ---------------------------------------------------------------------------
// selectors - one shape for both modes (mirrors the server enrich envelope)
// ---------------------------------------------------------------------------

const EMPTY_SNAPSHOT = { items: [], subtotal: 0, count: 0, unavailable: [] };

/** one shape for every snapshot source (server enrich envelope, cache line, guest slice).
    Older cache lines may predate `unavailable`; a malformed count falls back to items.
    Memoised per raw reference: selectors must return stable objects or consumers with
    effects keyed on the snapshot (useSessionSync) re-dispatch forever (update-depth loop). */
const normalizedCache = new WeakMap();
function stableNormalize(raw) {
  if (!raw || !Array.isArray(raw.items)) return EMPTY_SNAPSHOT;
  let normalized = normalizedCache.get(raw);
  if (!normalized) {
    normalized = {
      items: raw.items,
      subtotal: typeof raw.subtotal === 'number' ? raw.subtotal : 0,
      count: typeof raw.count === 'number'
        ? raw.count
        : raw.items.reduce((sum, line) => sum + (line?.item?.qty ?? 0), 0),
      unavailable: Array.isArray(raw.unavailable) ? raw.unavailable : [],
    };
    normalizedCache.set(raw, normalized);
  }
  return normalized;
}

export const selectServerCart = (state) => {
  const data = cartsEndpoints.getCart.select()(state).data;
  return data ? stableNormalize(data) : null;
};

function guestSnapshot(guestItems) {
  const items = guestItems.map((g) => {
    const p = g.product || {};
    const qty = g.qty;
    return {
      productId: g.productId,
      slug: p.slug || '',
      title: p.title || 'Product',
      brand: p.brand || 'THREAD',
      category: p.category || '',
      image: p.image || '',
      mrp: p.mrp || 0,
      item: { sku: g.sku, size: p.size || '', color: p.color || '', qty },
      unitPrice: p.unitPrice ?? p.price ?? 0,
      stock: p.stock ?? GUEST_MAX_QTY,
      qtyCap: Math.min(GUEST_MAX_QTY, p.stock ?? GUEST_MAX_QTY),
      lineTotal: (p.unitPrice ?? 0) * qty,
    };
  });
  const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
  const count = items.reduce((sum, line) => sum + line.item.qty, 0);
  return { items, subtotal, count, unavailable: [] };
}

/** signed-in cache fallback: only records the exact user fetched them (JWT-verified id) */
function selectCachedSnapshot(state) {
  const ownerId = state.auth?.user?.id;
  if (ownerId == null || state.cart.cacheOwner !== String(ownerId)) return null;
  return state.cart.cachedSnapshot;
}

/** subscribe in pages to get {items, subtotal, count, unavailable} regardless of mode */
export const selectCartSnapshot = (state) =>
  selectIsAuthed(state)
    ? selectServerCart(state) || stableNormalize(selectCachedSnapshot(state))
    : guestSnapshot(state.cart.guestItems || []);

/** header badge: item count across both modes */
export const selectCartCount = (state) => selectCartSnapshot(state).count;

export const selectGuestLineCount = (state) => state.cart.guestItems.reduce((sum, i) => sum + i.qty, 0);

export default cartSlice.reducer;

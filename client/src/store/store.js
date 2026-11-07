// store/store.js - single Redux store; RTK Query api is injected by feature slices.
import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './authSlice.js';
import { cartSlice } from './cartSlice.js';
import { productsApi } from '../services/productsApi.js';
import { reviewsApi } from '../services/reviewsApi.js';
import { authApi } from '../services/authApi.js';
import { cartApi } from '../services/cartApi.js';
import { wishlistApi } from '../services/wishlistApi.js';
import { ordersApi } from '../services/ordersApi.js';
import { couponsApi } from '../services/couponsApi.js';
import { usersApi } from '../services/usersApi.js';
import { policiesApi } from '../services/policiesApi.js';
import { configApi } from '../services/configApi.js';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    cart: cartSlice.reducer,
    [productsApi.reducerPath]: productsApi.reducer,
    [reviewsApi.reducerPath]: reviewsApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [cartApi.reducerPath]: cartApi.reducer,
    [wishlistApi.reducerPath]: wishlistApi.reducer,
    [ordersApi.reducerPath]: ordersApi.reducer,
    [couponsApi.reducerPath]: couponsApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [policiesApi.reducerPath]: policiesApi.reducer,
    [configApi.reducerPath]: configApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(
      productsApi.middleware,
      reviewsApi.middleware,
      authApi.middleware,
      cartApi.middleware,
      wishlistApi.middleware,
      ordersApi.middleware,
      couponsApi.middleware,
      usersApi.middleware,
      policiesApi.middleware,
      configApi.middleware,
    ),
});

// dev-only window handle: console debugging (`window.__threadStore.getState()`)
if (import.meta.env.DEV && typeof window !== 'undefined') window.__threadStore = store;

export default store;


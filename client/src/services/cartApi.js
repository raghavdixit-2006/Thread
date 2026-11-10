// services/cartApi.js - server cart for signed-in users (guest cart lives in cartSlice).
// Mutations return the same enrich envelope as the read: { items, subtotal, count, unavailable }.
import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery.js';

const envelope = (res) => res.data;

export const cartApi = createApi({
  reducerPath: 'cartApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Cart'],
  endpoints: (build) => ({
    getCart: build.query({
      query: () => ({ url: '/api/cart', method: 'GET' }),
      transformResponse: envelope,
      providesTags: ['Cart'],
    }),
    addItem: build.mutation({
      query: ({ productId, sku, qty = 1 }) => ({ url: '/api/cart/items', method: 'POST', data: { productId, sku, qty } }),
      transformResponse: envelope,
      invalidatesTags: ['Cart'],
    }),
    setQty: build.mutation({
      query: ({ sku, qty }) => ({ url: '/api/cart/items', method: 'PATCH', data: { sku, qty } }),
      transformResponse: envelope,
      invalidatesTags: ['Cart'],
    }),
    removeItem: build.mutation({
      query: (sku) => ({ url: `/api/cart/items/${encodeURIComponent(sku)}`, method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    clearCart: build.mutation({
      query: () => ({ url: '/api/cart', method: 'DELETE' }),
      transformResponse: envelope,
      invalidatesTags: ['Cart'],
    }),
    mergeGuest: build.mutation({
      // arg is the payload the thunk sends: { items } - destructure so the server
      // receives data.items = [{ productId, sku, qty }] (never double-nested)
      query: ({ items }) => ({ url: '/api/cart/merge', method: 'POST', data: { items } }),
      transformResponse: envelope,
      invalidatesTags: ['Cart'],
    }),
  }),
});

export const { useGetCartQuery } = cartApi;
export const cartsEndpoints = cartApi.endpoints;

export default cartApi;
